/* Service Worker: macht die Testseite offline nutzbar (Tablet ohne WLAN).
   tools/build.mjs setzt SW ein: { version, cache, core: [...], extra: [...] }.
   - Seiten (index.html): zuerst aus dem Netz (höchstens 3 s), sonst aus dem Speicher.
     So kommt ein Update sofort an, und ohne Netz startet die App trotzdem.
   - Alles andere (Symbole, vendor/, assets/welt.bin): aus dem Speicher, sonst aus dem Netz und dann gespeichert.
   Der Spielstand liegt in localStorage und wird hier nie angefasst. */
'use strict';
const SW = {"version":"0.4.0","cache":"fl-0.4.0-1135e2579c","core":["./","index.html","manifest.webmanifest","icons/icon.svg","icons/icon-192.png","icons/icon-512.png","assets/welt.bin","vendor/three-0.187.0/three.module.js","vendor/three-0.187.0/three.core.js"],"extra":[]};

self.addEventListener('install', e => {
  // core muss vollständig ankommen; extra (große Bibliotheken) nur versuchen
  e.waitUntil(caches.open(SW.cache).then(c => c.addAll(SW.core).then(() =>
    Promise.all(SW.extra.map(u => c.add(u).catch(() => {}))))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.indexOf('fl-') === 0 && k !== SW.cache).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', e => {
  if (e.data === 'version' && e.source) e.source.postMessage({ sw: SW.version, cache: SW.cache });
});

function fromNet(req, ms) {
  return new Promise((ok, no) => {
    const t = setTimeout(() => no(new Error('timeout')), ms);
    fetch(req).then(r => { clearTimeout(t); ok(r); }, err => { clearTimeout(t); no(err); });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // Demo-Schalter (?demo=…) und andere Parameter: gleiche Seite aus dem Speicher
    e.respondWith(fromNet(req, 3000).then(r => {
      if (r && r.ok) { const copy = r.clone(); caches.open(SW.cache).then(c => c.put(url.pathname, copy)); }
      return r;
    }).catch(() => caches.open(SW.cache).then(c => c.match(url.pathname)
      .then(m => m || (/\/(index\.html)?$/.test(url.pathname) ? c.match('./').then(x => x || c.match('index.html')) : null))))
      .then(r => r || new Response('<!DOCTYPE html><meta charset="utf-8"><p style="font:20px sans-serif;padding:30px">Offline und noch nicht gespeichert. Bitte einmal mit Internet öffnen.</p>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
    return;
  }
  e.respondWith(caches.open(SW.cache).then(c => c.match(req, { ignoreSearch: true }).then(m => m || fetch(req).then(r => {
    if (r && r.ok) c.put(req, r.clone());
    return r;
  }))));
});

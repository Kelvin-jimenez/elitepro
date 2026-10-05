/* Elitepro · funcionamiento sin conexión.
   Con red, la página se pide siempre al servidor (así nunca se queda una versión vieja); sin red, se usa la última copia guardada.
   Los datos del usuario no pasan por aquí: viven en el almacenamiento del navegador y, si tiene cuenta, en la nube. */
const CACHE = "elitepro-v1";
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(["./", "manifest.webmanifest", "icons/icon-192.png"])).catch(() => {})); });
self.addEventListener("activate", e => e.waitUntil((async () => { for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k); await self.clients.claim(); })()));
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  if (url.origin === self.location.origin) {
    if (/\/(version\.json|panel\.html|sw\.js)$/.test(url.pathname)) return; // siempre de la red, sin copia
    const page = /\/(index\.html)?$/.test(url.pathname), key = page ? "./" : req;
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(page ? new Request(url.pathname + url.search, { cache: "no-cache" }) : req);
        if (res.ok) cache.put(key, res.clone());
        return res;
      } catch (err) { const hit = await cache.match(key); if (hit) return hit; throw err; }
    })());
    return;
  }
  if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) e.respondWith((async () => { // tipografías: valen las guardadas
    const cache = await caches.open(CACHE), hit = await cache.match(req); if (hit) return hit;
    const res = await fetch(req); cache.put(req, res.clone()); return res;
  })());
});

// ServRail POS service worker (hand-rolled — no build-time precache).
//
// The till is opened online at the start of a shift; this SW caches the app
// shell and static assets as they're fetched, so the till keeps loading and
// running through a connectivity drop later in the shift. Order data lives in
// IndexedDB (Dexie) and syncs via /api/pos/sync, which this SW never touches.

const CACHE = "servrail-pos-v1";

self.addEventListener("install", () => {
  // Take over as soon as the new SW is installed.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never intercept checkout/sync POSTs
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // third-party: passthrough
  if (url.pathname.startsWith("/api/")) return; // dynamic data: network only

  // Navigations (the till shell): network-first, fall back to the cached shell.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(CACHE);
          return (
            (await cache.match(req)) ||
            (await cache.match("/pos")) ||
            Response.error()
          );
        }
      })(),
    );
    return;
  }

  // Static build assets, fonts, icons: stale-while-revalidate.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      return cached || (await network) || Response.error();
    })(),
  );
});

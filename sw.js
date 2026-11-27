// Pitch Card Game service worker.
//
// NETWORK-FIRST, always. A cache-first worker can keep serving a stale
// build after a new deploy (that failure mode has bitten this project
// family before), so every request goes to the network first and the
// cache is only an offline fallback. Successful GET responses are
// cached at runtime purely so the game still opens with no connection.
//
// Bump CACHE_NAME whenever this file changes: on activate, every cache
// with a different name is deleted.
const CACHE_NAME = "pitch-cache-v1";

self.addEventListener("install", () => {
  // The cache is only a fallback, so there is no reason to keep
  // clients waiting on an older worker.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Only GETs are cacheable; everything else goes straight through.
  // (WebSocket traffic is never intercepted by fetch handlers.)
  if (request.method !== "GET") return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)),
          );
        }
        return response;
      })
      .catch(async () => {
        // Offline: serve the last good copy if we have one. ignoreSearch
        // so cache-busting query strings (?fresh=…) still hit the shell.
        const cached = await caches.match(request, { ignoreSearch: true });
        return cached ?? Response.error();
      }),
  );
});

const CACHE_NAME = "radio-pwa-cache-v1";
const urlsToCache = [
  "/",
  "index.html",
  "styles.css",
  "script.js",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) return response;
        return fetch(event.request)
          .then(networkResponse => {
            if (!event.request.url.includes("api.radio-browser.info") && networkResponse.ok) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
            }
            return networkResponse;
          })
          .catch(() => caches.match(event.request));
      })
  );
});

self.addEventListener("activate", event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => Promise.all(
      cacheNames.map(cacheName => !cacheWhitelist.includes(cacheName) && caches.delete(cacheName))
    )).then(() => self.clients.claim())
  );
});
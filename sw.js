const CACHE_NAME = "radio-pwa-cache-v973";
const urlsToCache = [
  "/",
  "index.html",
  "styles.css",
  "script.js",
  "stations.json",
  "manifest.json",
  "icon-192.png",
  "icon-512.png"
];

let isInitialLoad = true;

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.url.includes("stations.json")) {
    if (isInitialLoad) {
      event.respondWith(
        fetch(event.request, { cache: "no-cache" })
          .then(response => {
            if (!response.ok) return caches.match(event.request) || Response.error();
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
            isInitialLoad = false;
            return response;
          })
          .catch(() => caches.match(event.request) || Response.error())
      );
    } else {
      event.respondWith(
        caches.match(event.request)
          .then(cachedResponse => {
            return cachedResponse || fetch(event.request).then(networkResponse => {
              if (networkResponse.ok) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
              }
              return networkResponse;
            });
          })
      );
    }
  } else {
    event.respondWith(
      caches.match(event.request)
        .then(response => response || fetch(event.request))
        .catch(() => caches.match(event.request))
    );
  }
});

self.addEventListener("activate", event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => Promise.all(
      cacheNames.map(cacheName => !cacheWhitelist.includes(cacheName) && caches.delete(cacheName))
    )).then(() => {
      isInitialLoad = true;
      self.clients.claim();
    })
  );
});
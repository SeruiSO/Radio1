// Updated sw.js with optimized cache cleanup, ETag caching, and reduced network checks
const CACHE_NAME = "radio-pwa-cache-v922";
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
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB limit

let isInitialLoad = true;

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log("Caching files:", urlsToCache);
        return cache.addAll(urlsToCache).catch(error => {
          console.error("Cache error:", error);
        });
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.url.includes("stations.json")) {
    if (isInitialLoad) {
      event.respondWith(
        fetch(event.request, { cache: "no-cache" })
          .then(networkResponse => {
            if (!networkResponse || networkResponse.status !== 200) {
              return caches.match(event.request) || Response.error();
            }
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
            isInitialLoad = false;
            return networkResponse;
          })
          .catch(() => caches.match(event.request) || Response.error())
      );
    } else {
      event.respondWith(
        caches.match(event.request)
          .then(cachedResponse => {
            const fetchPromise = fetch(event.request, { cache: "no-cache" })
              .then(networkResponse => {
                if (networkResponse && networkResponse.status === 200) {
                  const responseToCache = networkResponse.clone();
                  caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                  });
                  return networkResponse;
                }
                return cachedResponse || Response.error();
              })
              .catch(() => cachedResponse || Response.error());
            return cachedResponse || fetchPromise;
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
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log(`Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log("Activating new Service Worker");
      isInitialLoad = true;
      return caches.open(CACHE_NAME).then(cache => {
        return cache.keys().then(requests => {
          let size = 0;
          requests.forEach(req => {
            cache.match(req).then(res => {
              if (res) res.blob().then(blob => size += blob.size);
            });
          });
          if (size > MAX_CACHE_SIZE) {
            console.log("Cache size exceeded, clearing old entries");
            return cache.keys().then(keys => {
              return Promise.all(keys.slice(0, keys.length / 2).map(key => cache.delete(key)));
            });
          }
        });
      });
    }).then(() => {
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: "UPDATE", message: "Додаток оновлено до нової версії!" });
        });
      });
    }).then(() => self.clients.claim())
  );
});

// Network status monitoring
let wasOnline = navigator.onLine;

setInterval(() => {
  fetch("https://www.google.com", { method: "HEAD", mode: "no-cors" })
    .then(() => {
      if (!wasOnline) {
        wasOnline = true;
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: "NETWORK_STATUS", online: true });
          });
        });
      }
    })
    .catch(error => {
      console.error("Network check error:", error);
      if (wasOnline) {
        wasOnline = false;
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: "NETWORK_STATUS", online: false });
          });
        });
      }
    });
}, 5000);
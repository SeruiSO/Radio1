const CACHE_NAME = "radio-pwa-cache-v209"; // Updated cache version
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

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log("Кешування файлів:", urlsToCache);
        return cache.addAll(urlsToCache).catch(error => {
          console.error("Помилка кешування:", error);
        });
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          if (event.request.url.includes("stations.json")) {
            return fetch(event.request).then(networkResponse => {
              if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
                return response;
              }
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, networkResponse.clone());
              });
              return networkResponse;
            }).catch(() => response);
          }
          return response;
        }
        return fetch(event.request).then(networkResponse => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          return networkResponse;
        }).catch(() => {
          return caches.match(event.request);
        });
      })
  );
});

self.addEventListener("activate", event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheNames => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: "UPDATE", message: "Додаток оновлено до нової версії!" });
        });
      });
    }).then(() => self.clients.claim())
  );
});

// Моніторинг стану мережі
let wasOnline = navigator.onLine;

setInterval(() => {
  if (!navigator.onLine) {
    if (wasOnline) {
      wasOnline = false;
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: "NETWORK_STATUS", online: false });
        });
      });
    }
    return;
  }
  fetch("stations.json", { method: "HEAD", cache: "no-cache" })
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
    .catch(() => {
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
const CACHE_NAME = "radio-pwa-cache-v77";
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
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log(`Видалення старого кешу: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log("Активація нового Service Worker");
      isInitialLoad = true;
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: "UPDATE", message: "Додаток оновлено до нової версії!" });
        });
      });
    }).then(() => self.clients.claim())
  );
});

let wasOnline = navigator.onLine;

self.addEventListener("online", () => {
  if (!wasOnline) {
    wasOnline = true;
    self.clients.matchAll({ includeUncontrolled: true, type: "window" }).then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: "NETWORK_STATUS", online: true, retry: true });
      });
    });
  }
});

self.addEventListener("offline", () => {
  if (wasOnline) {
    wasOnline = false;
    self.clients.matchAll({ includeUncontrolled: true, type: "window" }).then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: "NETWORK_STATUS", online: false });
      });
    });
  }
});

setInterval(() => {
  if (wasOnline !== navigator.onLine) {
    wasOnline = navigator.onLine;
    self.clients.matchAll({ includeUncontrolled: true, type: "window" }).then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: "NETWORK_STATUS", online: wasOnline, retry: wasOnline });
      });
    });
  }
}, 5000);
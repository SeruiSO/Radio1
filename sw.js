const CACHE_NAME = "radio-pwa-cache-v74";
const urlsToCache = ["/", "/index.html", "/styles.css", "/script.js", "/stations.json", "/manifest.json", "/icon-192.png", "/icon-512.png"];
let isInitialLoad = true;

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("Service Worker: Відкрито кеш");
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  if (url.pathname === "/stations.json") {
    if (isInitialLoad) {
      event.respondWith(
        fetch(event.request, { cache: "no-cache" })
          .then(response => {
            if (response.status === 200) {
              isInitialLoad = false;
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
              return response;
            }
            return caches.match(event.request);
          })
          .catch(() => caches.match(event.request))
      );
    } else {
      event.respondWith(
        caches.match(event.request).then(cachedResponse => {
          const networkFetch = fetch(event.request).then(response => {
            if (response.status === 200) {
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
            }
            return response;
          });
          return cachedResponse || networkFetch;
        })
      );
    }
  } else {
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request).catch(() => caches.match(event.request));
      })
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
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  isInitialLoad = true;
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: "UPDATE", message: "Додаток оновлено до нової версії!" });
    });
  });
  self.clients.claim();
});

let wasOnline = navigator.onLine;

self.addEventListener("online", () => {
  if (!wasOnline) {
    wasOnline = true;
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: "NETWORK_STATUS", online: true });
      });
    });
  }
});

self.addEventListener("offline", () => {
  if (wasOnline) {
    wasOnline = false;
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: "NETWORK_STATUS", online: false });
      });
    });
  }
});

setInterval(() => {
  if (wasOnline !== navigator.onLine) {
    wasOnline = navigator.onLine;
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: "NETWORK_STATUS", online: wasOnline });
      });
    });
  }
}, 5000);
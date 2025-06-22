const CACHE_NAME = "radio-so-cache-v3";
const CACHE_VERSION = "2.0.0";
const urlsToCache = [
  "/",
  "/index.html",
  "/styles.css",
  "/script.js",
  "/stations.json",
  "/manifest.json",
  "/icon-192.png",
  "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap",
  "https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2",
  "https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmEU9fBBc4.woff2",
  "https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc4.woff2"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("Service Worker: Кеш відкрито");
      return cache.addAll(urlsToCache).catch(error => {
        console.error("Service Worker: Помилка кешування:", error);
      });
    }).then(() => {
      console.log("Service Worker: Установка завершена");
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log("Service Worker: Видаляємо старий кеш:", cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      console.log("Service Worker: Активовано");
      self.clients.claim();
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: "CACHE_UPDATED",
            cacheVersion: CACHE_VERSION
          });
        });
      });
    })
  );
});

self.addEventListener("fetch", event => {
  const requestUrl = new URL(event.request.url);
  if (requestUrl.pathname === "/stations.json" && event.request.method === "GET") {
    event.respondWith(
      fetch(event.request, { cache: "no-store" }).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === "error") {
          return caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
              console.log("Service Worker: Використовуємо кеш для stations.json");
              return cachedResponse;
            }
            throw new Error("Немає мережевої відповіді та кешу для stations.json");
          });
        }
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, networkResponse.clone());
          console.log("Service Worker: Оновлено кеш для stations.json");
          return networkResponse;
        });
      }).catch(error => {
        console.error("Service Worker: Помилка запиту stations.json:", error);
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            console.log("Service Worker: Повертаємо кешовану версію stations.json");
            return cachedResponse;
          }
          return new Response(JSON.stringify({ error: "Офлайн, дані недоступні" }), {
            status: 503,
            headers: { "Content-Type": "application/json" }
          });
        });
      })
    );
  } else {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          console.log("Service Worker: Повертаємо кеш для:", event.request.url);
          return cachedResponse;
        }
        return fetch(event.request).then(networkResponse => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === "error") {
            console.warn("Service Worker: Не вдалося отримати мережеву відповідь для:", event.request.url);
            return networkResponse;
          }
          if (urlsToCache.includes(requestUrl.pathname) || event.request.url.startsWith("https://fonts.gstatic.com")) {
            return caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, networkResponse.clone());
              console.log("Service Worker: Кешовано:", event.request.url);
              return networkResponse;
            });
          }
          return networkResponse;
        }).catch(error => {
          console.error("Service Worker: Помилка запиту:", error, event.request.url);
          if (event.request.mode === "navigate") {
            return caches.match("/index.html");
          }
          return new Response("Офлайн, дані недоступні", { status: 503 });
        });
      })
    );
  }
});

let wasOnline = navigator.onLine;
setInterval(() => {
  const isOnline = navigator.onLine;
  if (isOnline !== wasOnline) {
    console.log(`Service Worker: Статус мережі змінився на ${isOnline ? "онлайн" : "офлайн"}`);
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: "NETWORK_STATUS",
          online: isOnline
        });
      });
    });
    wasOnline = isOnline;
  }
}, 1000);
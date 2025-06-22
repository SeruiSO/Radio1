const CACHE_NAME = "radio-so-cache-v1";
const CACHE_VERSION = "1.0.0";
let wasOnline = navigator.onLine;

const urlsToCache = [
  "./",
  "index.html",
  "styles.css",
  "script.js",
  "manifest.json",
  "icon-192.png",
  "icon-512.png",
  "stations.json"
];

self.addEventListener("install", (event) => {
  console.log("[SW] Установка сервіс-воркера...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Кешування ресурсів:", urlsToCache);
      return cache.addAll(urlsToCache).catch((error) => {
        console.error("[SW] Помилка кешування:", error);
      });
    }).then(() => {
      console.log("[SW] Пропуск очікування, активація сервіс-воркера");
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", (event) => {
  console.log("[SW] Активація сервіс-воркера...");
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log("[SW] Видалення старого кешу:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      self.clients.claim(),
      notifyClientsCacheUpdated()
    ])
  );
});

async function notifyClientsCacheUpdated() {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
  clients.forEach((client) => {
    console.log("[SW] Надсилання CACHE_UPDATED до клієнта:", client.id);
    client.postMessage({
      type: "CACHE_UPDATED",
      cacheVersion: CACHE_VERSION
    });
  });
}

async function notifyClientsNetworkStatus(online) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
  clients.forEach((client) => {
    console.log(`[SW] Надсилання NETWORK_STATUS (online=${online}) до клієнта:`, client.id);
    client.postMessage({
      type: "NETWORK_STATUS",
      online
    });
  });
}

setInterval(() => {
  const isOnline = navigator.onLine;
  if (isOnline !== wasOnline) {
    console.log("[SW] Зміна статусу мережі:", isOnline ? "онлайн" : "офлайн");
    notifyClientsNetworkStatus(isOnline);
    wasOnline = isOnline;
  }
}, 1000);

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.includes("stations.json")) {
    event.respondWith(networkFirst(event.request));
  } else if (urlsToCache.some((cachedUrl) => url.pathname.endsWith(cachedUrl)) && event.request.method === "GET") {
    event.respondWith(cacheFirst(event.request));
  } else {
    event.respondWith(fetch(event.request).catch(() => {
      console.warn("[SW] Помилка мережі для некэшованого ресурсу:", url.pathname);
    }));
  }
});

async function cacheFirst(request) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(request);
    if (response) {
      console.log("[SW] Відповідь із кешу:", request.url);
      return response;
    }
    console.log("[SW] Немає в кеші, запит до мережі:", request.url);
    const networkResponse = await fetch(request);
    await cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    console.error("[SW] Помилка cacheFirst:", error);
    return new Response("Офлайн: ресурс недоступний", { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    if (!navigator.onLine) {
      console.log("[SW] Офлайн: повернення кешованої версії stations.json");
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(request);
      if (cachedResponse) return cachedResponse;
      throw new Error("Офлайн і немає кешу");
    }
    const networkResponse = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, networkResponse.clone());
    console.log("[SW] Оновлено кеш для:", request.url);
    notifyClientsCacheUpdated();
    return networkResponse;
  } catch (error) {
    console.warn("[SW] Помилка networkFirst:", error);
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log("[SW] Повернення кешованої версії:", request.url);
      return cachedResponse;
    }
    return new Response("Офлайн: stations.json недоступний", { status: 503 });
  }
}

self.addEventListener("message", (event) => {
  if (event.data.type === "CHECK_NETWORK") {
    notifyClientsNetworkStatus(navigator.onLine);
  }
});
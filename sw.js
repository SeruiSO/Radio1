const CACHE_NAME = "radio-pwa-cache-v528";
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
  if (event.request.url.includes("stations.json")) {
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
          return networkResponse;
        })
        .catch(() => caches.match(event.request) || Response.error())
    );
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
            return caches.delete(cacheName).catch(error => {
              console.error(`Помилка видалення кешу ${cacheName}:`, error);
            });
          }
        })
      );
    }).then(() => {
      console.log("Активація нового Service Worker");
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: "UPDATE", message: "Додаток оновлено до нової версії!" });
        });
      });
    }).then(() => self.clients.claim())
  );
});

// Моніторинг стану мережі та Bluetooth
let wasOnline = navigator.onLine;
let isBluetoothConnected = false;
let retryAttempts = { 1: 0, 2: 0, 5: 0 };
let retryInterval = null;

function startNetworkCheck(interval) {
  if (retryInterval) clearInterval(retryInterval);
  retryAttempts[interval]++;
  retryInterval = setInterval(() => {
    fetch("https://www.google.com", { method: "HEAD", mode: "no-cors" })
      .then(() => {
        if (!wasOnline) {
          wasOnline = true;
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({ type: "NETWORK_STATUS", online: true });
              client.postMessage({ type: "NETWORK_RECONNECT" });
            });
            if (!clients.length) {
              self.registration.showNotification("", { tag: "network-reconnect", silent: true });
            }
          });
          clearInterval(retryInterval);
          retryAttempts = { 1: 0, 2: 0, 5: 0 };
        }
      })
      .catch(() => {
        if (retryAttempts[1] < 10) {
          if (interval !== 1) startNetworkCheck(1);
        } else if (retryAttempts[2] < 10) {
          if (interval !== 2) startNetworkCheck(2);
        } else if (retryAttempts[5] < 10) {
          if (interval !== 5) startNetworkCheck(5);
        } else {
          clearInterval(retryInterval);
          retryAttempts = { 1: 0, 2: 0, 5: 0 };
        }
      });
  }, interval * 1000);
}

self.addEventListener("message", event => {
  if (event.data.type === "BLUETOOTH_STATUS") {
    isBluetoothConnected = event.data.connected;
    console.log(`Bluetooth status updated: ${isBluetoothConnected}`);
    if (isBluetoothConnected) {
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: "BLUETOOTH_RECONNECT" });
        });
        if (!clients.length) {
          self.registration.showNotification("", { tag: "bluetooth-reconnect", silent: true });
        }
      });
    }
  } else if (event.data.type === "REQUEST_RECONNECT") {
    console.log(`Отримано запит на повторне підключення: ${event.data.reason}`);
    startNetworkCheck(1);
  }
});

// Початок перевірки мережі при втраті з’єднання
self.addEventListener("offline", () => {
  wasOnline = false;
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: "NETWORK_STATUS", online: false });
    });
  });
  startNetworkCheck(1);
});

self.addEventListener("online", () => {
  wasOnline = true;
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: "NETWORK_STATUS", online: true });
      client.postMessage({ type: "NETWORK_RECONNECT" });
    });
  });
  clearInterval(retryInterval);
  retryAttempts = { 1: 0, 2: 0, 5: 0 };
});
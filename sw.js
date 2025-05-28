const CACHE_NAME = "radio-pwa-play-cache-v810";
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

// Змінні для ServiceWorker
let isInitialLoader = true;
let wasOnline = navigator.onLine;
let isPausedDueToBluetooth = false; // Для відстеження паузи через Bluetooth
let retryAttempts = { 1: 0, 2: 0, 5: 0 };
let retryInterval = null;

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
              return caches.match(event.request) || new Response.error();
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
                return cachedResponse || networkResponse;
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
            console.log(`Видалення кешу: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log("Активація нового Service Worker");
      isInitialLoad = true;
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: "UPDATE", message: "Додаток оновлено" });
        });
      });
    }).then(() => self.clients.claim())
  );
});

// Перевірка активності тільки при паузі через Bluetooth
setInterval(() => {
  if (isPausedDueToBluetooth) {
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: "KEEP_ALIVE" });
      });
    });
  }
}, 30000); // Кожні 30 секунд

// Моніторинг мережі
function startNetworkCheck(interval) {
  if (retryInterval) clearInterval(retryInterval);
  retryAttempts[interval]++;
  retryInterval = setInterval(() => {
    fetch("https://www.google.com", { method: "HEAD", mode: "no-cors" })
      .then(() => {
        if (!wasOnline) {
          wasOnline = true;
          self.clients.matchAll().then(clients => {
            clients.forEach(clients => {
              client.postMessage({ type: "NETWORK_STATUS", online: true });
              client.postMessage({ type: "BLUETOOTH_RECONNECT" });
              if (isPausedDueToBluetooth) {
                client.postMessage({ type: "KEEP_ALIVE" });
              }
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
    isPausedDueToBluetooth = event.data.pausedDueToBluetooth; // Оновлюємо стан
    console.log(`Bluetooth Paused Status: ${isPausedDueToBluetooth}`);
    if (event.data.connected) {
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: "BLUETOOTH_RECONNECT" });
          if (client.focus) {
            client.focus();
          }
        });
        if (!clients.length) {
          self.registration.showNotification("", { tag: "bluetooth-reconnect", silent: true });
        }
      });
    }
  } else if (event.data.type === "REQUEST_RESTART") {
    console.log(`Отримано запит: ${event.data.reason}`);
    startNetworkCheck(1);
  } else if (event.data.type === "ACTIVATE_TAB") {
    console.log("Отримано запит на активацію вкладки");
    self.clients.matchAll().then(clients => {
      const client = clients.find(c => c.url.includes("index.html"));
      if (client && client.focus) {
        client.focus();
      }
    });
  }
});

// Початкова перевірка мережі
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
      console.error("Помилка:", error);
      if (wasOnline) {
        wasOnline = false;
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: "NETWORK_STATUS", online: false });
          });
        });
      }
    });
}, 1000);
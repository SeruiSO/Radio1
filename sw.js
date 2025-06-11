const CACHE_NAME = "radio-pwa-cache-v4";
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
let lastBluetoothStatus = localStorage.getItem("isBluetoothConnected") === "true" || false;

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
      console.error("Помилка перевірки мережі:", error);
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

self.addEventListener("message", event => {
  if (event.data.type === "BLUETOOTH_STATUS") {
    const { hasBluetooth, isPlaying, currentIndex, currentTab } = event.data;

    if (hasBluetooth && !lastBluetoothStatus) {
      console.log("Service Worker: Bluetooth підключено, надсилаємо запит на відтворення");
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: "PLAY_REQUEST" });
        });
      });

      self.registration.showNotification("Radio S O", {
        body: "Bluetooth-пристрій підключено! Відкрийте додаток для відтворення.",
        icon: "icon-192.png",
        actions: [
          { action: "open", title: "Відкрити додаток" }
        ]
      });
    } else if (!hasBluetooth && lastBluetoothStatus && isPlaying) {
      console.log("Service Worker: Bluetooth відключено, надсилаємо запит на паузу");
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: "PAUSE_REQUEST" });
        });
      });
    }

    lastBluetoothStatus = hasBluetooth;
    localStorage.setItem("isBluetoothConnected", hasBluetooth);
  }
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  if (event.action === "open") {
    event.waitUntil(
      clients.openWindow("/")
    );
  }
});
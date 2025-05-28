const CACHE_NAME = "radio-pwa-cache-v6";
const urlsToCache = [
  "/",
  "/index.html",
  "/styles.css",
  "/script.js",
  "/stations.json",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log("Caching files:", urlsToCache);
        return cache.addAll(urlsToCache).catch(error => {
          console.error("Caching error:", error);
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
            console.log(`Deleting cache: ${cacheName}`);
            return caches.delete(cacheName).catch(error => {
              console.error(`Error deleting cache ${cacheName}:`, error);
            });
          }
        })
      );
    }).then(() => {
      console.log("Activating new Service Worker");
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: "UPDATE", message: "App updated to new version!" });
        });
      });
    }).then(() => self.clients.claim())
  );
});

// Моніторинг мережі та Bluetooth
let wasOnline = navigator.onLine;
let isBluetoothConnected = false;
let retryAttempts = { 1: 0, 2: 0, 5: 0 };
let retryInterval = null;

function startNetworkCheck(interval) {
  if (retryInterval) clearInterval(retryInterval);
  retryAttempts[interval]++;
  console.log(`Starting network check: interval=${interval}s, attempt ${retryAttempts[interval]}`);
  retryInterval = setInterval(() => {
    fetch("https://www.google.com", { method: "HEAD", mode: "no-cors" })
      .then(() => {
        console.log("Network available");
        wasOnline = true;
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: "NETWORK_STATUS", online: true });
            client.postMessage({ type: "NETWORK_RECONNECT" });
          });
          if (!clients.length) {
            self.registration.showNotification("Network reconnected", { tag: "network-reconnect", silent: true });
          }
        });
        clearInterval(retryInterval);
        retryAttempts = { 1: 0, 2: 0, 5: 0 };
      })
      .catch(() => {
        console.log(`Network check failed: interval=${interval}s, attempt ${retryAttempts[interval]}`);
        if (retryAttempts[1] < 10) {
          if (interval !== 1") startNetworkCheck(1);
        } else if (retryAttempts[2] < 10) {
          if (interval !== 2") startNetworkCheck(2);
        } else if (retryAttempts[5] < 10) {
          console.log("Switching to interval 5s");
          if (interval !== 5") startNetworkCheck(5);
        } else {
          console.log("Max retry attempts reached, stopping network checks");
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
          self.registration.showNotification("Bluetooth reconnected", { tag: "bluetooth-reconnect", silent: true });
        }
      });
    }
  } else if (event.data.type === "REQUEST_RECONNECT") {
    console.log(`Reconnect request received: ${event.data.reason}`);
    startNetworkCheck(1);
  }
});

// Початок перевірки мережі при втраті з’єднання
self.addEventListener("offline", () => {
  console.log("Network offline detected");
  wasOnline = false;
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: "NETWORK_STATUS", online: false });
    });
  });
  startNetworkCheck(1);
});

self.addEventListener("online", () => {
  console.log("Network online detected");
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
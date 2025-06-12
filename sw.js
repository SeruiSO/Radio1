const CACHE_NAME = "vibewave-cache-v3";
const urlsToCache = [
  "/",
  "index.html",
  "styles.css",
  "script.js",
  "stations.json",
  "manifest.json",
  "icon-192.png",
  "icon-512.png",
  "icon-256.png",
  "icon-maskable-192.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
      .catch(error => console.error("Cache installation error:", error))
  );
});

self.addEventListener("fetch", event => {
  if (event.request.url.includes("stations.json")) {
    event.respondWith(
      fetch(event.request, { cache: "no-cache" })
        .then(response => {
          if (!response.ok) throw new Error("Network error");
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => caches.match(event.request) || new Response(JSON.stringify({ error: "Offline" }), {
          status: 503,
          statusText: "Service Unavailable"
        }))
    );
  } else {
    event.respondWith(
      caches.match(event.request)
        .then(response => response || fetch(event.request))
        .catch(() => caches.match("/"))
    );
  }
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log(`Deleting old cache: ${name}`);
            return caches.delete(name);
          })
      )
    ).then(() => self.clients.claim())
  );
});

let wasOnline = navigator.onLine;

setInterval(() => {
  fetch("https://www.google.com", { method: "HEAD", mode: "no-cors" })
    .then(() => {
      if (!wasOnline) {
        wasOnline = true;
        notifyClients({ type: "NETWORK_STATUS", online: true });
      }
    })
    .catch(() => {
      if (wasOnline) {
        wasOnline = false;
        notifyClients({ type: "NETWORK_STATUS", online: false });
      }
    });
}, 2000);

function notifyClients(message) {
  self.clients.matchAll().then(clients =>
    clients.forEach(client => client.postMessage(message))
  );
}
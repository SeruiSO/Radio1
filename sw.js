const STATIC_CACHE_NAME = 'radio-static-v1';
const API_CACHE_NAME = 'radio-api-v1';
const CACHE_VERSION = 'v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== STATIC_CACHE_NAME && name !== API_CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.pathname === '/stations.json') {
    event.respondWith(networkFirst(event.request));
  } else if (STATIC_ASSETS.includes(url.pathname) || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(event.request));
  } else if (url.href.includes('de1.api.radio-browser.info')) {
    event.respondWith(networkFirst(event.request, true));
  } else {
    event.respondWith(fetch(event.request));
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) return cachedResponse;
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return new Response('Офлайн: ресурси недоступні', { status: 503 });
  }
}

async function networkFirst(request, isApi = false) {
  const cache = await caches.open(isApi ? API_CACHE_NAME : STATIC_CACHE_NAME);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const clonedResponse = networkResponse.clone();
      cache.put(request, clonedResponse);
      if (isApi) {
        notifyClients({ type: 'CACHE_UPDATED', cacheVersion: CACHE_VERSION });
      }
      return networkResponse;
    }
    const cachedResponse = await cache.match(request);
    return cachedResponse || new Response('Офлайн: дані недоступні', { status: 503 });
  } catch (error) {
    const cachedResponse = await cache.match(request);
    return cachedResponse || new Response('Офлайн: дані недоступні', { status: 503 });
  }
}

self.addEventListener('sync', event => {
  if (event.tag === 'sync-stations') {
    event.waitUntil(syncStations());
  }
});

async function syncStations() {
  try {
    const cache = await caches.open(API_CACHE_NAME);
    const request = new Request(`stations.json?t=${Date.now()}`);
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      notifyClients({ type: 'CACHE_UPDATED', cacheVersion: CACHE_VERSION });
    }
  } catch (error) {
    console.error('Помилка синхронізації станцій:', error);
  }
}

function notifyClients(message) {
  self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
    clients.forEach(client => client.postMessage(message));
  });
}

self.addEventListener('message', event => {
  if (event.data.type === 'NETWORK_STATUS') {
    if (event.data.online) {
      event.waitUntil(syncStations());
    }
  }
});
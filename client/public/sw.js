const CACHE_NAME = 'wc-tcg-v2';
const STATIC_ASSETS = [
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

function isHtmlRequest(request) {
  if (request.mode === 'navigate') return true;
  const accept = request.headers.get('accept') || '';
  if (accept.includes('text/html')) return true;
  const url = new URL(request.url);
  if (url.pathname === '/' || !/\.[a-zA-Z0-9]+$/.test(url.pathname)) return true;
  return false;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws')) {
    return;
  }

  if (event.request.method !== 'GET') {
    return;
  }

  if (isHtmlRequest(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return new Response(
              '<!doctype html><meta charset="utf-8"><title>Offline</title><h1>Offline</h1>',
              { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            );
          })
        )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => new Response('Offline', { status: 503 }));
    })
  );
});

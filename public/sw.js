// Cache version — increment CACHE_VER on each deploy to bust stale assets
const CACHE_VER = 6;
const CACHE_NAME = `traceworks-v${CACHE_VER}`;

// Shell assets that get cached on install — app shell only, never API data
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/error-handler.js',
  '/favicon.svg',
  '/og-image.svg',
  '/offline.js',
  '/order-shared.js',
  '/dashboard.js',
  '/order-status.js',
  '/success.js',
  '/admin-orders.js',
  '/admin-dashboard.js',
  '/launch-readiness.js',
  '/pwa.js',
  '/packages.js',
  '/packages.html',
  '/contact-sales.html',
  '/dashboard.html',
  '/enterprise.html',
  '/admin-dashboard.html',
  '/launch-readiness.html',
  '/order-status.html',
  '/offline.html',
  '/manifest.json',
  '/robots.txt',
  '/success.html',
  '/cancel.html',
  '/terms.html',
  '/privacy.html',
  '/refund-policy.html',
  '/icons/icon-192.png',
  '/icons/icon-192.svg',
  '/icons/icon-512.png',
  '/icons/icon-512.svg'
];

// Install: cache shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// Activate: remove stale caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - API routes: network-only (never cache)
// - Navigation: network-first, fall back to cached index.html, then offline.html
// - Static assets: cache-first with network revalidation
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept API calls
  if (url.pathname.startsWith('/api/')) return;

  // Navigation requests — network first, offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const index = await caches.match('/index.html');
          if (index) return index;
          return caches.match('/offline.html');
        })
    );
    return;
  }

  // Static assets — cache first, network fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return res;
      });
      return cached || networkFetch;
    })
  );
});

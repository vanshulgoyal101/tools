// Offline-first service worker for tools.vanshul.com.
// The app is a single self-contained page. The static shell is served
// network-first so new deploys show up immediately, with a cache fallback
// that keeps everything fully usable offline after the first visit.
const CACHE = 'tools-v3';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './og.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const isShell = request.mode === 'navigate' ||
    request.destination === 'document' ||
    new URL(request.url).pathname.endsWith('.html');

  if (isShell) {
    // Network-first: latest deploy wins, fall back to cache when offline.
    e.respondWith(
      fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html').then((h) => h || caches.match('./')))
    );
    return;
  }

  // Everything else: cache-first with runtime caching.
  e.respondWith(
    caches.match(request).then((hit) =>
      hit || fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html'))
    )
  );
});

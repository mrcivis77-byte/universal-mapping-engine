const CACHE_NAME = 'yucatan-travel-v3';
const urlsToCache = ['/', '/manifest.json'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(urlsToCache))); });
self.addEventListener('fetch', (e) => { e.respondWith(fetch(e.request)); });

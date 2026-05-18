const CACHE_NAME = 'km-control-v23';
const ASSETS = [
    'index.html',
    'css/styles.css',
    'js/db.js',
    'js/app.js',
    'manifest.json',
    'icons/icon-192x192.png',
    'icons/icon-512x512.png',
    'https://fonts.googleapis.com/icon?family=Material+Icons'
];

// Install Event
self.addEventListener('install', (event) => {
    self.skipWaiting(); // Forzar a que el nuevo SW se active inmediatamente
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

// Activate Event
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
    // No cachear peticiones de sincronización
    if (event.request.url.includes('/.netlify/functions/')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((response) => {
            // Revalidar en segundo plano para assets locales
            const fetchPromise = fetch(event.request).then(networkResponse => {
                if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
                }
                return networkResponse.clone();
            }).catch(() => {});

            return response || fetchPromise;
        })
    );
});

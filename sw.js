const CACHE_NAME = 'study-calendar-v1';
const urlsToCache = [
    '/School_Calendar/',
    '/School_Calendar/styles.css',
    '/School_Calendar/script.js',
    '/School_Calendar/manifest.json',
    '/School_Calendar/icon-192.png',
    '/School_Calendar/icon-512.png'
];


self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('/')
    );
});

const CACHE_NAME = 'wyrd-cache-v5.4';
const urlsToCache = [
  '/',
  '/index.html',
  '/style/wyrd.css',
  '/core/constants.js',
  '/core/utils.js',
  '/core/roomtypes.js',
  '/core/entities.js',
  '/core/mobfactory.js',
  '/core/mapgen.js',
  '/core/renderer.js',
  '/core/ui.js',
  '/core/combat.js',
  '/core/engine.js',
  '/assets/wander/player.png',
  '/assets/wander/rat.png',
  '/assets/wander/goblin.png',
  '/assets/wander/skeleton.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});
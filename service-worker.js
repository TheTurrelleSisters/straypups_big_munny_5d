/*
 * service-worker.js — StrayPups Big Munny $5 PWA
 * v5.28 — update CACHE_VER on every new release
 */
var CACHE_VER  = 'spbm5-v5.28';
var CACHE_URLS = [
  './index.html',
  './css/styles.css?v=5.28',
  './js/config.js?v=5.28',
  './js/game.js?v=5.28',
  './js/operator.js?v=5.28',
  './js/progressive.js?v=5.28',
  './assets/scott_full.png',
  './assets/banner.jpg',
  './assets/splash.jpg',
  './assets/credits_addup.wav',
  './assets/red_spin_music.mp3',
  './assets/ring1.mp3',
  './assets/splash_welcome.wav'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_VER).then(function(cache) {
      return cache.addAll(CACHE_URLS);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(key) {
        if (key !== CACHE_VER) return caches.delete(key);
      }));
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(e) {
  // Always network-first for Supabase API calls
  if (e.request.url.indexOf('supabase.co') !== -1 ||
      e.request.url.indexOf('jsdelivr.net') !== -1) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      return cached || fetch(e.request).catch(function() { return cached; });
    })
  );
});

var CACHE = 'spbm-v594';
var FILES = [
  './',
  './index.html',
  './css/styles.css',
  './js/config.js',
  './js/game.js',
  './js/operator.js',
  './js/progressive.js',
  './wabc.js',
  './broadcast-init.js',
  './assets/splash.jpg',
  './assets/banner.jpg',
  './assets/symbols/progressive_jackpot.png',
  './assets/icons/icon-192x192.png',
  './assets/icons/icon-512x512.png',
  './assets/credits_addup.wav',
  './assets/red_spin_music.mp3',
  './assets/ring1.mp3',
  './assets/splash_welcome.wav'
];
self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){ return c.addAll(FILES); })
  );
  self.skipWaiting();
});
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k!==CACHE; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});
self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  var url = e.request.url;
  if (url.indexOf('supabase.co') !== -1) return;
  if (url.indexOf('.js')          !== -1 ||
      url.indexOf('.html')        !== -1 ||
      url.indexOf('jsdelivr.net') !== -1 ||
      url.indexOf('cdn.')         !== -1) {
    e.respondWith(
      fetch(e.request)
        .then(function(resp) {
          if (resp && resp.status !== 206) {
            var clone = resp.clone();
            caches.open(CACHE).then(function(cache) { cache.put(e.request, clone); });
          }
          return resp;
        })
        .catch(function() { return caches.match(e.request); })
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      return cached || fetch(e.request).then(function(resp) {
        if (resp && resp.status !== 206) {
          var clone = resp.clone();
          caches.open(CACHE).then(function(cache) { cache.put(e.request, clone); });
        }
        return resp;
      });
    })
  );
});

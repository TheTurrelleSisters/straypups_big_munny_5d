var CACHE = 'spbm5d-v6.16.2';
var FILES = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/paytable.js',
  './js/config.js',
  './js/game.js',
  './js/operator.js',
  './js/progressive.js',
  './wabc.js',
  './broadcast-init.js',
  './assets/splash.jpg',
  './assets/banner.jpg',
  './assets/scott_full.png',
  
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
    caches.open(CACHE).then(function(c){
      /* Non-fatal pre-cache: a missing asset (404 on GitHub Pages) must not
         block SW install and leave the game unloadable. */
      return c.addAll(FILES).catch(function(err){
        console.warn('[SW] Pre-cache failed (non-fatal):', err);
      });
    }).then(function(){ self.skipWaiting(); })
  );
});
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k!==CACHE; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ self.clients.claim(); })
  );
});
self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  var url = e.request.url;
  if (url.indexOf('supabase.co') !== -1) return;
  if (url.indexOf('.js')   !== -1 ||
      url.indexOf('.html') !== -1) {
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

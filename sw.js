var CACHE = 'spbm-v528';
var FILES = [
  './',
  './index.html',
  './css/styles.css',
  './js/config.js',
  './js/game.js',
  './js/operator.js',
  './js/progressive.js',
  './progressive.js',
  './assets/splash.jpg',
  './assets/banner.jpg',
  './icon-192.png',
  './icon-512.png',
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
self.addEventListener('fetch', function(e){
  e.respondWith(
    caches.match(e.request).then(function(r){
      return r || fetch(e.request).catch(function(){ return caches.match('./index.html'); });
    })
  );
});

/* service-worker.js — StrayPups Big Munny $5 — v5.28d
 * CACHE STRATEGY: Network-first for JS/HTML, cache-first for assets
 * Bump CACHE_VER on every release to force fresh load
 */
var CACHE_VER = 'spbm5-v5.28e';
var JS_FILES  = ['/js/', '.js'];
var HTML_FILES = ['index.html', '/'];

self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_VER).then(function(cache) {
      return cache.addAll([
        './index.html',
        './css/styles.css?v=5.28',
        './assets/scott_full.png',
        './assets/banner.jpg',
        './assets/splash.jpg',
        './assets/credits_addup.wav',
        './assets/red_spin_music.mp3',
        './assets/ring1.mp3',
        './assets/splash_welcome.wav'
      ]).catch(function(e){ console.warn('SW cache failed:', e); });
    })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(key) {
        if (key !== CACHE_VER) {
          console.log('[SW] Deleting old cache:', key);
          return caches.delete(key);
        }
      }));
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  var url = e.request.url;
  /* Always network for JS, HTML, Supabase, CDN */
  if (url.indexOf('.js') !== -1 || 
      url.indexOf('supabase.co') !== -1 ||
      url.indexOf('jsdelivr.net') !== -1 ||
      url.indexOf('index.html') !== -1) {
    e.respondWith(
      fetch(e.request).catch(function() {
        return caches.match(e.request);
      })
    );
    return;
  }
  /* Cache-first for images/audio */
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      return cached || fetch(e.request).then(function(resp) {
        var clone = resp.clone();
        caches.open(CACHE_VER).then(function(cache){ cache.put(e.request, clone); });
        return resp;
      });
    })
  );
});

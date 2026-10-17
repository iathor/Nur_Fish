const CACHE_VERSION = 'v2';
const TILE_CACHE = `map-tiles-${CACHE_VERSION}`;
const ASSET_CACHE = `app-assets-${CACHE_VERSION}`;

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== TILE_CACHE && k !== ASSET_CACHE).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. СТРОГИЙ БАЙПАС: Игнорируем запросы к внешним API (погода, карты, геокодер)
  // Они всегда должны идти напрямую через сеть, SW не вмешивается!
  if (url.hostname.includes('open-meteo.com') || 
      url.hostname.includes('maps.mail.ru') || 
      url.hostname.includes('bigdatacloud.net')) {
    return; 
  }

  // 2. Кэширование тайлов карт - Cache First
  if (url.pathname.includes('/tile/') || url.pathname.includes('/rastertiles/') || url.hostname.includes('openstreetmap.de')) {
    event.respondWith(
      caches.open(TILE_CACHE).then(cache => {
        return cache.match(event.request).then(response => {
          if (response) return response;
          return fetch(event.request).then(networkResponse => {
            if (networkResponse.ok) cache.put(event.request, networkResponse.clone());
            return networkResponse;
          }).catch(() => new Response('', { status: 404 }));
        });
      })
    );
    return;
  }

  // 3. Кэширование картинок рыб и скриптов Leaflet - Stale-While-Revalidate
  if (url.hostname.includes('yastatic.net') || url.pathname.includes('.png')) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(cache => {
        return cache.match(event.request).then(cachedRes => {
          const fetchPromise = fetch(event.request).then(networkRes => {
            if (networkRes.ok) cache.put(event.request, networkRes.clone());
            return networkRes;
          }).catch(() => null);
          return cachedRes || fetchPromise;
        });
      })
    );
    return;
  }
});

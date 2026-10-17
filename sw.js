const CACHE_VERSION = 'v1';
const TILE_CACHE = `map-tiles-${CACHE_VERSION}`;
const ASSET_CACHE = `app-assets-${CACHE_VERSION}`;

self.addEventListener('install', event => {
  self.skipWaiting(); // Активируем сразу
});

self.addEventListener('activate', event => {
  // Удаляем старые версии кэшей при обновлении SW
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== TILE_CACHE && k !== ASSET_CACHE).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. Кэширование тайлов карт (ArcGIS, OSM, CartoDB) - Стратегия "Cache First"
  if (url.pathname.includes('/tile/') || url.pathname.includes('/rastertiles/') || url.hostname.includes('openstreetmap.de')) {
    event.respondWith(
      caches.open(TILE_CACHE).then(cache => {
        return cache.match(event.request).then(response => {
          if (response) return response; // Отдаем из кэша мгновенно (даже без интернета)
          
          return fetch(event.request).then(networkResponse => {
            // Если скачали новый тайл успешно - сохраняем в кэш на будущее
            if (networkResponse.ok) cache.put(event.request, networkResponse.clone());
            return networkResponse;
          }).catch(() => new Response('', { status: 404 })); // Заглушка, если оффлайн и тайла нет
        });
      })
    );
    return;
  }

  // 2. Кэширование Leaflet JS/CSS и картинок рыб - Стратегия "Stale-While-Revalidate"
  if (url.hostname.includes('yastatic.net') || url.pathname.includes('.png')) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(cache => {
        return cache.match(event.request).then(cachedRes => {
          const fetchPromise = fetch(event.request).then(networkRes => {
            if (networkRes.ok) cache.put(event.request, networkRes.clone());
            return networkRes;
          }).catch(() => null);
          
          return cachedRes || fetchPromise; // Если есть кэш - отдаем сразу, а в фоне обновляем
        });
      })
    );
    return;
  }

  // API погоды (Open-Meteo) пропускаем напрямую, их кэшировать в SW не нужно
});

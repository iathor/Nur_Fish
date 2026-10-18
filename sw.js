const CACHE_VERSION = 'v6.1';
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
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // 1. СТРОГИЙ БАЙПАС: Метео, геокодеры и Overpass API всегда идут напрямую
  if (url.hostname.includes('open-meteo.com') || 
      url.hostname.includes('overpass-api.de') || 
      url.hostname.includes('maps.mail.ru') || 
      url.hostname.includes('bigdatacloud.net')) {
    return; 
  }

  // 2. Кэширование тайлов всех 4 слоев карт - Cache First
  if (url.hostname.includes('opentopomap.org') ||
      url.hostname.includes('arcgisonline.com') ||
      url.hostname.includes('cartocdn.com') ||
      url.hostname.includes('openstreetmap.org') ||
      url.hostname.includes('openstreetmap.de')) {
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

  // 3. Кэширование картинок рыб, иконки и статики Leaflet - Stale-While-Revalidate
  if (url.hostname.includes('yastatic.net') || 
      url.hostname.includes('jsdelivr.net') || 
      (url.origin === self.location.origin && (url.pathname.endsWith('.png') || url.pathname.endsWith('.svg') || url.pathname.endsWith('manifest.json')))) {
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

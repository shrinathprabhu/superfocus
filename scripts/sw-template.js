/* SuperFocus offline worker. The asset list and version are injected at build time. */
const CACHE = '__CACHE_NAME__';
const ASSETS = __ASSET_LIST__;
const APP_PATHS = new Set(['/', '/superfocus', '/superfocus/']);
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // All ten included audio files are installed, so offline shuffle never requests an absent track.
      for (let i = 0; i < ASSETS.length; i += 8)
        await Promise.all(
          ASSETS.slice(i, i + 8).map(async (path) => {
            const response = await fetch(
              new Request(path, { cache: 'reload' }),
            );
            if (
              !response.ok ||
              (APP_PATHS.has(path) &&
                !response.headers.get('content-type')?.includes('text/html'))
            )
              throw Error('Offline setup incomplete');
            await cache.put(path, response);
          }),
        );
      // Existing clients keep their worker until they close; a new installation activates immediately.
    })(),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys())
        if (name.startsWith('superfocus-offline-') && name !== CACHE)
          await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});
self.addEventListener('fetch', (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // RSC responses must never overwrite an HTML navigation cache entry.
  if (request.headers.has('rsc') || url.searchParams.has('_rsc')) return;
  if (request.mode === 'navigate' && APP_PATHS.has(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        // Keep the shell and its hashed chunks on the same version until the
        // waiting worker activates. Network-first HTML could reference newer
        // chunks that this active worker has not cached for offline use.
        const cached =
          (await cache.match(url.pathname)) ||
          (await cache.match('/superfocus'));
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (
            response.ok &&
            !response.redirected &&
            response.headers.get('content-type')?.includes('text/html')
          )
            await cache.put(url.pathname, response.clone());
          return response;
        } catch {
          return (
            (await cache.match(url.pathname)) ||
            (await cache.match('/superfocus')) ||
            Response.error()
          );
        }
      })(),
    );
    return;
  }
  if (!ASSETS.includes(url.pathname)) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE),
        cached = await cache.match(url.pathname);
      if (!cached) return fetch(request);
      const range = request.headers.get('range');
      // HTML audio uses byte-range requests, including while completely offline.
      if (range) {
        const bytes = await cached.arrayBuffer(),
          match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match)
          return new Response(null, {
            status: 416,
            headers: { 'Content-Range': `bytes */${bytes.byteLength}` },
          });
        const start = match[1]
          ? Number(match[1])
          : Math.max(0, bytes.byteLength - Number(match[2]));
        let end =
          match[1] && match[2] ? Number(match[2]) : bytes.byteLength - 1;
        end = Math.min(end, bytes.byteLength - 1);
        if (
          !Number.isSafeInteger(start) ||
          !Number.isSafeInteger(end) ||
          start > end ||
          start >= bytes.byteLength
        )
          return new Response(null, {
            status: 416,
            headers: { 'Content-Range': `bytes */${bytes.byteLength}` },
          });
        const headers = new Headers(cached.headers);
        headers.set(
          'Content-Range',
          `bytes ${start}-${end}/${bytes.byteLength}`,
        );
        headers.set('Content-Length', String(end - start + 1));
        headers.set('Accept-Ranges', 'bytes');
        return new Response(bytes.slice(start, end + 1), {
          status: 206,
          headers,
        });
      }
      return cached;
    })(),
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      for (const client of await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })) {
        if (APP_PATHS.has(new URL(client.url).pathname)) {
          await client.focus();
          return;
        }
      }
      await self.clients.openWindow('/superfocus');
    })(),
  );
});

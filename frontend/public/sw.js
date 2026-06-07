const CACHE = 'tracksy-v5';
const PRECACHE = ['/', '/index.html'];
const SHARE_CACHE = 'tracksy-shared';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== SHARE_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // ── Web Share Target: Paytm/GPay "Share → Tracksy" lands here ──
  if (e.request.method === 'POST' && url.pathname === '/share-receipt') {
    e.respondWith((async () => {
      try {
        const form = await e.request.formData();
        const file = form.get('receipt');
        if (file) {
          const cache = await caches.open(SHARE_CACHE);
          // Stash the shared image so the app page can pick it up
          await cache.put('/__shared_receipt',
            new Response(file, { headers: { 'Content-Type': file.type || 'image/jpeg' } }));
        }
      } catch (_) {}
      // Redirect into the app which reads the stashed image
      return Response.redirect('/import?shared=1', 303);
    })());
    return;
  }

  // API calls — never cache
  if (url.pathname.startsWith('/api/')) return;

  // Network-first with cache fallback
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.status === 200 && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

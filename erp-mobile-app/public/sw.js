/* Minimal service worker: cache app shell, API calls not cached. Works at / or /m/ */
const CACHE = 'erp-mobile-v1';
const BASE = self.location.pathname.replace(/\/sw\.js$/, '').replace(/\/?$/, '') || '';

self.addEventListener('install', (e) => {
  const urls = [BASE + '/index.html', BASE + '/manifest.webmanifest'];
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(urls)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (u.pathname.startsWith('/auth/') || u.pathname.startsWith('/rest/') ||
      u.pathname.startsWith('/realtime/') || u.pathname.startsWith('/storage/') ||
      u.origin.includes('supabase.dincouture.pk')) {
    return;
  }
  const fallback = BASE + '/index.html';
  e.respondWith(
    fetch(e.request).then((r) => {
      if (r.ok && e.request.method === 'GET' && !u.pathname.startsWith('/auth') && !u.pathname.startsWith('/rest')) {
        const clone = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
      }
      return r;
    }).catch(() =>
      caches.match(e.request).then((r) => r || caches.match(fallback))
    )
  );
});

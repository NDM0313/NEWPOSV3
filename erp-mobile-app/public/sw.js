/* Minimal service worker: cache app shell, API calls not cached. Works at / or /m/ */
const CACHE = 'erp-mobile-v3'; // Incremented cache version
const BASE = self.location.pathname.replace(/\/sw\.js$/, '').replace(/\/?$/, '') || '';

const APP_SHELL = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.webmanifest',
  BASE + '/icons/icon-192.png',
  BASE + '/icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) => 
      Promise.all(APP_SHELL.map(url => 
        c.add(url).catch(err => console.warn(`[SW] Initial cache skip ${url}:`, err))
      ))
    )
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const u = new URL(e.request.url);
  // Do not cache API, Auth, Storage, or Realtime calls
  const isInternal = u.origin === self.location.origin;
  const isExternalApi = u.origin.includes('supabase.dincouture.pk');
  
  if (isExternalApi || u.pathname.includes('/auth/') || u.pathname.includes('/rest/') || 
      u.pathname.includes('/storage/') || u.pathname.includes('/realtime/')) {
    return;
  }

  // Cache-First strategy for App Shell, Network-First (with cache fallback) for others
  const isAppShell = APP_SHELL.some(path => u.pathname.endsWith(path));

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse && isAppShell) {
        return cachedResponse;
      }

      return fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.ok && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE).then((c) => {
             c.put(e.request, clone).catch(() => {});
          });
        }
        return networkResponse;
      }).catch(() => {
        return cachedResponse || (isInternal ? caches.match(BASE + '/index.html') : null);
      });
    })
  );
});

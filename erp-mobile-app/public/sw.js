/* Minimal service worker: network-first app shell so redeploys don't stick on dead JS hashes. */
const CACHE = 'erp-mobile-v7';
const BASE = self.location.pathname.replace(/\/sw\.js$/, '').replace(/\/?$/, '') || '';

const APP_SHELL = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.webmanifest',
  BASE + '/icons/icon-192.png',
  BASE + '/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(
        APP_SHELL.map((url) =>
          c.add(url).catch((err) => console.warn(`[SW] Initial cache skip ${url}:`, err)),
        ),
      ),
    ),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isAppShellRequest(request, u) {
  if (request.mode === 'navigate') return true;
  if (u.pathname.endsWith('/index.html')) return true;
  if (u.pathname === BASE || u.pathname === BASE + '/') return true;
  return APP_SHELL.some((path) => u.pathname.endsWith(path));
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const u = new URL(e.request.url);
  const isInternal = u.origin === self.location.origin;
  const isExternalApi = u.origin.includes('api.ndmcore.com');

  if (
    isExternalApi ||
    u.pathname.includes('/auth/') ||
    u.pathname.includes('/rest/') ||
    u.pathname.includes('/storage/') ||
    u.pathname.includes('/realtime/')
  ) {
    return;
  }

  const shell = isAppShellRequest(e.request, u);

  e.respondWith(
    (async () => {
      // Network-first for HTML/shell so Safari bookmarks pick up new hashed assets after redeploy.
      if (shell) {
        try {
          const networkResponse = await fetch(e.request);
          if (networkResponse && networkResponse.ok && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE).then((c) => {
              c.put(e.request, clone).catch(() => {});
            });
          }
          return networkResponse;
        } catch {
          const cached = await caches.match(e.request);
          return cached || (isInternal ? caches.match(BASE + '/index.html') : null);
        }
      }

      const cachedResponse = await caches.match(e.request);
      try {
        const networkResponse = await fetch(e.request);
        if (networkResponse && networkResponse.ok && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE).then((c) => {
            c.put(e.request, clone).catch(() => {});
          });
        }
        return networkResponse;
      } catch {
        return cachedResponse || (isInternal ? caches.match(BASE + '/index.html') : null);
      }
    })(),
  );
});

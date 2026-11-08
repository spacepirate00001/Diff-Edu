// Offline shell: app files are cached; data (Supabase) is never cached by the service worker,
// the app keeps its own last-seen copy in localStorage instead.
const V = 'diffedu-pwa-v5';
const SHELL = ['./', 'index.html', 'app.js', 'family.js', 'teacher.js', 'style.css', 'manifest.webmanifest', 'icons.js', 'logo.svg', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // network first so updates show up; fall back to cache when offline
  e.respondWith(
    fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(V).then(c => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./')))
  );
});

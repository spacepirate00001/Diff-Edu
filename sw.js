// Offline shell: app files are cached; data (Supabase) is never cached by the service worker,
// the app keeps its own last-seen copy in localStorage instead.
const V = 'diffedu-pwa-v17';
const SHELL = ['./', 'index.html', 'app.js', 'guide.js', 'family.js', 'search.js', 'teacher.js', 'office.js', 'play.js', 'comms.js', 'classroom.js', 'extras.js', 'reports.js', 'people.js', 'profile.js', 'style.css', 'manifest.webmanifest', 'icons.js', 'logo.svg', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  // cache: 'reload' so a new version never installs files left in the browser's HTTP cache
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // network first (revalidated, never a stale HTTP-cache copy) so updates show up; cache only when offline
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(r => {
      const copy = r.clone();
      caches.open(V).then(c => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./')))
  );
});

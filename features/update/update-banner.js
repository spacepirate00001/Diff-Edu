// P16: the app has its own service worker (sw.js, cache diffedu-next-vN). A new version waits until the person says "এখন নিন";
// the page never reloads by itself, so work in progress is safe. The app is served from the site root.
import { h } from '../../ui/dom.js';
import { store } from '../../core/store.js';
import { cache } from '../../core/cache.js';
import { outbox } from '../../core/outbox-app.js';

let reg = null, reloading = false;
export function mountUpdate(root, { fakeShow = false } = {}) {
  let dismissed = false;
  const show = (apply) => {
    if (dismissed) return;
    root.replaceChildren(h('div', { class: 'de-banner de-banner--info update-banner', role: 'status' }, h('span', { class: 'de-banner__text', text: 'নতুন সংস্করণ তৈরি আছে।' }),
      h('span', { class: 'offline-banner__acts' },
        h('button', { class: 'de-savebar__action', type: 'button', onclick: apply, text: 'এখন নিন' }),
        h('button', { class: 'de-savebar__action', type: 'button', onclick: () => { dismissed = true; root.replaceChildren(); }, text: 'পরে' }))));
  };
  const apply = () => { if (reg?.waiting) { reloading = true; reg.waiting.postMessage('SKIP_WAITING'); } else location.reload(); };
  if (fakeShow) show(() => root.replaceChildren());
  if (!('serviceWorker' in navigator) || ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('nosw')) return;
  navigator.serviceWorker.register('sw.js', { scope: './' }).then(r => {
    reg = r;
    const check = () => { if (r.waiting && navigator.serviceWorker.controller) show(apply); };
    r.addEventListener('updatefound', () => { const w = r.installing; w?.addEventListener('statechange', () => { if (w.state === 'installed') check(); }); });
    check();
    // look for a new version when the app comes back to the front (never while offline: the browser just fails quietly)
    document.addEventListener('visibilitychange', () => { if (!document.hidden && navigator.onLine) r.update().catch(() => {}); });
  }).catch(() => { /* no offline shell: the app still works online */ });
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) location.reload(); });
}
// "আরও → অ্যাপ রিফ্রেশ করুন": drop this app's cached files and copies, keep the outbox, then start fresh.
export async function refreshApp() {
  try { const ks = await caches.keys(); await Promise.all(ks.filter(k => k.startsWith('diffedu-next-')).map(k => caches.delete(k))); } catch { /* ignore */ }
  try { const rs = await navigator.serviceWorker?.getRegistrations(); await Promise.all((rs || []).filter(r => r.scope.startsWith(location.origin)).map(r => r.unregister())); } catch { /* ignore */ }
  cache.clear();
  location.reload();
}
export { store, outbox };

// The app shell (spec P11): top bar, banners, the page (scrolls), save strip, update strip, 4 bottom tabs.
// Tabs come from roles/tabs.js only. Pages swap inside <main>; the rest stays.
import { h, announce } from '../ui/dom.js';
import { appbar } from '../ui/appbar.js';
import { bottomNav } from '../ui/bottomnav.js';
import { bn } from '../core/bn.js';
import { icon } from '../ui/icons.js';
import { mountBanner } from '../features/offline/banner.js';
import { mountUpdate } from '../features/update/update-banner.js';

export function createShell(root, ctx, { fakeUpdate = false } = {}) {
  const top = h('div', { class: 'shell-top' });
  const banners = h('div', { id: 'banners', class: 'banners' });
  const main = h('main', { class: 'v6-body shell-main', id: 'main', tabindex: '-1' });
  const savebar = h('div', { id: 'savebar', class: 'savebar-slot' });
  const update = h('div', { id: 'update', class: 'update-slot' });
  const navSlot = h('div', { class: 'nav-slot' });
  const screen = h('div', { class: 'de-screen tg-screen v6 shell', 'data-role': ctx.me.role }, top, banners, main, savebar, update, navSlot);
  root.replaceChildren(screen);
  const stopBanner = mountBanner(banners);
  mountUpdate(update, { fakeShow: fakeUpdate });
  let page = null, tabId = null;

  const paintBells = () => {
    const n = ctx.unread();
    document.querySelectorAll('.bell').forEach(b => {
      b.setAttribute('aria-label', n ? `ইনবক্স, ${bn(n)}টা নতুন` : 'ইনবক্স');
      b.querySelector('.bell__n')?.remove();
      if (n) b.append(h('span', { class: 'de-badge bell__n', 'aria-hidden': 'true', text: bn(n > 99 ? '99+' : n) }));
    });
    if (tabId) navSlot.replaceChildren(bottomNav(ctx.me.role, tabId, ctx.goTab, ['guardian', 'teacher'].includes(ctx.me.role) ? { inbox: n } : {}));
  };
  return {
    // result: { node, destroy?, chrome? }.  opts: { title, tab, back }
    show(result, { title, tab, back }) {
      try { page?.destroy?.(); } catch { /* a page that cannot clean up must not block the next one */ }
      page = result; tabId = tab;
      top.replaceChildren();
      if (result.chrome !== 'sky') top.append(appbar({ title, back, onBack: ctx.back, onSearch: ctx.openSearch, onBell: ctx.openInbox, unread: ctx.unread() }));
      main.replaceChildren(h('div', { class: result.chrome === 'sky' ? 'page page--sky' : 'page' }, result.node));
      main.scrollTop = 0;
      navSlot.replaceChildren(bottomNav(ctx.me.role, tab, ctx.goTab, ['guardian', 'teacher'].includes(ctx.me.role) ? { inbox: ctx.unread() } : {}));
      result.onMount?.();
      announce(title);
      (document.getElementById('page-title') || main).focus?.({ preventScroll: true });
    },
    paintBells,
    destroy() { try { page?.destroy?.(); } catch { /* ignore */ } stopBanner(); },
    main,
  };
}
export { icon };

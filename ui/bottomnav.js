// Bottom tab bar from roles/tabs.js: icon + word, the current tab has a filled pill and bold word (not colour alone).
import { h } from './dom.js';
import { icon } from './icons.js';
import { tabsFor } from '../roles/tabs.js';
import { bn } from '../core/bn.js';

// badges: { <tabId>: count }
export function bottomNav(role, current, onGo, badges = {}) {
  return h('nav', { class: 'de-bottomnav', 'aria-label': 'প্রধান মেনু' }, ...tabsFor(role).map(t => {
    const n = badges[t.id] || 0;
    const on = t.id === current;
    return h('button', { class: 'de-bottomnav__item' + (on ? ' is-on' : ''), type: 'button', 'aria-current': on ? 'page' : null, 'data-tab': t.id,
      'aria-label': n ? `${t.name}, ${bn(n)}টা নতুন` : null, onclick: () => onGo(t.id) },
    icon(t.icon), h('span', { text: t.name }), n ? h('span', { class: 'de-bottomnav__badge', 'aria-hidden': 'true', text: bn(n) }) : null);
  }));
}

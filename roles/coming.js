// An empty tab (spec P11): one line of what comes, which step brings it, and the plan's feature names (words only, not tappable).
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { bn } from '../core/bn.js';
import { features } from '../core/features.js';
import { tabById } from './tabs.js';
import { featuresFor, visible } from '../features/search/registry.js';
import { childBar, noKidsCard } from '../features/switcher/child-switcher.js';
import { kids } from '../core/children.js';

export function comingTab(ctx, tabId, { withKids = false } = {}) {
  const tab = tabById(ctx.me.role, tabId);
  const list = featuresFor(ctx.me.role, tabId).filter(f => visible(f, features));
  const root = h('div', { class: 'coming-tab' });
  if (withKids) {
    const bar = childBar();
    if (bar) root.append(bar); else if (!kids.list().length) return { node: h('div', { class: 'coming-tab' }, noKidsCard()) };
  }
  const step = list.length ? Math.min(...list.map(f => f.step)) : null;
  root.append(h('section', { class: 'de-card coming-card' },
    h('span', { class: 'coming-ic', 'aria-hidden': 'true' }, icon(tab.icon)),
    h('h2', { class: 'de-row__title', text: tab.name }), h('p', { class: 'de-row__sub', text: tab.blurb }),
    h('p', { class: 'coming-step', text: step ? `এই অংশ ধাপ ${bn(step)}-এ আসছে।` : 'এই অংশ শিগগিরই আসছে।' }),
    list.length ? h('ul', { class: 'coming__list' }, ...list.map(f => h('li', { 'aria-disabled': 'true' }, h('span', { text: f.name }), h('span', { class: 'coming__step', text: `ধাপ ${bn(f.step)}` })))) : null));
  return { node: root };
}

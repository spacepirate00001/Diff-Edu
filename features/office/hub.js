// The admin's "অফিস" tab: what is live (fees, honorarium, admissions, notices) and, in words only, what is still to come.
import { h } from '../../ui/dom.js';
import { navRow } from '../../ui/navrow.js';
import { bn } from '../../core/bn.js';
import { features } from '../../core/features.js';
import { featuresFor, visible, routeOf, LIVE_ROUTES } from '../search/registry.js';

export function officeTab(ctx) {
  const list = featuresFor('admin', 'office').filter(f => visible(f, features));
  const live = list.filter(f => routeOf(f, 'admin')), soon = list.filter(f => !routeOf(f, 'admin'));
  const root = h('div', { class: 'more' });
  if (live.length) root.append(h('section', { class: 'more-group' }, h('h2', { class: 'inbox-group__h', text: 'অফিসের কাজ' }),
    h('div', { class: 'de-card more-card' }, ...live.map(f => navRow({ ic: LIVE_ROUTES[f.id][1], text: f.name, onclick: () => ctx.go(routeOf(f, 'admin')) })))));
  if (soon.length) root.append(h('section', { class: 'more-group' }, h('h2', { class: 'inbox-group__h', text: 'আসছে' }),
    h('div', { class: 'de-card more-card' }, ...soon.map(f => navRow({ ic: 'file', text: f.name, sub: `ধাপ ${bn(f.step)}-এ আসছে`, disabled: true })))));
  return { node: root };
}

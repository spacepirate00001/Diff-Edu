// Top bar (spec P11): logo + title (or a back arrow on inner pages), search and inbox bell on the right.
import { h } from './dom.js';
import { icon } from './icons.js';
import { bn } from '../core/bn.js';

export function appbar({ title, sub, back, onBack, onSearch, onBell, unread = 0 }) {
  const left = back
    ? h('button', { class: 'de-appbar__back', type: 'button', 'aria-label': 'পিছনে যান', onclick: onBack }, icon('back'))
    : h('span', { class: 'de-brandbar__logo appbar-logo', 'aria-hidden': 'true' }, h('img', { src: 'ui/assets/diff-edu-logo.svg', alt: '', width: '22', height: '29' }));
  const acts = [];
  if (onSearch) acts.push(h('button', { class: 'de-appbar__action', type: 'button', 'aria-label': 'খোঁজা', onclick: onSearch }, icon('search')));
  if (onBell) acts.push(bell(onBell, unread));
  return h('header', { class: 'de-appbar ab' }, left,
    h('div', { class: 'de-appbar__titles' }, h('h1', { class: 'de-appbar__title ab-title', id: 'page-title', tabindex: '-1', text: title }), sub ? h('span', { class: 'de-appbar__sub', text: sub }) : null), ...acts);
}
export function bell(onBell, unread) {
  return h('button', { class: 'de-appbar__action bell', type: 'button', onclick: onBell, 'aria-label': unread ? `ইনবক্স, ${bn(unread)}টা নতুন` : 'ইনবক্স' },
    icon('bell'), unread ? h('span', { class: 'de-badge bell__n', 'aria-hidden': 'true', text: bn(unread > 99 ? '99+' : unread) }) : null);
}

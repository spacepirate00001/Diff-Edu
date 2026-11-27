// Layout pieces for pages outside the app shell (welcome, login, admission, new PIN, consent, search).
import { h } from './dom.js';
import { icon } from './icons.js';

// tone: 'deep' (plum, login and PIN) or 'cream' (the page colour)
export function fullPage({ tone = 'cream', title, back, onBack, children = [], label }) {
  return h('div', { class: 'de-screen full full--' + tone, 'data-page': label || null },
    h('div', { class: 'full__bar' },
      back ? h('button', { class: 'de-appbar__back full__back', type: 'button', 'aria-label': 'পিছনে যান', onclick: onBack }, icon('back')) : h('span', { class: 'full__spacer' }),
      h('span', { class: 'full__logo', 'aria-hidden': 'true' }, h('img', { src: 'ui/assets/diff-edu-logo.svg', alt: '', width: '22', height: '29' }))),
    h('main', { class: 'full__body' }, title ? h('h1', { class: 'full__title', id: 'page-title', tabindex: '-1', text: title }) : null, ...children));
}

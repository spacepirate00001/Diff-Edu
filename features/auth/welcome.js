// P3: welcome. Sky with ডিফি (sun or moon by the clock, no network needed), then two choices.
import { h } from '../../ui/dom.js';

export function welcome(ctx) {
  const sky = h('header', { class: 'v6-sky welcome-sky', id: 'v6-sky', 'data-phase': 'morning' },
    h('i', { class: 'v6-stars', 'aria-hidden': 'true' }), h('i', { class: 'v6-cloud v6-cloud--a', 'aria-hidden': 'true' }), h('i', { class: 'v6-cloud v6-cloud--b', 'aria-hidden': 'true' }), h('i', { class: 'v6-cloud v6-cloud--c', 'aria-hidden': 'true' }),
    h('i', { class: 'v6-rain', 'aria-hidden': 'true' }), h('i', { class: 'v6-fog', 'aria-hidden': 'true' }), h('i', { class: 'v6-flash', 'aria-hidden': 'true' }),
    h('div', { class: 'welcome-logo' }, h('span', { class: 'v6-logo' }, h('img', { src: 'ui/assets/diff-edu-logo.svg', alt: '', width: '22', height: '29' })),
      h('span', { class: 'v6-brand__t' }, h('b', { text: 'Diff Edu' }), h('span', { text: 'SINCE ২০০৯' }))),
    h('p', { class: 'v6-greet', id: 'v6-greet' }), h('p', { class: 'v6-wx', id: 'v6-wx', hidden: true }),
    h('div', { class: 'v7-stage', id: 'v7-stage', 'aria-hidden': 'true' },
      h('svg', { class: 'v7-track', viewBox: '0 0 100 132', preserveAspectRatio: 'none', focusable: 'false' }, h('path', { id: 'v7-track', 'vector-effect': 'non-scaling-stroke' })),
      h('i', { class: 'v6-orb v6-sun', id: 'v6-sun' }), h('i', { class: 'v6-orb v6-moon', id: 'v6-moon' }),
      h('span', { class: 'welcome-diffy', 'data-diffy': 'cheering' })));
  const node = h('div', { class: 'de-screen tg-screen v6 welcome' }, h('main', { class: 'v6-body welcome-body' }, sky,
    h('div', { class: 'welcome-copy' },
      h('h1', { class: 'welcome-title', id: 'page-title', tabindex: '-1', text: 'Every child is Different.' }),
      h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: () => ctx.go('/login'), text: 'লগইন করুন' }),
      h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: () => ctx.go('/admission'), text: 'ভর্তির খোঁজ নিন' }),
      h('p', { class: 'welcome-line', text: 'অভিভাবক, শিক্ষার্থী ও শিক্ষক—সবার জন্য একটাই অ্যাপ।' }))));
  const diffy = node.querySelector('[data-diffy]');
  const mount = () => { if (window.Diffy && diffy && !diffy.firstChild) diffy.appendChild(window.Diffy.make('cheering', 'de-mascot--lg')); };
  const t = setTimeout(mount, 400);   // the sprite loads once; paint again if it was not ready
  return { node, onMount() { window.TodayV7.paintSky(''); mount(); }, destroy() { clearTimeout(t); } };
}

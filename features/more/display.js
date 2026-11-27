// P2: text size and colours, kept on this phone (core/prefs.js). Applies the moment a choice is made. Also the one-time size sheet after first login.
import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { openSheet } from '../../ui/sheet.js';
import { prefs } from '../../core/prefs.js';
import { store } from '../../core/store.js';
import { sky } from '../../core/sky.js';

const SAMPLE = 'আজ নতুন কিছু শেখা হোক।';
function option({ label, sample, on, onPick, name }) {
  return h('button', { class: 'opt' + (on ? ' is-on' : ''), type: 'button', role: 'radio', 'aria-checked': String(on), 'data-opt': name, onclick: onPick },
    h('span', { class: 'opt__t' }, h('b', { text: label }), sample ? h('span', { class: 'opt__s', text: sample }) : null), on ? icon('check') : null);
}
export function displayPage() {
  const root = h('div', { class: 'display' });
  const paint = () => {
    const p = prefs.get();
    root.replaceChildren(
      h('section', { class: 'de-card' }, h('h2', { class: 'de-row__title', text: 'লেখার মাপ' }),
        h('div', { role: 'radiogroup', 'aria-label': 'লেখার মাপ', class: 'opt-list' },
          option({ label: 'সাধারণ', sample: SAMPLE, on: p.text === 'normal', name: 'text-normal', onPick: () => { prefs.set({ text: 'normal', sizeAsked: true }); paint(); } }),
          option({ label: 'বড় লেখা', sample: SAMPLE, on: p.text === 'large', name: 'text-large', onPick: () => { prefs.set({ text: 'large', sizeAsked: true }); paint(); } }))),
      h('section', { class: 'de-card' }, h('h2', { class: 'de-row__title', text: 'রং' }),
        h('div', { role: 'radiogroup', 'aria-label': 'রং', class: 'opt-list' },
          ...[['auto', 'ফোনের মতো', 'ফোনের ডার্ক/লাইট মোড অনুযায়ী বদলায়'], ['light', 'হালকা', 'সবসময় হালকা'], ['dark', 'গাঢ়', 'সবসময় গাঢ়']].map(([k, l, s]) =>
            option({ label: l, sample: s, on: p.theme === k, name: 'theme-' + k, onPick: () => { prefs.set({ theme: k }); sky.apply(); paint(); } })))),
      ...(store.works ? [] : [h('p', { class: 'de-row__sub', role: 'status', text: 'এই ফোন পছন্দ মনে রাখতে পারছে না। এই খোলায় চলবে।' })]));
  };
  paint();
  return { node: root };
}
// After the first login, once: "লেখা কেমন সুবিধা?"
export function openSizeSheet() {
  let sheet;
  const pick = text => { prefs.set({ text, sizeAsked: true }); sheet.close(); };
  sheet = openSheet({ title: 'লেখা কেমন সুবিধা?', dismissible: false, content: h('div', { class: 'sheet-col' },
    h('button', { class: 'de-btn de-btn--secondary size-pick', type: 'button', onclick: () => pick('normal') }, h('b', { text: 'সাধারণ' }), h('span', { text: SAMPLE })),
    h('button', { class: 'de-btn de-btn--primary size-pick size-pick--big', type: 'button', onclick: () => pick('large') }, h('b', { text: 'বড় লেখা' }), h('span', { text: SAMPLE })),
    h('p', { class: 'de-row__sub', text: 'পরে "আরও → থিম ও লেখার সাইজ" থেকে বদলাতে পারবেন।' })) });
  return sheet;
}

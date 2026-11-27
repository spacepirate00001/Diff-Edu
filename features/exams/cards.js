// "রিপোর্ট কার্ড" (teacher): the card is made and published by the server on Saturday morning when every mark and rating of the class is in.
// This page says, per class, where the week stands and what is missing (tap to fill it). The teacher never prints or publishes here.
import { h } from '../../ui/dom.js';
import { chip, chipRow } from '../../ui/chip.js';
import { dataPage } from '../../ui/datapage.js';
import { stateCard } from '../../ui/states.js';
import { icon } from '../../ui/icons.js';
import { bn, shortDate } from '../../core/bn.js';
import { LEVELS, reportWeek, shiftWeek, READY_WORD } from './logic.js';
import { loadCardStatus, myLevels, today } from './data.js';

const TONE = { published: 'good', ready: 'info', waiting: 'warn', empty: '' };
export function cardsPage(ctx) {
  let back = 0;
  return dataPage({
    key: null,
    load: async () => { const l = await myLevels(); const levels = l.kind === 'ok' && l.data ? l.data : LEVELS; const w = shiftWeek(reportWeek(today()), -back); const r = await loadCardStatus(levels, w.from); return r; },
    isEmpty: d => !d.classes.length,
    empty: () => stateCard({ kind: 'empty', title: 'কোনো ক্লাস পাওয়া যায়নি', text: 'অফিসে জানান।' }),
    draw: (d, reload) => {
      const day = iso => shortDate(iso + 'T00:00:00+06:00');
      const weeks = [0, 1, 2, 3].map(n => chip(n === 0 ? 'এই সপ্তাহ' : n === 1 ? 'গত সপ্তাহ' : `${bn(n)} সপ্তাহ আগে`, n === back, () => { back = n; reload(); }));
      const card = c => h('section', { class: 'de-card tc-card' },
        h('div', { class: 'tc-row' }, h('div', { class: 'tc-grow' }, h('h2', { class: 'tc-h', text: `ক্লাস ${bn(c.level)}` }), h('p', { class: 'tc-cap', text: `${bn(c.size)} জন শিক্ষার্থী · ${bn(c.exams)}টা পরীক্ষা` }))),
        h('p', { class: 'tc-big tc-big--' + (TONE[c.state] || 'info'), text: READY_WORD[c.state] }),
        c.state === 'waiting' ? h('ul', { class: 'tc-list' },
          ...c.missing.map(m => h('li', {}, h('button', { class: 'de-row more-row', type: 'button', onclick: () => ctx.go('/more/marks/' + m.id) }, icon('exam'), h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: m.title }), h('span', { class: 'de-row__sub', text: `${bn(m.left)} জনের নম্বর বাকি` })), icon('chev')))),
          c.ratingsLeft ? h('li', {}, h('button', { class: 'de-row more-row', type: 'button', onclick: () => ctx.go('/class/rate') }, icon('star'), h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: 'ক্লাস রেটিং' }), h('span', { class: 'de-row__sub', text: `${bn(c.ratingsLeft)} জন উপস্থিত শিক্ষার্থীর রেটিং বাকি` })), icon('chev'))) : null) : null);
      return [h('p', { class: 'tc-sub', text: `${day(d.week.from)} থেকে ${day(d.week.to)}। সব নম্বর আর রেটিং থাকলে শনিবার সকালে কার্ড নিজে প্রকাশ হয়।` }), chipRow('কোন সপ্তাহ', weeks), ...d.classes.map(card),
        h('p', { class: 'tc-cap', text: 'নম্বর ভুল হলে আগে নম্বর এন্ট্রি থেকে ঠিক করুন। প্রকাশের পরের সংশোধন অ্যাডমিন করেন।' })];
    },
  });
}

// The "ক্লাস" tab: today's periods (one tap into each), shortcuts to ratings, homework, students, and a private note for today's class.
import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { navRow } from '../../ui/navrow.js';
import { toast } from '../../ui/toast.js';
import { stateCard } from '../../ui/states.js';
import { dataPage } from '../../ui/datapage.js';
import { sky } from '../../core/sky.js';
import { store } from '../../core/store.js';
import { session } from '../../core/session.js';
import { bn } from '../../core/bn.js';
import { currentPeriod, periodPhase, leftToDo } from './logic.js';
import { loadRoutine, loadDayState, today } from './data.js';
import { periodName, periodSub } from './ui.js';
import { periodUrl } from './attend.js';

const PHASE = { now: ['now', 'এখন চলছে'], next: ['plain', 'এর পরে'], done: ['plain', 'শেষ'], later: ['plain', 'পরে'] };
// One period as a card. st = { total, marked, rated, present } or undefined while it is not known.
export function periodCard(ctx, p, st, periods) {
  const phase = PHASE[periodPhase(p.shift, p.slot, sky.minutes(), periods)];
  const took = st && st.total > 0 && st.marked >= st.total, rated = st && st.present > 0 && st.rated >= st.present;
  return h('section', { class: 'tc-period' + (phase[0] === 'now' ? ' is-now' : ''), 'aria-label': periodName(p) },
    h('div', { class: 'tc-period__top' }, h('span', { class: 'tc-period__name', text: periodName(p) }), h('span', { class: 'de-chip de-chip--' + phase[0], text: phase[1] })),
    h('p', { class: 'tc-sub', text: periodSub(p) }),
    h('div', { class: 'tc-count' }, !st ? null : st.total === 0 ? h('span', { class: 'de-chip de-chip--plain', text: 'শিক্ষার্থী নেই' })
      : [h('span', { class: 'de-chip ' + (took ? 'de-chip--good' : 'de-chip--warn'), text: took ? `হাজিরা নেওয়া হয়েছে (${bn(st.present)}/${bn(st.total)})` : `হাজিরা বাকি (${bn(st.total)} জন)` }),
        took ? h('span', { class: 'de-chip ' + (rated ? 'de-chip--good' : 'de-chip--warn'), text: rated ? 'রেটিং দেওয়া হয়েছে' : `রেটিং বাকি (${bn(st.present - st.rated)})` }) : null]),
    h('div', { class: 'tc-wrap' },
      h('button', { class: 'de-btn ' + (took ? 'de-btn--secondary' : 'de-btn--primary'), type: 'button', text: took ? 'হাজিরা দেখুন' : 'হাজিরা নিন', onclick: () => ctx.go(periodUrl('/class/attend', p.shift, p.slot)) }),
      h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: 'রেটিং দিন', onclick: () => ctx.go(periodUrl('/class/rate', p.shift, p.slot)) })));
}
export const noRoutine = ctx => stateCard({ kind: 'empty', title: 'আজ রুটিনে আপনার ক্লাস নেই', text: 'তবুও চাইলে যেকোনো ক্লাসের হাজিরা নেওয়া যায়।', action: 'হাজিরা নিন', onAction: () => ctx.go('/class/attend') });

// The day's private note for one class: only on this phone (the server has no table for a class note), one per day.
const noteKey = () => `de.next.cnote.${session.uid()}.${today()}`;
function noteCard() {
  const ta = h('textarea', { class: 'de-field__input tc-ta', rows: '3', maxlength: '600', 'aria-label': 'আজকের ক্লাসের নোট', placeholder: 'আজ কী পড়ালেন, কে পিছিয়ে, কাল কী করবেন…', value: store.get(noteKey()) || '' });
  return h('section', { class: 'de-card tc-card' }, h('h2', { class: 'tc-h', text: 'আজকের ক্লাসের নোট' }), h('p', { class: 'tc-cap', text: 'শুধু এই ফোনে থাকে। সার্ভারে বা অভিভাবকের কাছে যায় না।' }), ta,
    h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: 'নোট রাখুন', onclick: () => { store.set(noteKey(), ta.value.trim()); toast('নোট এই ফোনে রাখা হলো।'); } }));
}

export function classTab(ctx) {
  const page = dataPage({
    key: 'classtab',
    load: async () => {
      const rt = await loadRoutine(session.uid()); if (rt.kind !== 'ok') return rt;
      const ds = await loadDayState(rt.data.periods);
      return { kind: ds.kind === 'ok' ? 'ok' : ds.kind, data: { periods: rt.data.periods, state: ds.data?.state || {} } };
    },
    isEmpty: () => false,
    draw: ({ periods, state }) => {
      const cur = currentPeriod(periods, sky.minutes());
      return [h('div', { class: 'tc-page' },
        h('h2', { class: 'tc-h', text: 'আজকের ক্লাস' }),
        ...(periods.length ? periods.map(p => periodCard(ctx, p, state[p.key], periods)) : [noRoutine(ctx)]),
        h('div', { class: 'de-card more-card' },
          navRow({ ic: 'check', text: 'হাজিরা নিন', sub: cur ? periodName(cur) : 'ক্লাস বেছে নিন', onclick: () => ctx.go(cur ? periodUrl('/class/attend', cur.shift, cur.slot) : '/class/attend') }),
          navRow({ ic: 'star', text: 'ক্লাস রেটিং', sub: 'হাজিরার পর উপস্থিতদের রেটিং', onclick: () => ctx.go(cur ? periodUrl('/class/rate', cur.shift, cur.slot) : '/class/rate') }),
          navRow({ ic: 'book', text: 'বাড়ির কাজ', sub: 'দিন ও দেখুন', onclick: () => ctx.go('/class/homework') }),
          navRow({ ic: 'user', text: 'শিক্ষার্থী ও অভিভাবকের ফোন', sub: 'নাম দিয়ে খুঁজুন', onclick: () => ctx.go('/class/students') })),
        noteCard())];
    },
  });
  return page;
}
export { icon, leftToDo };

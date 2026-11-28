// "সবাই আজ": every student of one shift on one page: present / absent / not taken yet today, a call button (guardian call sheet) and whether
// the student's app is open right now. Teachers open it from "ক্লাস", the admin from "অফিস". Reads only; calling opens the phone's dialler.
import { h } from '../../ui/dom.js';
import { chip, chipRow } from '../../ui/chip.js';
import { icon } from '../../ui/icons.js';
import { stateCard } from '../../ui/states.js';
import { dataPage } from '../../ui/datapage.js';
import { rpc, rows } from '../../core/api.js';
import { filter as nameFilter, normalize } from '../../core/name-search.js';
import { presenceOf } from '../../core/presence.js';
import { sky } from '../../core/sky.js';
import { bn } from '../../core/bn.js';
import { SHIFTS, guessShift, shiftName } from './logic.js';
import { loadRoster } from './data.js';
import { openCallSheet } from './call.js';
import { avatar } from './ui.js';

const PRES = { live: ['live', 'এখন অ্যাপে আছে'], today: ['today', 'আজ অ্যাপে এসেছে'], none: ['none', 'আজ অ্যাপে আসেনি'] };
const ATT = { present: ['good', 'উপস্থিত'], absent: ['bad', 'অনুপস্থিত'], todo: ['plain', 'হাজিরা বাকি'] };
const rank = s => (s.att === 'absent' ? 0 : s.att === 'todo' ? 1 : 2);

// -> { kind, data: { shift, list: [{ id, name, roll, class_level, att, app }], appKnown } } ; app = 'live'|'today'|'none'|'unknown'
export async function loadEveryone(shift) {
  const [r, a, p] = await Promise.all([loadRoster(shift), rpc('attendance_today', { p_shift: shift }), rpc('students_presence')]);
  if (r.kind !== 'ok') return r;
  const states = {}; for (const x of rows(a)) states[x.student_id] = x.state;
  const attKnown = a.kind === 'ok', seen = {}; for (const x of rows(p)) seen[x.student_id] = x;
  const appKnown = p.kind === 'ok', now = Date.now();
  const list = r.data.map(s => ({ id: s.id, name: s.name, login: s.login, roll: s.roll, class_level: s.class_level, att: states[s.id] || 'todo', app: appKnown ? presenceOf(seen[s.id], now) : 'unknown' }));
  return { kind: 'ok', data: { shift, list, attKnown, appKnown } };
}
export const summary = list => ({ present: list.filter(s => s.att === 'present').length, absent: list.filter(s => s.att === 'absent').length, todo: list.filter(s => s.att === 'todo').length, live: list.filter(s => s.app === 'live').length });

export function everyonePage(ctx, query = {}, base = '/class/all') {
  const shift = SHIFTS.some(s => s.id === query.shift) ? query.shift : guessShift(sky.minutes());
  let q = '', cls = null, only = null;
  const out = h('ul', { class: 'tc-list', 'aria-live': 'polite' }), sums = h('div', { class: 'tc-count', role: 'status' });
  return dataPage({
    key: 'everyone.' + shift, load: () => loadEveryone(shift), isEmpty: d => !d.list.length,
    empty: () => stateCard({ kind: 'empty', title: 'এই শিফটে কেউ নেই', text: 'অন্য শিফট বেছে দেখুন।' }),
    draw: ({ list, attKnown, appKnown }) => {
      const levels = [...new Set(list.map(s => s.class_level))].sort((a, b) => a - b);
      const shifts = chipRow('শিফট', SHIFTS.map(s => chip(s.name + ' শিফট', s.id === shift, () => ctx.replace(`${base}?shift=${s.id}`))));
      const classes = h('div'), onlys = h('div');
      const paint = () => {
        if (levels.length > 1) classes.replaceChildren(chipRow('ক্লাস', [chip('সব ক্লাস', cls == null, () => { cls = null; paint(); }), ...levels.map(l => chip('ক্লাস ' + bn(l), cls === l, () => { cls = l; paint(); }))]));
        const inClass = list.filter(s => cls == null || s.class_level === cls), sm = summary(inClass);
        onlys.replaceChildren(chipRow('কাদের দেখবেন', [chip('সবাই', only == null, () => { only = null; paint(); }), chip('অনুপস্থিত', only === 'absent', () => { only = 'absent'; paint(); }), chip('উপস্থিত', only === 'present', () => { only = 'present'; paint(); }),
          ...(appKnown ? [chip('অ্যাপে আছে', only === 'live', () => { only = 'live'; paint(); })] : [])]));
        sums.replaceChildren(...(attKnown ? [h('span', { class: 'de-chip de-chip--good', text: `উপস্থিত ${bn(sm.present)}` }), h('span', { class: 'de-chip de-chip--bad', text: `অনুপস্থিত ${bn(sm.absent)}` }), h('span', { class: 'de-chip de-chip--plain', text: `বাকি ${bn(sm.todo)}` })] : []),
          ...(appKnown ? [h('span', { class: 'de-chip de-chip--plain ev-live-chip', text: `অ্যাপে এখন ${bn(sm.live)} জন` })] : []));
        let shown = inClass.filter(s => only == null || (only === 'live' ? s.app === 'live' : s.att === only));
        if (normalize(q)) shown = nameFilter(shown, q, s => ({ name: s.name, login: s.login, roll: s.roll }));
        shown = shown.map((s, i) => [s, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(x => x[0]);
        out.replaceChildren(...shown.map(row), ...(!shown.length ? [h('li', null, h('p', { class: 'tc-sub', text: 'কাউকে পাওয়া যায়নি।' }))] : []));
      };
      const row = s => {
        const [tone, text] = ATT[attKnown ? s.att : 'todo'], pr = PRES[s.app];
        return h('li', null, h('div', { class: 'tc-att ev-row' + (s.att === 'absent' ? ' is-away' : '') },
          h('div', { class: 'tc-att__main ev-main' }, avatar(s.name),
            h('span', { class: 'tc-att__name' }, h('b', { text: s.name }), h('span', { text: `রোল ${bn(s.roll ?? '')} · ক্লাস ${bn(s.class_level)}` }),
              pr ? h('span', { class: 'ev-app ev-app--' + pr[0] }, h('i', { class: 'ev-dot', 'aria-hidden': 'true' }), pr[1]) : null),
            attKnown ? h('span', { class: 'de-chip de-chip--' + tone + ' tc-att__chip', text }) : null),
          h('button', { class: 'tc-att__key ev-call', type: 'button', 'aria-label': `${s.name}: অভিভাবককে ফোন করুন`, onclick: () => openCallSheet({ id: s.id, name: s.name }) }, icon('phone'))));
      };
      const search = h('input', { class: 'de-field__input tc-input', type: 'search', role: 'searchbox', 'aria-label': 'নাম, রোল বা আইডি দিয়ে খুঁজুন', placeholder: 'নাম, রোল বা আইডি', autocomplete: 'off', enterkeyhint: 'search', oninput: e => { q = e.target.value; paint(); } });
      paint();
      return [h('div', { class: 'tc-page' }, h('p', { class: 'tc-cap', text: `${shiftName(shift)} শিফট · আজকের অবস্থা। ফোন বোতামে চাপলে অভিভাবকের নম্বর আসবে।` }), shifts, search, classes, onlys, sums,
        !appKnown ? h('p', { class: 'tc-cap', text: 'কে অ্যাপে আছে সেটা এখনো জানা যাচ্ছে না।' }) : null,
        h('div', { class: 'de-card' }, out))];
    },
  });
}

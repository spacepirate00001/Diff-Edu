// Pieces every student page shares: the student's own record, "আমার অগ্রগতি", a page that shows its states, a tap-tile grid.
import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { stateCard, offlineState, errorState } from '../../ui/states.js';
import * as router from '../../core/router.js';
import { dataPage } from '../../ui/datapage.js';
import { callOfficeButton } from '../auth/forgot.js';
import { rows } from '../../core/api.js';
import { self } from '../../core/student-self.js';
import { bn } from '../../core/bn.js';
import { starProgress, progressLine } from './logic.js';

// -> the student's record, loading it once. null when there is none (the office has not linked this account to a student).
let lastKind = 'ok';
export async function me() { if (self.get()) return self.get(); const r = await self.load(); lastKind = r.kind; return r.data || null; }
// { kind, data } from a table answer. map turns the rows into the page's data.
export const wrap = (res, map) => ({ kind: res.kind, data: res.kind === 'ok' ? (map ? map(rows(res)) : rows(res)) : undefined });
// dataPage for a student: waits for the student's record, then calls load(rec). No record -> a kind note and the office number.
export function studentPage({ key, load, isEmpty, empty, draw }) {
  let none = false;
  return dataPage({ key, isEmpty: d => none || !!isEmpty?.(d), empty: () => (none ? noRecState() : empty()), draw,
    load: async () => { const rec = await me(); none = !rec; return rec ? load(rec) : { kind: 'ok', data: [] }; } });
}
// What to show when there is no student record: "not linked yet" only when the server said so; a failed read is an offline / error state with a retry.
export const noRecState = (retry = () => router.go(router.here().path)) => (lastKind === 'missing' ? noSelfCard() : lastKind === 'offline' ? offlineState(retry) : errorState(retry));
export const noSelfCard = () => stateCard({ kind: 'empty', title: 'তোমার অ্যাকাউন্ট এখনো ক্লাসের সঙ্গে যুক্ত হয়নি', text: 'কোচিং অফিসে জানালে ঠিক করে দেবে।', extra: callOfficeButton('অফিসে ফোন করো') });

// "আমার অগ্রগতি": always the first thing on a competitive screen. Only the child's own numbers, a bar to the next star mark, one kind line.
export function progressCard(rec, { extra } = {}) {
  const p = starProgress(rec.stars);
  return h('section', { class: 'de-card st-prog', 'aria-label': 'আমার অগ্রগতি' },
    h('span', { class: 'de-row__sub', text: 'আমার অগ্রগতি' }),
    h('div', { class: 'st-prog__row' },
      h('span', { class: 'st-prog__n' }, icon('star'), h('b', { text: bn(rec.stars) }), h('span', { text: 'স্টার' })),
      rec.streak_days > 1 ? h('span', { class: 'de-chip de-chip--plain', text: `টানা ${bn(rec.streak_days)} দিন` }) : null),
    h('span', { class: 'gx-bar', role: 'presentation' }, h('i', { class: 'gx-bar__fill', style: { width: Math.round(p.ratio * 100) + '%' } })),
    h('span', { class: 'de-row__sub', text: progressLine(rec.stars) }), extra);
}
// A two-column grid of big tap tiles: [{ e (emoji or icon name), title, sub, onclick, on, disabled }]
export function tiles(list) {
  return h('div', { class: 'st-tiles' }, ...list.map(t => h('button', { class: 'st-tile' + (t.on ? ' is-on' : ''), type: 'button', onclick: t.onclick, disabled: t.disabled, 'aria-pressed': t.on == null ? null : String(!!t.on) },
    h('span', { class: 'st-tile__e', 'aria-hidden': 'true' }, t.icon ? icon(t.icon) : t.e), h('span', { class: 'st-tile__t', text: t.title }), t.sub ? h('span', { class: 'st-tile__s', text: t.sub }) : null)));
}
// replaceChildren that skips empty slots and flattens lists (Element.replaceChildren would print "null" or "[object ...]")
export const put = (root, ...k) => root.replaceChildren(...k.flat(Infinity).filter(Boolean));
export const section = text => h('h2', { class: 'inbox-group__h', text });
export { dataPage };

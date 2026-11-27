// Small pieces the office pages share: the month switcher and a plain list row.
import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { monthName, shiftMonth } from './logic.js';
import { today } from './data.js';

export const nowKey = () => today().slice(0, 7);
// ‹ নভেম্বর ২০২৬ ›  (the next month is allowed only up to the current one when future = false)
export function monthBar(key, onPick, { future = false } = {}) {
  const prev = h('button', { class: 'de-btn de-btn--secondary tc-iconbtn', type: 'button', 'aria-label': 'আগের মাস', onclick: () => onPick(shiftMonth(key, -1)) }, icon('back'));
  const next = h('button', { class: 'de-btn de-btn--secondary tc-iconbtn', type: 'button', 'aria-label': 'পরের মাস', onclick: () => onPick(shiftMonth(key, 1)) }, icon('chev'));
  if (!future && key >= nowKey()) next.disabled = true;
  return h('div', { class: 'tc-monthbar' }, prev, h('b', { class: 'tc-h tc-grow', text: monthName(key), 'aria-live': 'polite' }), next);
}
export const row = ({ title, sub, chip, onclick, tone = '' }) => h('li', {}, h('button', { class: 'de-row more-row', type: 'button', onclick },
  h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: title }), sub ? h('span', { class: 'de-row__sub', text: sub }) : null),
  chip ? h('span', { class: 'de-chip' + (tone ? ' de-chip--' + tone : ''), text: chip }) : null, icon('chev')));

// One tappable row: icon, title, small line, optional count chip, arrow. Used by "আরও" and by the study hub.
import { h } from './dom.js';
import { icon } from './icons.js';
import { bn } from '../core/bn.js';

export const navRow = ({ ic, text, sub, onclick, href, disabled, danger, count, tag }) => {
  const inner = [h('span', { class: 'more-ic', 'aria-hidden': 'true' }, icon(ic)), h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text }), sub ? h('span', { class: 'de-row__sub', text: sub }) : null),
    count ? h('span', { class: 'de-chip de-chip--warn', text: bn(count) }) : null, tag ? h('span', { class: 'de-chip de-chip--good', text: tag }) : null, disabled ? null : icon('chev')];
  const cls = 'de-row more-row' + (danger ? ' more-row--danger' : '') + (disabled ? ' is-disabled' : '');
  return href ? h('a', { class: cls, href }, ...inner) : h('button', { class: cls, type: 'button', onclick, 'aria-disabled': disabled ? 'true' : null }, ...inner);
};

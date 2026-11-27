// P8: choose which child every tab shows. The choice is the student's id (core/children.js), so it is the same on every tab.
import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { openSheet } from '../../ui/sheet.js';
import { kids } from '../../core/children.js';
import { initialsOf, classLabel } from '../today/today.js';
import { callOfficeButton } from '../auth/forgot.js';
import { bn } from '../../core/bn.js';
import { session } from '../../core/session.js';

export function openSwitcher(opener) {
  const cur = kids.current();
  let sheet;
  const rows = kids.list().map(k => h('button', { class: 'kid-row', type: 'button', role: 'radio', 'aria-checked': String(k.id === cur?.id), onclick: () => { kids.set(k.id); sheet.close(); } },
    h('span', { class: 'de-avatar kid-av', 'aria-hidden': 'true', text: initialsOf(k.name) }),
    h('span', { class: 'kid-row__t' }, h('b', { text: k.name }), h('span', { class: 'de-row__sub', text: [classLabel(k.class_level), k.shift].filter(Boolean).join(' · ') })),
    k.id === cur?.id ? icon('check', 'kid-row__ok') : null));
  sheet = openSheet({ title: 'সন্তান বেছে নিন', content: h('div', { class: 'kid-list', role: 'radiogroup', 'aria-label': 'সন্তান' }, ...rows) });
  return sheet;
}
// The strip under the top bar on guardian tabs other than "আজ": name, class, and a switch when there are several.
export function childBar() {
  const list = kids.list(), cur = kids.current();
  if (!list.length || session.me()?.role === 'student') return null;   // a student sees their own pages, no child strip
  const inner = [h('span', { class: 'de-avatar kid-av', 'aria-hidden': 'true', text: initialsOf(cur.name) }), h('span', { class: 'kid-bar__t' }, h('b', { text: cur.name }), h('span', { text: classLabel(cur.class_level) })),
    list.length > 1 ? icon('chevdown') : null];
  return list.length > 1
    ? h('button', { class: 'kid-bar', type: 'button', 'aria-haspopup': 'dialog', 'aria-label': `${cur.name}, সন্তান বদলান`, onclick: e => openSwitcher(e.currentTarget) }, ...inner)
    : h('div', { class: 'kid-bar kid-bar--one' }, ...inner);
}
export function noKidsCard() {
  return h('div', { class: 'de-empty' }, h('span', { class: 'de-empty__title', text: 'কোনো শিক্ষার্থী যুক্ত হয়নি' }), h('span', { class: 'de-empty__text', text: 'কোচিং অফিসে যোগাযোগ করুন।' }), callOfficeButton('অফিসে ফোন করুন'));
}
export { bn };

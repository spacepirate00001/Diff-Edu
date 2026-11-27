// The guardian call sheet: always three slots in the order বাবা, মা, অন্য কেউ. A slot shows its people (name, number, a 48px call link) or "নম্বর নেই".
// Numbers come from guardian_students -> profiles (staff may read them, as in the old app). A wrong or missing number is reported to the office by phone (no form here).
import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { openSheet } from '../../ui/sheet.js';
import { bn } from '../../core/bn.js';
import { OFFICE_PHONE, OFFICE_PHONE_BN } from '../../core/config.js';
import { callSlots, telHref } from './logic.js';
import { loadGuardians } from './data.js';

export function slotsView(guardians) {
  return callSlots(guardians).flatMap(({ slot, people }) => people.length
    ? people.map(g => h('a', { class: 'tc-call', href: telHref(g.phone), 'aria-label': `${slot}${g.name ? ', ' + g.name : ''}: ${bn(g.phone)} নম্বরে কল করুন` }, icon('phone'), h('span', { class: 'tc-grow' }, h('b', { text: slot + (g.name ? ' · ' + g.name : '') }), h('p', { class: 'tc-cap', text: bn(g.phone) }))))
    : [h('div', { class: 'tc-call is-none' }, icon('phone'), h('span', { text: `${slot}: নম্বর নেই` }))]);
}
// student: { id, name } ; guardians: optional, already loaded
export function openCallSheet(student, guardians = null) {
  const body = h('div', { class: 'sheet-col' });
  const draw = list => body.replaceChildren(...slotsView(list),
    h('p', { class: 'tc-cap', text: `নম্বর ভুল বা নেই? অফিসে জানান: ${OFFICE_PHONE_BN}` }), h('a', { class: 'de-btn de-btn--secondary', href: 'tel:' + OFFICE_PHONE }, 'অফিসে ফোন করুন'));
  if (guardians) draw(guardians);
  else {
    body.replaceChildren(h('p', { class: 'tc-sub', role: 'status', text: 'নম্বর আনা হচ্ছে…' }));
    loadGuardians([student.id]).then(r => {
      if (!body.isConnected) return;
      if (r.kind === 'ok') draw(r.data[student.id] || []);
      else body.replaceChildren(h('p', { class: 'tc-sub', role: 'status', text: r.kind === 'offline' ? 'নেট নেই। নম্বর আনতে নেট লাগে।' : 'নম্বর আনা যায়নি।' }), h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: 'আবার চেষ্টা করুন', onclick: () => { sh.close(); openCallSheet(student); } }));
    });
  }
  const sh = openSheet({ title: `${student.name}: অভিভাবককে ফোন`, content: body });
  return sh;
}

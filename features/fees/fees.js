// The fees page ("আরও" > ফি ও রসিদ): what is due, this month, the history with receipts, and (only when the flag online_pay is on) the pay button.
import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { openSheet } from '../../ui/sheet.js';
import { emptyState } from '../../ui/states.js';
import { childPage } from '../../ui/datapage.js';
import { bn, money, shortDate } from '../../core/bn.js';
import { flags } from '../../core/flags.js';
import { OFFICE_PHONE } from '../../core/config.js';
import { loadFees } from './api.js';
import { totalDue, unpaid, feeState, STATE_BN, monthLabel, dueLabel, dueOf, receiptOf, currentFee } from './logic.js';

const CHIP = { paid: 'good', partial: 'warn', late: 'warn', due: 'plain' };
const when = iso => (iso ? shortDate(Date.parse(iso)) : '');

function openReceipt(f, kid) {
  const r = receiptOf(f);
  const line = (k, v) => v ? h('div', { class: 'gx-row' }, h('span', { class: 'de-row__sub', text: k }), h('b', { text: v })) : null;
  openSheet({ title: `${monthLabel(f)} · রসিদ`, content: h('div', { class: 'pay' }, h('div', { class: 'pay__ok' }, icon('check'), h('b', { text: feeState(f) === 'paid' ? 'পরিশোধিত' : 'কিছু টাকা জমা হয়েছে' })),
    h('div', { class: 'de-card gx-card pay__rc' }, line('সন্তান', kid.name), line('মাসের ফি', money(f.amount)), line('জমা হয়েছে', money(r.amount)), dueOf(f) > 0 ? line('এখনো বাকি', money(dueOf(f))) : null, line('মাধ্যম', r.method), line('তারিখ', when(r.paid_at)), line('রেফারেন্স', r.trx_id)),
    h('p', { class: 'de-row__sub', text: 'রসিদে ভুল মনে হলে অফিসে জানান।' })) });
}

export const feesPage = ctx => childPage({
  key: 'fees', load: k => loadFees(k.id), isEmpty: r => !r.length,
  empty: () => emptyState('এখনো কোনো ফি তৈরি হয়নি', 'মাসের ফি তৈরি হলে এখানে দেখা যাবে।'),
  draw: (fees, kid, reload) => {
    const due = totalDue(fees), cur = currentFee(fees), months = unpaid(fees).length;
    return [
      h('section', { class: 'de-card gx-card gx-hero ' + (due > 0 ? 'is-due' : 'is-clear') },
        h('span', { class: 'gx-cap', text: 'মোট বকেয়া' }), h('b', { class: 'gx-big', text: money(due) }),
        h('p', { class: 'de-row__sub', text: due > 0 ? `${bn(months)} মাসের ফি বাকি। অফিসে নগদ, বা bKash বা Nagad-এ জমা দিন।` : 'কোনো বকেয়া নেই। ধন্যবাদ!' }),
        due > 0 && flags.on('online_pay') ? h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: async () => (await import('./pay.js')).openPay({ kid, fees, onDone: () => reload() }) }, icon('coin'), 'অনলাইনে ফি দিন') : null,
        due > 0 && !flags.on('online_pay') ? h('a', { class: 'de-btn de-btn--secondary', href: 'tel:' + OFFICE_PHONE }, icon('phone'), 'অফিসে ফোন করুন') : null),
      cur ? h('section', { class: 'de-card gx-card' }, h('div', { class: 'gx-row' }, h('div', {}, h('span', { class: 'gx-cap', text: 'এই মাস' }), h('h2', { class: 'gx-h3', text: monthLabel(cur) }), h('span', { class: 'de-row__sub', text: `${money(cur.amount)} · ${dueLabel(cur)}` })),
        h('span', { class: 'de-chip de-chip--' + CHIP[feeState(cur)], text: STATE_BN[feeState(cur)] }))) : null,
      h('h2', { class: 'inbox-group__h', text: 'ফি ও রসিদ' }),
      h('div', { class: 'de-card more-card' }, ...fees.map(f => { const s = feeState(f), paidSome = !!receiptOf(f);
        return h(paidSome ? 'button' : 'div', { class: 'de-row gx-line' + (paidSome ? ' more-row' : ''), type: paidSome ? 'button' : null, onclick: paidSome ? () => openReceipt(f, kid) : null },
          h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: monthLabel(f) }), h('span', { class: 'de-row__sub', text: s === 'paid' ? `${money(f.amount)} · রসিদ দেখুন` : s === 'partial' || (dueOf(f) < Number(f.amount)) ? `বাকি ${money(dueOf(f))}` : money(f.amount) })),
          h('span', { class: 'de-chip de-chip--' + CHIP[s], text: STATE_BN[s] }), paidSome ? icon('chev') : null); }))];
  },
});

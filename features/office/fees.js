// "ফি" (admin): one month at a time. Who paid, who owes, and a desk payment (cash, or a bKash / Nagad payment the parent made outside the app).
// A payment is money, so it needs the net and says so; a repeat of the same sheet is the same payment (cash gets one id when the sheet opens).
import { h } from '../../ui/dom.js';
import { chip, chipRow } from '../../ui/chip.js';
import { field } from '../../ui/field.js';
import { openSheet } from '../../ui/sheet.js';
import { toast } from '../../ui/toast.js';
import { dataPage } from '../../ui/datapage.js';
import { stateCard } from '../../ui/states.js';
import { icon } from '../../ui/icons.js';
import { bn, money, uuid } from '../../core/bn.js';
import { METHODS } from '../fees/logic.js';
import { LEVELS, FEE_FILTERS, feeSummary, filterFees, feeKind, dueOf, validatePayment, cashRef, payError, validateGenerate, monthName, feeRowName } from './logic.js';
import { loadFees, recordPayment, generateFees } from './data.js';
import { monthBar, nowKey, row } from './ui.js';

const KIND = { paid: ['পরিশোধিত', 'good'], partial: ['কিছু বাকি', 'warn'], due: ['বাকি', 'warn'] };
export function feesPage(ctx, query = {}) {
  let key = /^\d{4}-\d{2}$/.test(query.m || '') ? query.m : nowKey(), filter = 'all', level = null, q = '';
  const page = dataPage({
    key: null,
    load: () => loadFees(key),
    isEmpty: d => !d.fees.length,
    empty: () => h('div', { class: 'tc-page' }, monthBar(key, k => { key = k; page.reload(); }), stateCard({ kind: 'empty', title: `${monthName(key)}-এর ফি এখনো তৈরি হয়নি`, text: 'নিচের বোতামে চাপ দিলে সব শিক্ষার্থীর ফি একসাথে তৈরি হবে।' }),
      h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: () => generateSheet(key, () => page.reload()) }, icon('plus'), 'এই মাসের ফি তৈরি করুন')),
    draw: (d, reload) => {
      const all = d.fees, s = feeSummary(all), listBox = h('div');
      const paintList = () => {
        const list = filterFees(all, { filter, level, q, owed: d.owed });
        listBox.replaceChildren(list.length ? h('div', { class: 'de-card' }, h('ul', { class: 'tc-list' }, ...list.map(f => {
          const k = feeKind(f), [word, tone] = KIND[k], o = d.owed[f.student_id] || 0;
          return row({ title: feeRowName(f), sub: `ক্লাস ${bn(f.student.class_level)} · রোল ${bn(f.student.roll || '—')}${k === 'paid' ? '' : ` · বাকি ${money(dueOf(f))}`}${o >= 2 ? ` · ${bn(o)} মাস বাকি` : ''}`, chip: word, tone, onclick: () => payOrView(f, key, reload) });
        }))) : stateCard({ kind: 'empty', title: 'এমন কোনো ফি পাওয়া যায়নি', text: 'ফিল্টার বা খোঁজা বদলে দেখুন।', mascot: false }));
      };
      const search = field({ label: 'নাম, রোল বা আইডি দিয়ে খুঁজুন', oninput: e => { q = e.target.value; paintList(); } });
      search.input.value = q;
      const filters = h('div'), levels = h('div');
      const paintChips = () => {
        filters.replaceChildren(chipRow('কোন ফি', FEE_FILTERS.map(([k, l]) => chip(l, filter === k, () => { filter = k; paintChips(); paintList(); }))));
        levels.replaceChildren(chipRow('কোন ক্লাস', [chip('সব ক্লাস', level == null, () => { level = null; paintChips(); paintList(); }), ...LEVELS.map(l => chip(bn(l), level === l, () => { level = l; paintChips(); paintList(); }))]));
      };
      paintChips(); paintList();
      return h('div', { class: 'tc-page' },
        monthBar(key, k => { key = k; reload(); }),
        h('section', { class: 'de-card tc-card' }, h('p', { class: 'tc-big tc-big--' + (s.left ? 'warn' : 'good'), text: s.left ? `${money(s.left)} বাকি` : 'সব ফি পরিশোধিত' }),
          h('p', { class: 'tc-cap', text: `মোট ${money(s.amount)} · জমা ${money(s.collected)} · ${bn(s.paid)} জন পরিশোধ, ${bn(s.partial)} জন কিছু বাকি, ${bn(s.due)} জন বাকি` })),
        d.partial ? h('p', { class: 'tc-cap', text: 'কয় মাস বাকি তা পুরো আনা যায়নি।' }) : null,
        filters, levels, search.el, listBox,
        h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: () => generateSheet(key, reload) }, icon('plus'), 'এই মাসের নতুন শিক্ষার্থীদের ফি তৈরি করুন'),
        h('p', { class: 'tc-cap', text: 'অ্যাপের বাইরে নেওয়া টাকা এখানে জমা করলে অভিভাবক রসিদ দেখতে পাবেন।' }));
    },
  });
  return page;
}

function payOrView(f, key, reload) {
  if (dueOf(f) <= 0) return toast(`${feeRowName(f)}-এর ${monthName(key)}-এর ফি পরিশোধিত।`);
  paySheet(f, key, reload);
}
function paySheet(f, key, reload) {
  const due = dueOf(f), ref = cashRef(uuid());
  let method = 'cash';
  const amount = field({ label: 'কত টাকা নিলেন', inputmode: 'decimal', value: String(due), help: `বাকি ${money(due)}` });
  const trx = field({ label: 'ট্রানজেকশন আইডি', help: 'bKash বা Nagad-এর মেসেজে যে আইডি আছে' });
  const mBox = h('div'), tBox = h('div'), go = h('button', { class: 'de-btn de-btn--primary', type: 'button', text: 'জমা নিন' });
  const draw = () => { mBox.replaceChildren(chipRow('কীভাবে দিলেন', Object.entries(METHODS).map(([k, l]) => chip(l, method === k, () => { method = k; draw(); })))); tBox.replaceChildren(method === 'cash' ? '' : trx.el); };
  draw();
  const sheet = openSheet({ title: `${feeRowName(f)} · ${monthName(key)}`, content: h('div', { class: 'sheet-col' }, h('p', { class: 'tc-cap', text: `ক্লাস ${bn(f.student.class_level)} · রোল ${bn(f.student.roll || '—')} · ফি ${money(f.amount)}, আগে জমা ${money(f.paid_amount)}` }), mBox, amount.el, tBox, go) });
  go.addEventListener('click', async () => {
    const v = validatePayment({ method, amount: amount.input.value, trx: trx.input.value, due });
    amount.error(v.errors.amount || ''); trx.error(v.errors.trx || '');
    if (!v.ok) return;
    go.disabled = true; go.textContent = 'একটু অপেক্ষা…';
    const r = await recordPayment({ fee: f, value: v.value, ref });
    go.disabled = false; go.textContent = 'জমা নিন';
    if (r.kind === 'offline') return toast('নেট নেই। টাকার হিসাব নেটে ছাড়া জমা হয় না, নেট এলে আবার চেষ্টা করুন।');
    if (r.kind !== 'ok') return toast(payError(r.text));
    sheet.close(); toast(`${money(v.value.amount)} জমা হয়েছে।`); reload();
  });
}
function generateSheet(key, reload) {
  let level = null;
  const amount = field({ label: 'প্রতি শিক্ষার্থীর মাসিক ফি (টাকা)', inputmode: 'numeric', help: 'যাদের এই মাসের ফি আগে থেকেই আছে, তাদেরটা বদলাবে না।' });
  const lBox = h('div'), go = h('button', { class: 'de-btn de-btn--primary', type: 'button', text: 'ফি তৈরি করুন' });
  const draw = () => lBox.replaceChildren(chipRow('কোন ক্লাস', [chip('সব ক্লাস', level == null, () => { level = null; draw(); }), ...LEVELS.map(l => chip(bn(l), level === l, () => { level = l; draw(); }))]));
  draw();
  const sheet = openSheet({ title: `${monthName(key)}-এর ফি তৈরি`, content: h('div', { class: 'sheet-col' }, lBox, amount.el, go) });
  go.addEventListener('click', async () => {
    const v = validateGenerate({ amount: amount.input.value, class_level: level });
    amount.error(v.errors.amount || '');
    if (!v.ok) return;
    go.disabled = true; go.textContent = 'একটু অপেক্ষা…';
    const r = await generateFees(key, v.value);
    go.disabled = false; go.textContent = 'ফি তৈরি করুন';
    if (r.kind === 'offline') return toast('নেট নেই। নেট এলে আবার চেষ্টা করুন।');
    if (r.kind !== 'ok') return toast('ফি তৈরি হয়নি, আবার চেষ্টা করুন।');
    sheet.close(); toast(r.made ? `${bn(r.made)} জনের ফি তৈরি হয়েছে।` : 'সবার ফি আগে থেকেই আছে।'); reload();
  });
}

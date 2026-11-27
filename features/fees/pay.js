// Online fee payment (bKash / Nagad): choose -> confirm -> started -> instructions + checking -> receipt. Lazy-loaded, and the button that opens it
// shows only when the flag online_pay is ON (core/flags.js). No card, wallet number or PIN is ever typed or kept here: the money is sent in the
// bKash / Nagad app itself. A started payment is remembered on the phone (key de.next.pay.<uid>) so a reload, a second tap or a second tab
// continues the SAME payment instead of making another one.
import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { openSheet } from '../../ui/sheet.js';
import { toast } from '../../ui/toast.js';
import { bn, money } from '../../core/bn.js';
import { store } from '../../core/store.js';
import { session } from '../../core/session.js';
import { net } from '../../core/net.js';
import { OFFICE_PHONE } from '../../core/config.js';
import { buildIntent, totalDue, unpaid, dueOf, monthLabel, payStatus, METHODS, PAY_METHODS } from './logic.js';
import { loadFees, startPayment } from './api.js';

const POLL_MS = 4000, GIVE_UP_MS = 4 * 60 * 1000;
const pkey = () => 'de.next.pay.' + session.uid();
export const pending = () => store.json(pkey());
const clear = () => store.del(pkey());

export function openPay({ kid, fees, onDone }) {
  let sheet, timer = null, stopped = false, method = 'bkash', scope = 'all', busy = false;
  const box = h('div', { class: 'pay' });
  const stop = () => { stopped = true; clearTimeout(timer); };
  const say = (...kids) => box.replaceChildren(...kids.filter(Boolean));
  const callOffice = h('a', { class: 'de-btn de-btn--secondary', href: 'tel:' + OFFICE_PHONE }, icon('phone'), 'অফিসে ফোন করুন');
  const amountOf = () => (scope === 'month' && unpaid(fees)[0] ? dueOf(unpaid(fees)[0]) : totalDue(fees));
  const feesFor = () => (scope === 'month' && unpaid(fees)[0] ? [unpaid(fees)[0]] : fees);

  // ---- 1. choose ----
  function choose() {
    const list = unpaid(fees);
    say(h('p', { class: 'pay__lead', text: `${kid.name}-এর ফি। টাকা সরাসরি bKash বা Nagad অ্যাপে দেবেন, এখানে কোনো পিন বা কার্ড নম্বর লিখতে হবে না।` }),
      list.length > 1 ? h('div', { class: 'opt-list', role: 'radiogroup', 'aria-label': 'কত টাকা' }, ...[['all', `সব বকেয়া (${bn(list.length)} মাস)`, totalDue(fees)], ['month', `শুধু ${monthLabel(list[0])}`, dueOf(list[0])]].map(([k, t, a]) =>
        h('button', { class: 'opt' + (scope === k ? ' is-on' : ''), type: 'button', role: 'radio', 'aria-checked': String(scope === k), onclick: () => { scope = k; choose(); } }, h('span', { class: 'opt__t', text: t }), h('span', { class: 'opt__s', text: money(a) })))) : null,
      h('div', { class: 'opt-list', role: 'radiogroup', 'aria-label': 'কোথা থেকে দেবেন' }, ...PAY_METHODS.map(m =>
        h('button', { class: 'opt' + (method === m ? ' is-on' : ''), type: 'button', role: 'radio', 'aria-checked': String(method === m), onclick: () => { method = m; choose(); } }, h('span', { class: 'opt__t', text: METHODS[m] })))),
      h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: confirm, text: `${money(amountOf())} দিতে এগোই` }));
  }
  // ---- 2. confirm ----
  function confirm() {
    const b = buildIntent({ studentId: kid.id, fees: feesFor(), method, amount: amountOf() });
    if (!b.ok) return say(h('p', { class: 'pay__lead', text: 'টাকার হিসাব মিলছে না। পাতাটা বন্ধ করে আবার খুলুন।' }), callOffice);
    const go = h('button', { class: 'de-btn de-btn--primary', type: 'button', text: 'নিশ্চিত, শুরু করি' });
    go.addEventListener('click', () => { if (busy) return; busy = true; go.disabled = true; go.textContent = 'শুরু হচ্ছে…'; start(b.intent); });   // one tap only: the button is dead after the first
    say(h('div', { class: 'pay__sum' }, h('span', { text: 'মোট' }), h('b', { text: money(b.intent.amount) }), h('span', { text: `${METHODS[method]}-এ · ${kid.name}` })),
      h('p', { class: 'de-row__sub', text: 'এরপর আপনাকে কয়েকটা ধাপ দেখানো হবে। টাকা পাঠালে কিছুক্ষণের মধ্যে রসিদ এখানে আসবে।' }), go,
      h('button', { class: 'de-btn de-btn--text', type: 'button', onclick: () => { busy = false; choose(); }, text: 'পিছনে যান' }));
  }
  // ---- 3. start ----
  async function start(intent) {
    if (net.isOffline()) { busy = false; return failed('offline', intent); }
    say(h('p', { class: 'pay__lead', role: 'status', text: 'শুরু হচ্ছে, একটু অপেক্ষা করুন…' }));
    const r = await startPayment(kid.id, intent);
    if (stopped) return;
    busy = false;
    if (r.kind !== 'ok') return failed(r.kind, intent);
    const rec = { kid: kid.id, intent, before: fees.map(f => ({ id: f.id, paid_amount: f.paid_amount })), trx_id: r.data.trx_id, steps: r.data.steps || [], at: Date.now() };
    store.setJson(pkey(), rec);
    waiting(rec);
  }
  function failed(kind, intent) {
    const text = kind === 'offline' ? 'নেট নেই। নেট এলে আবার চেষ্টা করুন। কোনো টাকা কাটা হয়নি।' : kind === 'missing' ? 'অনলাইনে ফি দেওয়া এখনো চালু হয়নি। এখন অফিসে নগদ টাকা, bKash বা Nagad-এ দিন।' : 'এখন শুরু করা গেল না। কোনো টাকা কাটা হয়নি। একটু পরে আবার চেষ্টা করুন।';
    say(h('p', { class: 'pay__lead', role: 'status', text }), kind === 'missing' ? callOffice : h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: () => start(intent), text: 'আবার চেষ্টা করুন' }));
  }
  // ---- 4. instructions + checking ----
  function waiting(rec) {
    const status = h('p', { class: 'pay__status', role: 'status', 'aria-live': 'polite', text: 'টাকা এসেছে কি না দেখা হচ্ছে…' });
    say(h('p', { class: 'pay__lead', text: `${METHODS[rec.intent.method]}-এ ${money(rec.intent.amount)} পাঠান:` }), h('ol', { class: 'pay__steps' }, ...rec.steps.map(s => h('li', { text: s }))),
      h('p', { class: 'de-row__sub', text: `রেফারেন্স: ${rec.trx_id}` }), status,
      h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: () => { stop(); sheet.close(); }, text: 'পরে দেখব' }));
    const began = rec.at;
    const tick = async () => {
      if (stopped) return;
      if (Date.now() - began > GIVE_UP_MS) { status.textContent = 'এখনো টাকা আসেনি। টাকা পাঠিয়ে থাকলে একটু পরে এই পাতা আবার খুলুন, বা অফিসে ফোন করুন।'; status.after(callOffice); return; }
      const r = net.isOffline() ? { kind: 'offline' } : await loadFees(kid.id);
      if (stopped) return;
      if (r.kind === 'ok') {
        const s = payStatus(rec.before || fees, r.data, rec.intent.allocations);
        if (s === 'paid') { clear(); return receipt(rec, r.data); }
        status.textContent = s === 'partial' ? 'কিছু টাকা এসেছে, বাকিটা যাচাই হচ্ছে…' : 'টাকা এসেছে কি না দেখা হচ্ছে…';
      } else status.textContent = 'নেট নেই, নেট এলে আবার দেখা হবে…';
      timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, 1200);
  }
  // ---- 5. receipt ----
  function receipt(rec, newFees) {
    onDone?.(newFees);
    say(h('div', { class: 'pay__ok' }, icon('check'), h('b', { text: 'টাকা পেয়েছি, ধন্যবাদ!' })),
      h('div', { class: 'de-card gx-card pay__rc' }, ...[['টাকা', money(rec.intent.amount)], ['মাধ্যম', METHODS[rec.intent.method]], ['রেফারেন্স', rec.trx_id], ['সন্তান', kid.name]].map(([k, v]) => h('div', { class: 'gx-row' }, h('span', { class: 'de-row__sub', text: k }), h('b', { text: v })))),
      h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: () => sheet.close(), text: 'ঠিক আছে' }));
    toast('ফি জমা হয়েছে, রসিদ ফি-র পাতায় আছে।');
  }

  sheet = openSheet({ title: 'অনলাইনে ফি দিন', content: box, onClose: stop });
  const old = pending();
  if (old && old.kid === kid.id) waiting(old);     // a payment already started: continue it, never start a second one
  else choose();
  return sheet;
}

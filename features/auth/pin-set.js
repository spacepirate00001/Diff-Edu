// P6: make your own PIN. Forced right after sign-in when the account says must_change_pin (no way back, only logout),
// or by choice from "আরও → পিন বদলান" (asks the old PIN first, so a phone left lying around cannot change it).
// A PIN change never waits in the outbox: it needs the net.
import { h } from '../../ui/dom.js';
import { fullPage } from '../../ui/page.js';
import { createPinPad } from '../../ui/pinpad.js';
import { toast } from '../../ui/toast.js';
import { net } from '../../core/net.js';
import { checkOldPin, changePin } from '../../core/account.js';
import { pinProblem, pinsMatch, validPin, normPin } from '../../core/pin.js';
import { loginMessage } from '../../core/errors.js';

const STEPS = {
  old: ['পুরনো পিন দিন', 'আগে আপনার এখনকার পিন দিন।', 'পরের ধাপ'],
  new: ['নতুন পিন', 'নতুন পিন বেছে নিন। ৪ থেকে ৬টা সংখ্যা।', 'পরের ধাপ'],
  again: ['আবার লিখুন', 'একই পিন আরেকবার লিখুন।', 'সেভ করুন'],
};
export function pinSet(ctx, { forced = false } = {}) {
  let step = forced ? 'new' : 'old', first = '', busy = false;
  const head = h('h2', { class: 'pin-step' }), note = h('p', { class: 'full__sub' });
  const msg = h('p', { class: 'login-error', role: 'alert', hidden: true });
  const offline = h('p', { class: 'pin-offline', role: 'status', hidden: true, text: 'নেট লাগবে। নেট চালু করে আবার চেষ্টা করুন।' });
  const save = h('button', { class: 'de-btn de-btn--accent', type: 'button', onclick: () => next() });
  const pad = createPinPad({ label: 'পিন', autocomplete: 'new-password', name: 'new-pin', onChange: () => { msg.hidden = true; update(); }, onSubmit: () => next() });
  const reason = h('p', { class: 'pin-why', text: 'নিরাপত্তার জন্য নিজের পিন ঠিক করুন।' });
  function paint() { const [t, s, b] = STEPS[step]; head.textContent = t; note.textContent = s; save.textContent = busy ? 'একটু অপেক্ষা…' : b; save.classList.toggle('is-loading', busy); pad.clear(); update(); }
  function update() { const off = net.isOffline(); offline.hidden = !off; save.disabled = busy || off || !validPin(pad.value()); }
  const offNet = net.on(update);
  const error = text => { msg.textContent = text; msg.hidden = false; pad.clear(); };
  async function next() {
    if (busy || save.disabled) return;
    const pin = normPin(pad.value());
    if (step === 'old') {
      busy = true; paintBusy();
      const r = await checkOldPin(pin);
      busy = false;
      if (!r.ok) { paint(); return error(loginMessage(r.kind === 'bad' ? 'bad' : r.kind, r.retryAfter).replace('আইডি বা পিন মিলছে না', 'পুরনো পিন মিলছে না')); }
      step = 'new'; return paint();
    }
    if (step === 'new') {
      const bad = pinProblem(pin); if (bad) return error(bad);
      first = pin; step = 'again'; return paint();
    }
    if (!pinsMatch(first, pin)) { step = 'new'; paint(); return error('দুটো পিন মেলেনি। আবার নতুন পিন দিন।'); }
    busy = true; paintBusy();
    const r = await changePin(pin);
    busy = false;
    if (r.ok) { toast('নতুন পিন সেভ হয়ে গেছে।'); pad.destroy(); offNet(); return forced ? ctx.afterPinSet() : ctx.replace('/more'); }
    paint(); pad.clear();
    error(r.stage === 'flag' ? 'নতুন পিন চালু হয়ে গেছে, তবে সার্ভারে পুরোপুরি জমা হয়নি। আবার একই পিন দিয়ে সেভ করুন।' : r.kind === 'offline' ? 'নেট নেই। নেট চালু করে আবার চেষ্টা করুন।' : 'সেভ করা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।');
    if (r.stage === 'flag') { step = 'again'; first = pin; paint(); }
  }
  function paintBusy() { pad.busy(busy); update(); save.textContent = 'একটু অপেক্ষা…'; save.classList.add('is-loading'); }
  const body = [forced ? reason : null, head, note, msg, offline, h('div', { class: 'pin-card' }, pad.el), save,
    forced ? h('button', { class: 'de-btn de-btn--text on-brand-link', type: 'button', onclick: () => ctx.logout(), text: 'লগআউট' }) : null];
  const node = fullPage({ tone: 'deep', title: forced ? 'নিজের পিন ঠিক করুন' : 'পিন বদলান', back: !forced, onBack: () => ctx.back(), label: 'pin-set', children: body });
  paint();
  return { node, destroy() { pad.destroy(); offNet(); } };
}

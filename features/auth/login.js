// P4: login with a mobile number or id and a 4-6 digit PIN. Same account as the old app (own session, see core/session.js).
import { h } from '../../ui/dom.js';
import { fullPage } from '../../ui/page.js';
import { field } from '../../ui/field.js';
import { createPinPad } from '../../ui/pinpad.js';
import { session } from '../../core/session.js';
import { loadMe, rememberedId, rememberId } from '../../core/account.js';
import { loginMessage } from '../../core/errors.js';
import { validLoginId, loginId, validPin, normPin } from '../../core/pin.js';
import { openForgot } from './forgot.js';

export function login(ctx) {
  const id = field({ label: 'মোবাইল নম্বর বা আইডি', value: rememberedId(), autocomplete: 'username', onBrand: true, name: 'username', help: 'কোচিং থেকে দেওয়া আইডি' });
  id.input.setAttribute('autocapitalize', 'none'); id.input.setAttribute('spellcheck', 'false'); id.input.setAttribute('autocorrect', 'off');
  const remember = h('input', { type: 'checkbox', id: 'remember', checked: !!rememberedId() });
  const msg = h('p', { class: 'login-error', role: 'alert', hidden: true });
  let busy = false;
  const pad = createPinPad({ label: 'পিন', onChange: () => { msg.hidden = true; id.error(''); update(); }, onSubmit: () => submit() });
  const go = h('button', { class: 'de-btn de-btn--accent', type: 'button', onclick: () => submit(), text: 'ঢুকুন' });
  function update() { go.disabled = busy || !validLoginId(id.input.value) || !validPin(pad.value()); }
  id.input.addEventListener('input', () => { msg.hidden = true; id.error(''); update(); });
  function fail(text) { msg.textContent = text; msg.hidden = false; id.error(text.startsWith('আইডি') ? ' ' : ''); }
  async function submit() {
    if (busy || go.disabled) return;
    busy = true; go.textContent = 'একটু অপেক্ষা…'; go.classList.add('is-loading'); pad.busy(true); msg.hidden = true; update();
    const r = await session.signIn(id.input.value, pad.value());
    let kind = r.ok ? 'ok' : r.kind;
    if (r.ok) {
      const me = await loadMe();
      if (!me.me) { await session.signOut(); kind = me.kind === 'noprofile' ? 'noprofile' : me.kind === 'offline' ? 'offline' : 'busy'; }
    }
    busy = false; go.textContent = 'ঢুকুন'; go.classList.remove('is-loading'); pad.busy(false);
    if (kind === 'ok') { rememberId(remember.checked ? loginId(id.input.value) : ''); pad.destroy(); await ctx.afterSignIn(); return; }
    fail(loginMessage(kind, r.retryAfter));
    pad.clear(); pad.error(''); update();
  }
  const node = fullPage({ tone: 'deep', title: 'লগইন', back: true, onBack: () => ctx.back(), label: 'login', children: [
    h('p', { class: 'full__sub', text: 'কোচিং থেকে দেওয়া আইডি ও পিন দিন' }),
    h('form', { class: 'login-form', onsubmit: e => e.preventDefault() }, id.el,
      h('label', { class: 'check-row check-row--brand', for: 'remember' }, remember, h('span', { text: 'এই ফোনে আইডি মনে রাখুন' })), msg,
      pad.el,
      h('button', { class: 'de-btn de-btn--text on-brand-link', type: 'button', onclick: openForgot, text: 'পিন ভুলে গেছেন?' }), go),
  ] });
  update();
  return { node, destroy: () => pad.destroy() };
}
export { normPin };

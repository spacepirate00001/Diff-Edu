// "নতুন ছাত্র যোগ" (admin): one form makes the student's login and the guardian's login together (edge function admin-users, create_family).
// The server makes both or neither. New logins must set their own PIN on first sign-in. The admin copies the words and sends them to the family.
import { h } from '../../ui/dom.js';
import { chip, chipRow } from '../../ui/chip.js';
import { field } from '../../ui/field.js';
import { toast } from '../../ui/toast.js';
import { bn } from '../../core/bn.js';
import { fn } from '../../core/api.js';
import { store } from '../../core/store.js';
import { LEVELS, SHIFT_IDS, RELATIONS, newPin, loginOf, digitsOf, validateFamily, familyText, familyError } from './logic.js';

export function familyPage() {
  const root = h('div', { class: 'tc-page' });
  let f, dead = false;
  const blank = () => ({ cls: null, shift: 'morning', rel: '', busy: false });
  const form = () => {
    f = blank();
    const F = {
      name: field({ label: 'ছাত্রের পুরো নাম', maxlength: 100 }), roll: field({ label: 'রোল', inputmode: 'numeric', maxlength: 9 }),
      login: field({ label: 'ছাত্রের লগইন আইডি', maxlength: 20, help: 'ইংরেজি ছোট অক্ষর বা সংখ্যা, যেমন s105 বা test1', autocomplete: 'off' }),
      pin: field({ label: 'ছাত্রের পিন', inputmode: 'numeric', maxlength: 6, value: newPin(), help: 'প্রথম লগইনে ছাত্র নিজের পিন বদলে নেবে।', autocomplete: 'off' }),
      phone: field({ label: 'ছাত্রের মোবাইল (না থাকলে ফাঁকা রাখুন)', inputmode: 'tel', maxlength: 11 }),
      gName: field({ label: 'অভিভাবকের নাম', maxlength: 100 }), gPhone: field({ label: 'অভিভাবকের মোবাইল', inputmode: 'tel', maxlength: 11, help: 'এই নম্বরই অভিভাবকের লগইন আইডি। এসএমএস এই নম্বরে যাবে।' }),
      gPin: field({ label: 'অভিভাবকের পিন', inputmode: 'numeric', maxlength: 6, value: newPin(), help: 'আগে থেকেই অভিভাবক থাকলে (ভাইবোন) তাঁর পিন বদলাবে না।', autocomplete: 'off' }),
    };
    const clsBox = h('div'), shiftBox = h('div'), relBox = h('div'), clsErr = h('p', { class: 'de-field__help', 'aria-live': 'polite' });
    const draw = () => {
      clsBox.replaceChildren(h('p', { class: 'de-field__label', text: 'ক্লাস' }), chipRow('ক্লাস', LEVELS.map(l => chip(bn(l), f.cls === l, () => { f.cls = l; clsErr.textContent = ''; draw(); }))));
      shiftBox.replaceChildren(h('p', { class: 'de-field__label', text: 'ব্যাচ' }), chipRow('ব্যাচ', SHIFT_IDS.map(([k, l]) => chip(l, f.shift === k, () => { f.shift = k; draw(); }))));
      relBox.replaceChildren(h('p', { class: 'de-field__label', text: 'সম্পর্ক (ঐচ্ছিক)' }), chipRow('সম্পর্ক (ঐচ্ছিক)', RELATIONS.map(r => chip(r, f.rel === r, () => { f.rel = f.rel === r ? '' : r; draw(); }))));
    };
    draw();
    F.login.input.addEventListener('input', () => { const v = loginOf(F.login.input.value); if (v !== F.login.input.value) F.login.input.value = v; });
    for (const k of ['pin', 'gPin', 'phone', 'gPhone', 'roll']) F[k].input.addEventListener('input', () => { const v = digitsOf(F[k].input.value, F[k].input.maxLength); if (v !== F[k].input.value) F[k].input.value = v; });
    const go = h('button', { class: 'de-btn de-btn--primary', type: 'button', text: 'পরিবার যোগ করুন' });
    go.addEventListener('click', async () => {
      const v = validateFamily({ name: F.name.input.value, cls: f.cls, roll: F.roll.input.value, shift: f.shift, login: F.login.input.value, pin: F.pin.input.value, phone: F.phone.input.value, gName: F.gName.input.value, gPhone: F.gPhone.input.value, gPin: F.gPin.input.value, rel: f.rel });
      for (const k of Object.keys(F)) F[k].error(v.errors[k] || ''); clsErr.textContent = v.errors.cls || '';
      if (!v.ok || f.busy) return;
      f.busy = true; go.disabled = true; go.textContent = 'একটু অপেক্ষা…';
      const res = await fn('admin-users', v.value, true);
      if (dead) return;
      f.busy = false; go.disabled = false; go.textContent = 'পরিবার যোগ করুন';
      if (res.kind !== 'ok') return toast(familyError(res));
      store.del?.('c.allstudents');
      done({ sLogin: v.value.student.login_id, sPin: v.value.student.pin, gLogin: v.value.guardian.phone, gPin: v.value.guardian.pin, existed: !!res.data?.guardian_existed, name: v.value.student.full_name });
    });
    root.replaceChildren(
      h('section', { class: 'de-card tc-body' }, h('h2', { class: 'tc-h', text: 'ছাত্র' }), F.name.el, clsBox, clsErr, F.roll.el, shiftBox, F.login.el, F.pin.el, F.phone.el),
      h('section', { class: 'de-card tc-body' }, h('h2', { class: 'tc-h', text: 'অভিভাবক' }), F.gName.el, F.gPhone.el, relBox, F.gPin.el),
      go);
  };
  const done = r => {
    const text = familyText(r);
    root.replaceChildren(h('section', { class: 'de-card tc-body' }, h('h2', { class: 'tc-h', id: 'page-title', tabindex: '-1', text: `${r.name}-কে যোগ করা হয়েছে` }),
      h('p', { class: 'de-row__sub', text: 'এই কথাগুলো কপি করে পরিবারকে পাঠান। এই পাতা ছেড়ে গেলে পিন আর দেখা যাবে না।' }),
      h('pre', { class: 'tc-pre', text }),
      h('div', { class: 'tc-actions' },
        h('button', { class: 'de-btn de-btn--primary', type: 'button', text: 'কপি করুন', onclick: async () => { try { await navigator.clipboard.writeText(text); toast('কপি হয়েছে'); } catch { toast('কপি হয়নি, লেখা চেপে ধরে কপি করুন।'); } } }),
        h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: 'আরেকজন যোগ করুন', onclick: form }))));
    root.querySelector('#page-title')?.focus({ preventScroll: true });
  };
  form();
  return { node: root, destroy() { dead = true; } };
}

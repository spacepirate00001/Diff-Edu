// P10: admission interest, no login. Calls rpc submit_admission_inquiry with the parameters the server really takes
// (p_slug, p_child_name, p_class_level, p_guardian_name, p_phone, p_preferred_shift, p_note). Never queued: no user id to attach it to.
import { h } from '../../ui/dom.js';
import { fullPage } from '../../ui/page.js';
import { field } from '../../ui/field.js';
import { fn, rpc } from '../../core/api.js';
import { cleanPhone, bn } from '../../core/bn.js';
import { CFG, OFFICE_PHONE_BN } from '../../core/config.js';
import { CLASS_BN } from '../today/today.js';
import { callOfficeButton } from '../auth/forgot.js';

export function inquiryArgs({ child, level, guardian, phone, shift, note }) {
  return { p_slug: CFG.slug, p_child_name: child.trim(), p_class_level: Number(level), p_guardian_name: guardian.trim() || null, p_phone: cleanPhone(phone), p_preferred_shift: shift || null, p_note: note.trim() || null };
}
// Server answer -> words
export function inquiryMessage(res) {
  const text = JSON.stringify(res.data || '');
  if (res.kind === 'offline') return 'পাঠানো যায়নি। নেট দেখে আবার পাঠান।';
  if (/too many requests/i.test(text)) return 'আজ এই নম্বর থেকে অনেকবার পাঠানো হয়েছে। পরে চেষ্টা করুন বা অফিসে ফোন করুন।';
  if (/invalid inquiry/i.test(text)) return 'তথ্য ঠিক নেই। নাম ও নম্বর দেখুন।';
  return 'পাঠানো যায়নি। নেট দেখে আবার পাঠান।';
}
export function admission(ctx) {
  const child = field({ label: 'শিক্ষার্থীর নাম', name: 'child', autocomplete: 'off', required: true });
  const guardian = field({ label: 'অভিভাবকের নাম', name: 'guardian', autocomplete: 'name' });
  const phone = field({ label: 'মোবাইল নম্বর', name: 'phone', type: 'tel', inputmode: 'tel', autocomplete: 'tel', help: '০১ দিয়ে শুরু, ১১ সংখ্যা', required: true });
  const note = field({ label: 'বার্তা (ইচ্ছা হলে)', name: 'note', multiline: true, maxlength: 500, help: 'সর্বোচ্চ ৫০০ অক্ষর' });
  const level = h('select', { class: 'de-field__input', id: 'lvl', name: 'level' }, ...Array.from({ length: 10 }, (_, i) => h('option', { value: String(i + 1), text: CLASS_BN[i + 1] + ' শ্রেণি' })));
  const shift = h('select', { class: 'de-field__input', id: 'shift', name: 'shift' }, h('option', { value: '', text: 'যেকোনো' }), ...['সকাল', 'বিকেল', 'রাত'].map(s => h('option', { value: s, text: s })));
  const msg = h('p', { class: 'login-error login-error--light', role: 'alert', hidden: true });
  const send = h('button', { class: 'de-btn de-btn--primary', type: 'submit', text: 'পাঠান' });
  const form = h('form', { class: 'admission-form', novalidate: true },
    child.el, h('div', { class: 'de-field' }, h('label', { class: 'de-field__label', for: 'lvl', text: 'শ্রেণি' }), level), guardian.el, phone.el,
    h('div', { class: 'de-field' }, h('label', { class: 'de-field__label', for: 'shift', text: 'পছন্দের শিফট (ইচ্ছা হলে)' }), shift), note.el, msg, send);
  const about = h('section', { class: 'de-card' }, h('h2', { class: 'de-row__title', text: 'আমাদের সম্পর্কে' }),
    h('p', { class: 'de-row__sub', text: 'ডিফ এডু, কুষ্টিয়া। ২০০৯ সাল থেকে। প্রথম থেকে দশম শ্রেণি, সকাল, বিকেল ও রাতের শিফট।' }),
    h('p', { class: 'de-row__sub', text: 'অফিসের নম্বর: ' + OFFICE_PHONE_BN }));
  const thanks = () => form.replaceWith(h('section', { class: 'de-card thanks', role: 'status' },
    window.Diffy ? window.Diffy.make('cheering', 'de-mascot--lg') : null, h('h2', { class: 'de-row__title', text: 'ধন্যবাদ!' }),
    h('p', { class: 'de-row__sub', text: 'আপনার তথ্য পাওয়া গেছে। অফিস থেকে শীঘ্রই ফোন করা হবে।' }), h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: () => ctx.go('/welcome'), text: 'ঠিক আছে' })));
  let busy = false;
  form.addEventListener('submit', async e => {
    e.preventDefault(); if (busy) return;
    child.error(''); phone.error(''); msg.hidden = true;
    if (!child.input.value.trim()) { child.error('শিক্ষার্থীর নাম লিখুন।'); return child.input.focus(); }
    if (!cleanPhone(phone.input.value)) { phone.error('সঠিক মোবাইল নম্বর দিন (০১ দিয়ে শুরু, ১১ সংখ্যা)।'); return phone.input.focus(); }
    busy = true; send.textContent = 'পাঠানো হচ্ছে…'; send.disabled = true;
    const res = await rpc('submit_admission_inquiry', inquiryArgs({ child: child.input.value, level: level.value, guardian: guardian.input.value, phone: phone.input.value, shift: shift.value, note: note.input.value }));
    busy = false; send.textContent = 'পাঠান'; send.disabled = false;
    if (res.kind === 'ok') return thanks();
    msg.textContent = inquiryMessage(res); msg.hidden = false;
  });
  return { node: fullPage({ tone: 'cream', title: 'ভর্তির আগ্রহ জানান', back: true, onBack: () => ctx.back(), label: 'admission', children: [about, form, h('div', { class: 'admission-call' }, callOfficeButton('অফিসে ফোন করুন'))] }) };
}
export { fn, bn };

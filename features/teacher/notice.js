// "নোটিশ পাঠান": the live code lets staff insert into notices (RLS "staff manage notices"). A notice reaches real people, so it is read back and confirmed before it goes.
import { h } from '../../ui/dom.js';
import { chip, chipRow } from '../../ui/chip.js';
import { field } from '../../ui/field.js';
import { confirmBox } from '../../ui/dialog.js';
import { saveBar } from '../../ui/savebar.js';
import { toast } from '../../ui/toast.js';
import { bn } from '../../core/bn.js';
import { sendNotice } from './data.js';

export const AUDIENCE = [['all', 'সকলে'], ['guardians', 'অভিভাবক'], ['students', 'শিক্ষার্থী'], ['teachers', 'শিক্ষক']];
export const validateNotice = ({ title, body }) => { const t = String(title ?? '').trim(), b = String(body ?? '').trim(); return !t ? { ok: false, why: 'title' } : !b ? { ok: false, why: 'body' } : { ok: true, title: t, body: b }; };
export function noticePage() {
  let aud = 'guardians', level = null;
  const title = field({ label: 'শিরোনাম', maxlength: 120 }), body = field({ label: 'বিস্তারিত', multiline: true, rows: 5, maxlength: 2000, help: 'ছোট, স্পষ্ট বাক্য লিখুন। প্রশংসা আগে, পরামর্শ পরে।' });
  const audBox = h('div'), lvlBox = h('div');
  const go = h('button', { class: 'de-btn de-btn--primary', type: 'button', text: 'নোটিশ পাঠান' });
  const draw = () => {
    audBox.replaceChildren(chipRow('কাদের জন্য', AUDIENCE.map(([k, l]) => chip(l, aud === k, () => { aud = k; draw(); }))));
    lvlBox.replaceChildren(chipRow('কোন ক্লাস', [chip('সব ক্লাস', level == null, () => { level = null; draw(); }), ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(l => chip(bn(l), level === l, () => { level = l; draw(); }))]));
  };
  draw();
  go.addEventListener('click', async () => {
    const v = validateNotice({ title: title.input.value, body: body.input.value });
    title.error(v.why === 'title' ? 'শিরোনাম লিখুন।' : ''); body.error(v.why === 'body' ? 'বিস্তারিত লিখুন।' : '');
    if (!v.ok) return;
    const who = AUDIENCE.find(a => a[0] === aud)[1];
    if (!await confirmBox({ title: 'নোটিশ পাঠাবেন?', text: `"${v.title}" নোটিশটা ${who}-এর ইনবক্সে চলে যাবে${level ? ' (ক্লাস ' + bn(level) + ')' : ''}। পাঠানোর পর ফেরানো যাবে না।`, ok: 'হ্যাঁ, পাঠান', cancel: 'আবার দেখি' })) return;
    go.disabled = true; go.textContent = 'একটু অপেক্ষা…';
    const state = await sendNotice({ title: v.title, body: v.body, audience: aud, class_level: level });
    go.disabled = false; go.textContent = 'নোটিশ পাঠান';
    if (state === 'failed' || state === 'rejected') return saveBar.show(state, { onRetry: () => go.click() });
    saveBar.show(state, { text: state === 'saved' ? 'নোটিশ গেছে' : undefined }); toast(state === 'saved' ? 'নোটিশ পাঠানো হয়েছে।' : 'নেট নেই, নোটিশ ফোনে রাখা হলো।');
    title.input.value = ''; body.input.value = '';
  });
  return { node: h('div', { class: 'tc-page' }, h('div', { class: 'de-card tc-card' }, title.el, body.el, audBox, lvlBox, go), h('p', { class: 'tc-cap', text: 'নোটিশ পাঠালে সেটা ইনবক্সে সবার সামনে থাকবে। ভুল হলে অফিসে জানান।' })) };
}

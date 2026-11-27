// "মানুষ" (admin): find anyone by name, login id or phone; fix their name, phone, class or roll; give a new PIN (a new PIN is shown once, the person must change it at the next sign-in).
import { h } from '../../ui/dom.js';
import { chip, chipRow } from '../../ui/chip.js';
import { field } from '../../ui/field.js';
import { openSheet } from '../../ui/sheet.js';
import { confirmBox } from '../../ui/dialog.js';
import { toast } from '../../ui/toast.js';
import { dataPage } from '../../ui/datapage.js';
import { stateCard } from '../../ui/states.js';
import { icon } from '../../ui/icons.js';
import { sel, request, fn, rows } from '../../core/api.js';
import { store } from '../../core/store.js';
import { bn } from '../../core/bn.js';
import { LEVELS, PEOPLE_ROLES, filterPeople, personSub, personPatch, pinResetCall, pinResetText, newPin, digitsOf } from './logic.js';

const load = async () => {
  const r = await sel('profiles', 'select=id,full_name,login_id,role,phone,students(id,class_level,roll,active)&role=in.(student,guardian,teacher)&order=full_name&limit=2000');
  return r.kind === 'ok' ? { kind: 'ok', data: rows(r) } : { kind: r.kind === 'offline' ? 'offline' : 'error' };
};
export function peoplePage() {
  let q = '', role = '';
  return dataPage({
    key: 'office.people', load, isEmpty: () => false,
    draw: (d, reload) => {
      const search = field({ label: 'নাম, আইডি বা মোবাইল', value: q, autocomplete: 'off' }), box = h('div');
      const list = () => {
        const shown = filterPeople(d, { q, role }).slice(0, 80);
        box.replaceChildren(shown.length ? h('div', { class: 'de-card' }, h('ul', { class: 'tc-list' }, ...shown.map(p => h('li', {}, h('button', { class: 'de-row more-row', type: 'button', onclick: () => edit(p, reload) },
          h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: p.full_name }), h('span', { class: 'de-row__sub', text: personSub(p) })), icon('chev'))))))
          : stateCard({ kind: 'empty', title: 'কাউকে পাওয়া গেল না', text: 'নামের অন্য বানানে বা আইডি দিয়ে খুঁজুন।' }));
      };
      search.input.addEventListener('input', () => { q = search.input.value; list(); });
      const chips = h('div'), drawChips = () => chips.replaceChildren(chipRow('কারা', [chip('সবাই', !role, () => { role = ''; drawChips(); list(); }), ...PEOPLE_ROLES.map(([k, l]) => chip(l, role === k, () => { role = k; drawChips(); list(); }))]));
      drawChips(); list();
      return h('div', { class: 'tc-page' }, search.el, chips, box, d.length > 80 ? h('p', { class: 'tc-cap', text: 'প্রথম ৮০ জন দেখানো হচ্ছে, নাম লিখে খুঁজুন।' }) : null);
    },
  });
}
function edit(p, reload) {
  const s0 = p.students?.[0]; let cls = s0 ? Number(s0.class_level) : null;
  const name = field({ label: 'নাম', value: p.full_name, maxlength: 100 }), phone = field({ label: 'মোবাইল', value: p.phone || '', inputmode: 'tel', maxlength: 11 });
  const roll = s0 ? field({ label: 'রোল', value: String(s0.roll ?? ''), inputmode: 'numeric', maxlength: 9 }) : null;
  const clsBox = h('div'), drawCls = () => clsBox.replaceChildren(chipRow('ক্লাস', LEVELS.map(l => chip(bn(l), cls === l, () => { cls = l; drawCls(); }))));
  if (s0) drawCls();
  const save = h('button', { class: 'de-btn de-btn--primary', type: 'button', text: 'সংরক্ষণ' });
  const reset = h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: 'নতুন পিন দিন' });
  const sheet = openSheet({ title: p.full_name, content: h('div', { class: 'sheet-col' }, h('p', { class: 'de-row__sub', text: personSub(p) }), name.el, phone.el, roll?.el, s0 ? clsBox : null, save, reset) });
  save.addEventListener('click', async () => {
    const v = personPatch(p, { name: name.input.value, phone: phone.input.value, cls, roll: roll?.input.value });
    name.error(v.errors.name || ''); phone.error(v.errors.phone || ''); roll?.error(v.errors.roll || ''); if (!v.ok) return;
    if (!v.changed) return sheet.close();
    save.disabled = true;
    const rs = [];
    if (Object.keys(v.profile).length) rs.push(await request('PATCH', `/rest/v1/profiles?id=eq.${p.id}`, v.profile, { prefer: 'return=minimal' }));
    if (Object.keys(v.student).length) rs.push(await request('PATCH', `/rest/v1/students?id=eq.${s0.id}`, v.student, { prefer: 'return=minimal' }));
    save.disabled = false;
    const bad = rs.find(r => r.kind !== 'ok');
    if (bad) return toast(bad.kind === 'offline' ? 'নেট নেই। নেট এলে আবার চেষ্টা করুন।' : 'হয়নি, আবার চেষ্টা করুন।');
    store.del?.('c.allstudents'); sheet.close(); toast('সংরক্ষণ হয়েছে।'); reload();
  });
  reset.addEventListener('click', async () => {
    if (!await confirmBox({ title: 'নতুন পিন দেবেন?', text: `${p.full_name}-এর পুরোনো পিন আর চলবে না। নতুন পিন একবারই দেখাবে, ঢুকে ওনাকে নিজের পিন বানাতে হবে।`, ok: 'হ্যাঁ, নতুন পিন দিন' })) return;
    const pin = newPin(); reset.disabled = true;
    const r = await fn('admin-users', pinResetCall(p.login_id, pin), true);
    reset.disabled = false;
    if (r.kind !== 'ok') return toast(r.kind === 'offline' ? 'নেট নেই। নেট এলে আবার চেষ্টা করুন।' : 'পিন বদলানো যায়নি, আবার চেষ্টা করুন।');
    sheet.close(); showPin(p, pin);
  });
}
function showPin(p, pin) {
  const text = pinResetText(p, pin);
  openSheet({ title: 'নতুন পিন তৈরি', content: h('div', { class: 'sheet-col' }, h('p', { class: 'de-row__sub', text: 'কপি করে ওনাকে পাঠান। এই পাতা বন্ধ করলে পিন আর দেখা যাবে না।' }), h('pre', { class: 'tc-pre', text }),
    h('button', { class: 'de-btn de-btn--primary', type: 'button', text: 'কপি করুন', onclick: async () => { try { await navigator.clipboard.writeText(text); toast('কপি হয়েছে'); } catch { toast('কপি হয়নি, লেখা চেপে ধরে কপি করুন।'); } } })) });
}

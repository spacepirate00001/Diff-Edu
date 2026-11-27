// "নম্বর সংশোধন" (admin): teachers report a guardian's wrong phone number; the admin sets the right one or turns the report down.
import { h } from '../../ui/dom.js';
import { field } from '../../ui/field.js';
import { openSheet } from '../../ui/sheet.js';
import { confirmBox } from '../../ui/dialog.js';
import { toast } from '../../ui/toast.js';
import { dataPage } from '../../ui/datapage.js';
import { stateCard } from '../../ui/states.js';
import { icon } from '../../ui/icons.js';
import { sel, rpc, rows } from '../../core/api.js';
import { store } from '../../core/store.js';
import { bn } from '../../core/bn.js';
import { phoneDecision, rejectCall, phoneReqError } from './logic.js';

const SELECT = 'id,student_id,guardian_id,old_phone,new_phone,owner,note,student:students(roll,profile:profiles!students_profile_id_fkey(full_name)),guardian:profiles!phone_change_requests_guardian_id_fkey(full_name),reporter:profiles!phone_change_requests_reported_by_fkey(full_name)';
const load = async () => {
  const r = await sel('phone_change_requests', `select=${SELECT}&status=eq.pending&order=created_at&limit=200`);
  return r.kind === 'ok' ? { kind: 'ok', data: rows(r) } : { kind: r.kind === 'offline' ? 'offline' : 'error' };
};
const who = r => r.student?.profile?.full_name || (r.student?.roll ? `রোল ${bn(r.student.roll)}` : 'ছাত্র');
export function correctionsPage() {
  return dataPage({
    key: 'office.corrections', load, isEmpty: d => !d.length,
    empty: () => stateCard({ kind: 'empty', title: 'কোনো সংশোধনের অনুরোধ নেই', text: 'শিক্ষক কোনো অভিভাবকের নম্বর ভুল জানালে এখানে আসবে।' }),
    draw: (d, reload) => h('div', { class: 'tc-page' }, h('p', { class: 'tc-sub', text: `${bn(d.length)}টা অনুরোধ বাকি` }), h('div', { class: 'de-card' }, h('ul', { class: 'tc-list' }, ...d.map(r => h('li', {}, h('button', { class: 'de-row more-row', type: 'button', onclick: () => decide(r, reload) },
      h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: `${who(r)} · অভিভাবক ${r.guardian?.full_name || ''}` }), h('span', { class: 'de-row__sub', text: `${bn(r.old_phone || '')}${r.new_phone ? ' → ' + bn(r.new_phone) : ''} · জানিয়েছেন ${r.reporter?.full_name || ''}` })), icon('chev'))))))),
  });
}
function decide(r, reload) {
  const phone = field({ label: 'সঠিক নম্বর', value: r.new_phone || '', inputmode: 'tel', maxlength: 11, help: 'অভিভাবকের লগইন আইডি আর এসএমএসের নম্বর এটাই হবে।' });
  const ok = h('button', { class: 'de-btn de-btn--primary', type: 'button', text: 'নম্বর বদলান' }), no = h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: 'অনুরোধ বাতিল' });
  const sheet = openSheet({ title: `${who(r)}-এর অভিভাবক`, content: h('div', { class: 'sheet-col' },
    h('p', { class: 'de-row__sub', text: `${r.guardian?.full_name || ''} · এখনকার নম্বর ${bn(r.old_phone || '')} · জানিয়েছেন ${r.reporter?.full_name || ''}` }), r.note ? h('p', { class: 'tc-body', text: r.note }) : null, phone.el, ok, no) });
  const run = async (call, done) => {
    ok.disabled = no.disabled = true;
    const res = await rpc(call.name, call.args);
    ok.disabled = no.disabled = false;
    if (res.kind !== 'ok') return toast(phoneReqError(res));
    store.del?.('c.contacts'); sheet.close(); toast(done); reload();
  };
  ok.addEventListener('click', () => { const v = phoneDecision(r, phone.input.value); phone.error(v.error || ''); if (v.ok) run(v.call, 'নম্বর বদলে গেছে।'); });
  no.addEventListener('click', async () => { if (await confirmBox({ title: 'অনুরোধ বাতিল করবেন?', text: 'নম্বর আগের মতোই থাকবে।', ok: 'হ্যাঁ, বাতিল' })) run(rejectCall(r), 'অনুরোধ বাতিল হয়েছে।'); });
}

// Step 6 reads and writes (admin office; the teacher's honorarium). Every loader returns { kind, data }: 'ok' | 'offline' | 'error' | 'forbidden'. Nothing throws.
// Small, repeatable writes (a class log, a rate, a note, a notice) go through the outbox; money and deletes need the net (they say so).
import { sel, rpc, rows, request } from '../../core/api.js';
import { outbox } from '../../core/outbox-app.js';
import { session } from '../../core/session.js';
import { dhakaDay, uuid } from '../../core/bn.js';
import { sendNotice } from '../teacher/data.js';
import { classLogRow, CLASS_LOG_PATH, CLASS_LOG_PREFER, rateRow, honorPayRow, HONOR_PAY_PATH, paymentCall, generateCall, monthStart, nextMonthStart, addDaysIso, LOG_BACK_DAYS, archiveCall, deleteCall, admitStatusPatch, owedMonths } from './logic.js';

const fail = r => ({ kind: r.kind === 'ok' ? 'error' : r.kind });
const coaching = () => session.me()?.coaching_id, uid = () => session.uid();
export const today = () => dhakaDay();
const ok = data => ({ kind: 'ok', data });
const stateOf = r => (r.kind === 'ok' ? 'saved' : r.kind === 'offline' ? 'offline' : 'failed');

// ---- fees ----
const FEE = 'id,student_id,month,amount,paid_amount,status,student:students(class_level,roll,profile:profiles!students_profile_id_fkey(full_name,login_id,phone))';
const feeRow = f => ({ id: f.id, student_id: f.student_id, month: f.month, amount: Number(f.amount), paid_amount: Number(f.paid_amount), status: f.status,
  student: { class_level: f.student?.class_level, roll: f.student?.roll, name: f.student?.profile?.full_name || '', login: f.student?.profile?.login_id || '', phone: f.student?.profile?.phone || null } });
// -> { fees: [row] of this month, owed: { student_id: months }, partial }
export async function loadFees(key) {
  const [m, o] = await Promise.all([
    sel('fees', `select=${FEE}&month=eq.${monthStart(key)}&limit=3000`),
    sel('fees', `select=student_id,amount,paid_amount&status=in.(due,partial)&month=lt.${nextMonthStart(key)}&limit=10000`)]);
  if (m.kind !== 'ok') return fail(m);
  return ok({ fees: rows(m).map(feeRow), owed: o.kind === 'ok' ? owedMonths(rows(o).map(f => ({ ...f, amount: Number(f.amount), paid_amount: Number(f.paid_amount) }))) : {}, partial: o.kind !== 'ok' });
}
// A payment is money: the net is needed and a repeat is the same payment (the ledger keys on method + id + amount). -> { kind: 'ok' | 'offline' | 'error', text? }
export async function recordPayment(args) {
  const c = paymentCall(args), r = await rpc(c.name, c.args);
  return r.kind === 'ok' ? { kind: 'ok' } : { kind: r.kind, text: r.data?.message || '' };
}
export async function generateFees(key, value) {
  const c = generateCall(key, value), r = await rpc(c.name, c.args);
  return r.kind === 'ok' ? { kind: 'ok', made: Number(r.data) || 0 } : { kind: r.kind, text: r.data?.message || '' };
}

// ---- honorarium ----
export async function loadTeachers() {
  const r = await sel('profiles', 'select=id,full_name&role=eq.teacher&order=full_name&limit=200');
  return r.kind === 'ok' ? ok(rows(r)) : fail(r);
}
// admin: every teacher for the month -> { teachers, logs: {id: n}, rates: {id: per_class}, paid: {id: {classes, amount}} }
export async function loadHonor(key) {
  const [t, l, r, p] = await Promise.all([loadTeachers(),
    sel('class_logs', `select=teacher_id&day=gte.${monthStart(key)}&day=lt.${nextMonthStart(key)}&limit=20000`),
    sel('pay_rates', 'select=teacher_id,per_class&limit=500'),
    sel('honorarium_payments', `select=teacher_id,classes,amount&month=eq.${monthStart(key)}&limit=500`)]);
  if (t.kind !== 'ok') return t;
  if (l.kind !== 'ok') return fail(l);
  const logs = {}; for (const x of rows(l)) logs[x.teacher_id] = (logs[x.teacher_id] || 0) + 1;
  const rates = {}; for (const x of rows(r)) rates[x.teacher_id] = Number(x.per_class);
  const paid = {}; for (const x of rows(p)) paid[x.teacher_id] = { classes: x.classes, amount: Number(x.amount) };
  return ok({ teachers: t.data, logs, rates, paid, partial: r.kind !== 'ok' || p.kind !== 'ok' });
}
export async function saveRate(teacher_id, per_class) {
  return (await outbox.submit({ uid: uid(), method: 'POST', path: '/rest/v1/pay_rates?on_conflict=teacher_id', body: rateRow({ coaching_id: coaching(), teacher_id, per_class }), prefer: 'return=minimal,resolution=merge-duplicates', label: 'সম্মানীর হার' })).state;
}
// pays one teacher's month with the numbers the admin saw (classes x rate), -> state
export async function payTeacher({ teacher_id, key, classes, amount }) {
  return (await outbox.submit({ uid: uid(), method: 'POST', path: HONOR_PAY_PATH, body: honorPayRow({ coaching_id: coaching(), teacher_id, month: monthStart(key), classes, amount, uid: uid() }), prefer: 'return=minimal,resolution=ignore-duplicates', label: 'সম্মানী পরিশোধ' })).state;
}
// teacher: my class logs of a month, my rate, whether paid -> { logs: [{id, day, label}], rate, paid }
export async function loadMyHonor(key) {
  const me = uid();
  const [l, r, p] = await Promise.all([sel('class_logs', `select=id,day,label&teacher_id=eq.${me}&day=gte.${monthStart(key)}&day=lt.${nextMonthStart(key)}&order=day.desc,created_at.desc&limit=500`),
    sel('pay_rates', `select=per_class&teacher_id=eq.${me}`), sel('honorarium_payments', `select=classes,amount,paid_at&teacher_id=eq.${me}&month=eq.${monthStart(key)}`)]);
  if (l.kind !== 'ok') return fail(l);
  return ok({ logs: rows(l), rate: rows(r)[0] ? Number(rows(r)[0].per_class) : null, paid: rows(p)[0] ? { ...rows(p)[0], amount: Number(rows(p)[0].amount) } : null });
}
export async function addClassLog({ day, label }) {
  return (await outbox.submit({ uid: uid(), method: 'POST', path: CLASS_LOG_PATH, body: classLogRow({ coaching_id: coaching(), uid: uid(), day, label }), prefer: CLASS_LOG_PREFER, label: 'নেওয়া ক্লাস' })).state;
}
export async function removeClassLog(id) {
  const r = await request('DELETE', `/rest/v1/class_logs?id=eq.${id}`);
  return stateOf(r);
}
export { LOG_BACK_DAYS, addDaysIso };

// ---- admission inquiries ----
export async function loadAdmissions() {
  const r = await sel('admission_inquiries', 'select=id,child_name,class_level,guardian_name,phone,preferred_shift,note,status,staff_note,handled_at,created_at&order=created_at.desc&limit=500');
  return r.kind === 'ok' ? ok(rows(r)) : fail(r);
}
export async function updateAdmission(id, change) {
  const p = admitStatusPatch(change);
  if (!p.ok) return 'failed';
  return (await outbox.submit({ uid: uid(), method: 'PATCH', path: `/rest/v1/admission_inquiries?id=eq.${id}`, body: p.patch, prefer: 'return=minimal', label: 'ভর্তির খোঁজ' })).state;
}

// ---- notices ----
export async function loadNotices() {
  const r = await sel('notices', 'select=id,title,body,audience,class_level,created_at,archived_at&order=created_at.desc&limit=200');
  return r.kind === 'ok' ? ok(rows(r)) : fail(r);
}
export { sendNotice };
export async function setArchived(id, archived) { const c = archiveCall(id, archived), r = await rpc(c.name, c.args); return stateOf(r); }
export async function deleteNotice(id) { const c = deleteCall(id), r = await rpc(c.name, c.args); return stateOf(r); }
export { uuid };

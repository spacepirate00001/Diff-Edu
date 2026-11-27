// Step 6 (admin office + the teacher's honorarium): fees, honorarium, admission inquiries, notices. Pure (no DOM, no network), so node --test can check it.
// Contracts are the live ones: fees (+ payments ledger: rpc record_payment, generate_monthly_fees), class_logs / pay_rates / honorarium_payments,
// admission_inquiries (+ 69 status), notices (+ rpc set_notice_archived / delete_archived_notice).
import { bn, ascii, money, MONTHS, cleanPhone } from '../../core/bn.js';
import { dueOf, feeState, monthKey, METHODS } from '../fees/logic.js';

export { dueOf, feeState };
export const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const addMonthsKey = (key, n) => { const [y, m] = key.split('-').map(Number); const i = y * 12 + (m - 1) + n; return `${Math.floor(i / 12)}-${String(i % 12 + 1).padStart(2, '0')}`; };
export const shiftMonth = addMonthsKey;
export const monthStart = key => key + '-01';
export const monthName = key => { const [y, m] = key.split('-').map(Number); return `${MONTHS[m - 1]} ${bn(y)}`; };
export const nextMonthStart = key => addMonthsKey(key, 1) + '-01';
export const keyOfDay = iso => String(iso).slice(0, 7);

// ================= fees =================
// A row here: { id, student_id, month, amount, paid_amount, status, student: { class_level, roll, name, phone } }
export const FEE_FILTERS = [['all', 'সব'], ['due', 'বাকি'], ['partial', 'কিছু বাকি'], ['paid', 'পরিশোধিত'], ['owed2', '২+ মাস বাকি']];
export const feeKind = f => (dueOf(f) <= 0 ? 'paid' : Number(f.paid_amount || 0) > 0 ? 'partial' : 'due');
// owed: { student_id: number of months with something due } over every month, not only this one
export function feeSummary(rows) {
  const s = { n: rows.length, paid: 0, partial: 0, due: 0, amount: 0, collected: 0, left: 0 };
  for (const f of rows) { s[feeKind(f)]++; s.amount += Number(f.amount || 0); s.collected += Math.min(Number(f.paid_amount || 0), Number(f.amount || 0)); s.left += dueOf(f); }
  return s;
}
const norm = s => ascii(String(s ?? '')).replace(/\s+/g, ' ').trim().toLowerCase();
export function filterFees(rows, { filter = 'all', level = null, q = '', owed = {} } = {}) {
  const t = norm(q);
  return rows.filter(f => (filter === 'all' || (filter === 'owed2' ? (owed[f.student_id] || 0) >= 2 && dueOf(f) > 0 : feeKind(f) === filter))
    && (!level || f.student?.class_level === level) && (!t || norm(f.student?.name).includes(t) || norm(f.student?.roll) === t || norm(f.student?.login).includes(t)))
    .sort((a, b) => (a.student?.class_level || 0) - (b.student?.class_level || 0) || (parseInt(a.student?.roll, 10) || 999) - (parseInt(b.student?.roll, 10) || 999));
}
// months owed per student, from the unpaid fee rows of every month
export function owedMonths(unpaidRows) { const m = {}; for (const f of unpaidRows) if (dueOf(f) > 0) m[f.student_id] = (m[f.student_id] || 0) + 1; return m; }
// cash taken at the desk, or a bKash / Nagad payment the parent made outside the app. -> { ok, errors: {amount, trx}, value }
export function validatePayment({ method, amount, trx, due }) {
  const errors = {}, a = Number(ascii(amount)), t = String(trx ?? '').trim();
  if (!(method in METHODS)) errors.method = 'কীভাবে দিলেন বেছে নিন';
  if (!(a > 0)) errors.amount = 'টাকার অঙ্ক দিন';
  else if (a > due) errors.amount = `বাকির (${money(due)}) চেয়ে বেশি নেওয়া যাবে না`;
  else if (Math.round(a * 100) !== a * 100) errors.amount = 'পয়সার হিসাব দুই ঘর পর্যন্ত';
  if ((method === 'bkash' || method === 'nagad') && t.length < 6) errors.trx = 'ট্রানজেকশন আইডি লিখুন (অন্তত ৬ অক্ষর)';
  if (t.length > 40) errors.trx = 'আইডি খুব বড়';
  return { ok: !Object.keys(errors).length, errors, value: { method, amount: a, trx: t || null } };
}
// Cash has no id of its own: one is made when the sheet opens and kept for every retry, so a second tap or a repeat after a lost answer is the same payment (the ledger treats the same method + id + amount as one).
export const cashRef = uuid => 'app-' + uuid;
export const paymentCall = ({ fee, value, ref }) => ({ name: 'record_payment', args: { p_method: value.method, p_trx_id: value.trx || (value.method === 'cash' ? ref : null), p_amount: value.amount, p_allocations: [{ fee_id: fee.id, amount: value.amount }] } });
export const PAY_ERR = [[/more than the fee/, 'বাকির চেয়ে বেশি নেওয়া যাবে না'], [/already recorded with different/, 'এই আইডি আগে অন্য অঙ্কে জমা হয়েছে'], [/reversed/, 'এই আইডির পেমেন্ট বাতিল হয়েছিল, নতুন আইডি দিন']];
export const payError = text => (PAY_ERR.find(([re]) => re.test(String(text || ''))) || [null, 'জমা সংরক্ষণ হয়নি, আবার চেষ্টা করুন'])[1];
// "this month's fees for everyone" (amount per student; optionally one class)
export function validateGenerate({ amount, class_level }) {
  const a = Number(ascii(amount)), errors = {};
  if (!(a > 0 && a <= 100000)) errors.amount = 'মাসিক ফি-এর অঙ্ক দিন';
  if (class_level != null && !LEVELS.includes(Number(class_level))) errors.class_level = 'ক্লাস ঠিক নয়';
  return { ok: !Object.keys(errors).length, errors, value: { amount: a, class_level: class_level == null ? null : Number(class_level) } };
}
export const generateCall = (monthKeyStr, { amount, class_level }) => ({ name: 'generate_monthly_fees', args: { p_month: monthStart(monthKeyStr), p_amount: amount, p_class_level: class_level } });
export const feeRowName = f => f.student?.name || 'শিক্ষার্থী';

// ================= honorarium =================
export const LOG_BACK_DAYS = 7;   // a teacher may add a class for today or the 7 days before (class_logs policy)
export const LABEL_MAX = 60;
export const classLogRow = ({ coaching_id, uid, day, label }) => ({ coaching_id, teacher_id: uid, day, label });
export const CLASS_LOG_PATH = '/rest/v1/class_logs?on_conflict=teacher_id,day,label';
export const CLASS_LOG_PREFER = 'return=minimal,resolution=ignore-duplicates';
export const validateLabel = t => { const s = String(t ?? '').replace(/\s+/g, ' ').trim(); return !s ? { ok: false, why: 'কোন ক্লাস নিলেন লিখুন' } : s.length > LABEL_MAX ? { ok: false, why: `${bn(LABEL_MAX)} অক্ষরের মধ্যে লিখুন` } : { ok: true, label: s }; };
// A teacher's own periods of the day become one-tap labels: "বিকাল · ১ম ক্লাস · ক্লাস ৬".
export const periodLabel = (p, names) => `${names.shift(p.shift)} · ${names.slot(p.slot)} ক্লাস${p.levels ? ' · ক্লাস ' + p.levels.map(bn).join(',') : ''}`;
// teachers + their logs, rates and payments -> one card each. logs: { teacherId: count }, rates: { teacherId: per_class }, paid: { teacherId: { classes, amount } }
export function honorCards({ teachers, logs = {}, rates = {}, paid = {} }) {
  return teachers.map(t => {
    const classes = logs[t.id] || 0, rate = Number(rates[t.id] || 0), p = paid[t.id] || null;
    return { id: t.id, name: t.full_name || 'শিক্ষক', classes, rate, amount: Math.round(classes * rate * 100) / 100, paid: p, canPay: !p && classes > 0 && rate > 0, noRate: !p && classes > 0 && !(rate > 0) };
  }).sort((a, b) => (a.paid ? 1 : 0) - (b.paid ? 1 : 0) || a.name.localeCompare(b.name, 'bn'));
}
export const payableTotal = cards => { const l = cards.filter(c => c.canPay); return { n: l.length, amount: l.reduce((s, c) => s + c.amount, 0) }; };
export const validateRate = v => { const n = Number(ascii(v)); return v === '' || v == null || !(n >= 0 && n <= 100000) || Math.round(n * 100) !== n * 100 ? { ok: false, why: 'প্রতি ক্লাসের টাকা দিন (০ থেকে ১,০০,০০০)' } : { ok: true, value: n }; };
export const rateRow = ({ coaching_id, teacher_id, per_class, now = Date.now() }) => ({ teacher_id, coaching_id, per_class, updated_at: new Date(now).toISOString() });
export const honorPayRow = ({ coaching_id, teacher_id, month, classes, amount, uid }) => ({ teacher_id, month, coaching_id, classes, amount, paid_by: uid });
export const HONOR_PAY_PATH = '/rest/v1/honorarium_payments?on_conflict=teacher_id,month';
// Days a teacher can still add or remove a class: today and the 7 days before, and not once the month is paid.
export const canEditLog = ({ day, today, paid }) => !paid && day <= today && day >= addDaysIso(today, -LOG_BACK_DAYS);
export function addDaysIso(iso, n) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export const logDays = today => Array.from({ length: LOG_BACK_DAYS + 1 }, (_, i) => addDaysIso(today, -i));

// ================= admission inquiries =================
export const ADMIT_STATUS = { new: 'নতুন', called: 'ফোন করা হয়েছে', admitted: 'ভর্তি হয়েছে', dropped: 'আর আসবে না' };
export const ADMIT_FILTERS = [['open', 'চলমান'], ['new', 'নতুন'], ['called', 'ফোন করা হয়েছে'], ['admitted', 'ভর্তি হয়েছে'], ['dropped', 'বাদ']];
export const SHIFT_BN = { morning: 'সকাল', afternoon: 'বিকাল', night: 'রাত' };
export const admitMatches = (x, filter) => (filter === 'open' ? x.status === 'new' || x.status === 'called' : x.status === filter);
export const admitCounts = list => { const c = { new: 0, called: 0, admitted: 0, dropped: 0 }; for (const x of list) if (x.status in c) c[x.status]++; return { ...c, open: c.new + c.called }; };
export function admitStatusPatch({ status, note }) {
  const patch = {};
  if (status != null) { if (!(status in ADMIT_STATUS)) return { ok: false, why: 'অবস্থা ঠিক নয়' }; patch.status = status; }
  if (note != null) { const n = String(note).replace(/\s+/g, ' ').trim(); if (n.length > 300) return { ok: false, why: 'নোট ৩০০ অক্ষরের মধ্যে রাখুন' }; patch.staff_note = n || null; }
  return { ok: true, patch };
}
// Bangladeshi mobile numbers: call link and WhatsApp link (no leading 0, country code 880). null when the number is not a mobile.
export function phoneLinks(raw) {
  const p = cleanPhone(raw);
  if (!/^01\d{9}$/.test(p || '')) return null;
  return { tel: 'tel:+88' + p, wa: 'https://wa.me/88' + p, show: bn(p) };
}
export const admitWhatsApp = (x, office = 'ডিফ এডু') => `${office}: ${x.child_name || 'আপনার সন্তান'}-এর ভর্তির আবেদনের জন্য ধন্যবাদ। আমরা আপনার সাথে কথা বলতে চাই।`;
// Needs a call: new, and the oldest first.
export const sortAdmit = list => list.slice().sort((a, b) => ((a.status === 'new' ? 0 : 1) - (b.status === 'new' ? 0 : 1)) || String(a.status === 'new' ? a.created_at : b.created_at).localeCompare(String(a.status === 'new' ? b.created_at : a.created_at)));

// ================= notices (admin) =================
export const NOTICE_AUDIENCE = [['all', 'সকলে'], ['guardians', 'অভিভাবক'], ['students', 'শিক্ষার্থী'], ['teachers', 'শিক্ষক']];
export const audienceName = a => (NOTICE_AUDIENCE.find(x => x[0] === a) || [0, 'সকলে'])[1];
export const TITLE_MAX = 120, BODY_MAX = 2000;
export function validateNoticeForm({ title, body, audience, class_level }) {
  const errors = {}, t = String(title ?? '').trim(), b = String(body ?? '').trim();
  if (!t) errors.title = 'শিরোনাম লিখুন'; else if (t.length > TITLE_MAX) errors.title = `শিরোনাম ${bn(TITLE_MAX)} অক্ষরের মধ্যে`;
  if (!b) errors.body = 'বিস্তারিত লিখুন'; else if (b.length > BODY_MAX) errors.body = `বিস্তারিত ${bn(BODY_MAX)} অক্ষরের মধ্যে`;
  if (!NOTICE_AUDIENCE.some(a => a[0] === audience)) errors.audience = 'কাদের জন্য বেছে নিন';
  if (class_level != null && !LEVELS.includes(Number(class_level))) errors.class_level = 'ক্লাস ঠিক নয়';
  return { ok: !Object.keys(errors).length, errors, value: { title: t, body: b, audience, class_level: class_level == null ? null : Number(class_level) } };
}
// live = not archived. Newest first.
export const splitNotices = list => ({ live: list.filter(n => !n.archived_at).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))), archived: list.filter(n => n.archived_at).sort((a, b) => String(b.archived_at).localeCompare(String(a.archived_at))) });
export const noticeWho = n => audienceName(n.audience) + (n.class_level ? ` · ক্লাস ${bn(n.class_level)}` : '');
export const archiveCall = (id, archived) => ({ name: 'set_notice_archived', args: { p_id: id, p_archived: !!archived } });
export const deleteCall = id => ({ name: 'delete_archived_notice', args: { p_id: id } });
export { money, monthKey };

// ---- নতুন ছাত্র যোগ (admin-users create_family): one student and their guardian, all or nothing ----
export const SHIFT_IDS = [['morning', 'সকাল'], ['afternoon', 'বিকাল'], ['night', 'রাত']];
export const RELATIONS = ['মা', 'বাবা', 'অন্য'];
const LOGIN_OK = /^[a-z0-9]{2,20}$/, PIN_OK = /^\d{4,6}$/, PHONE_OK = /^01[3-9]\d{8}$/, SAME_DIGIT = /^(\d)\1{5}$/;
const WEAK = new Set(['012345', '123456', '234567', '345678', '456789', '543210', '654321', '765432', '876543', '987654']);
// A random 6-digit PIN, skipping the obvious ones (111111, 123456 ...). rnd gives a number from 0 up to 1000000 (not 1), tests pass a fixed one.
export function newPin(rnd = () => { const b = new Uint32Array(1); do { crypto.getRandomValues(b); } while (b[0] >= 4294000000); return b[0] % 1000000; }) {
  for (let i = 0; i < 50; i++) { const p = String(rnd()).padStart(6, '0'); if (!SAME_DIGIT.test(p) && !WEAK.has(p)) return p; }
  return '482917';
}
export const loginOf = s => ascii(s).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
export const digitsOf = (s, max) => ascii(s).replace(/\D/g, '').slice(0, max);
export function validateFamily(f) {
  const e = {}, name = String(f.name || '').trim(), gName = String(f.gName || '').trim(), login = loginOf(f.login), pin = digitsOf(f.pin, 6), phone = digitsOf(f.phone, 11), gPhone = digitsOf(f.gPhone, 11), gPin = digitsOf(f.gPin, 6);
  if (!name) e.name = 'ছাত্রের নাম লিখুন।';
  if (!LEVELS.includes(Number(f.cls))) e.cls = 'ক্লাস বেছে নিন।';
  if (!digitsOf(f.roll, 9)) e.roll = 'রোল নম্বর দিন।';
  if (!SHIFT_IDS.some(s => s[0] === f.shift)) e.shift = 'ব্যাচ বেছে নিন।';
  if (!LOGIN_OK.test(login)) e.login = 'ইংরেজি ছোট অক্ষর বা সংখ্যা, ২ থেকে ২০টি। যেমন test1';
  if (!PIN_OK.test(pin)) e.pin = 'পিন হবে ৪ থেকে ৬ সংখ্যার।';
  if (phone && !PHONE_OK.test(phone)) e.phone = 'নম্বর ০১৩ থেকে ০১৯ দিয়ে শুরু, মোট ১১ সংখ্যা। যেমন ০১৭১২৩৪৫৬৭৮';
  if (!gName) e.gName = 'অভিভাবকের নাম লিখুন।';
  if (!PHONE_OK.test(gPhone)) e.gPhone = 'নম্বর ০১৩ থেকে ০১৯ দিয়ে শুরু, মোট ১১ সংখ্যা। যেমন ০১৭১২৩৪৫৬৭৮';
  else if (gPhone === login) e.gPhone = 'ছাত্রের আইডি আর অভিভাবকের নম্বর আলাদা হতে হবে।';
  if (!PIN_OK.test(gPin)) e.gPin = 'পিন হবে ৪ থেকে ৬ সংখ্যার।';
  const student = { login_id: login, pin, full_name: name, class_level: Number(f.cls), roll: digitsOf(f.roll, 9), shift: f.shift }; if (phone) student.phone = phone;
  const guardian = { full_name: gName, phone: gPhone, pin: gPin }; if (f.rel) guardian.relation = f.rel;
  return { ok: !Object.keys(e).length, errors: e, value: { action: 'create_family', student, guardian } };
}
// The words to copy and send to the family. A guardian who already exists keeps the old PIN.
export const familyText = r => ['ডিফ এডু', '', `ছাত্রের লগইন আইডি: ${r.sLogin}`, `পিন: ${r.sPin}`, '', `অভিভাবকের লগইন আইডি: ${r.gLogin}`, r.existed ? 'অভিভাবক আগে থেকেই আছেন, তাঁর পিন আগের মতোই।' : `পিন: ${r.gPin}`, '', 'প্রথমবার লগইন করে পিন বদলে নিন।'].join('\n');
export function familyError(res) {
  const msg = String(res && res.data && (res.data.error || res.data.message) || '');
  if (res && res.kind === 'offline') return 'নেট নেই। নেট এলে আবার চেষ্টা করুন।';
  if (res && (res.status === 403 || /admin only/i.test(msg))) return 'শুধু অ্যাডমিন এটা করতে পারেন।';
  if (res && res.status === 401) return 'আবার লগইন করুন, তারপর চেষ্টা করুন।';
  if (/student login_id already|student.*(already|exists)/i.test(msg)) return 'ছাত্রের এই আইডি আগে থেকেই আছে, অন্যটা দিন।';
  if (/taken by another role/i.test(msg)) return 'এই নম্বর অন্য কারও (ছাত্র বা শিক্ষকের) আইডি হিসেবে আছে। অভিভাবকের অন্য নম্বর দিন।';
  if (/guardian phone/i.test(msg)) return 'অভিভাবকের নম্বর ঠিক নেই। ০১৩ থেকে ০১৯ দিয়ে শুরু, মোট ১১ সংখ্যা।';
  if (/already|registered|exists|duplicate|unique/i.test(msg + JSON.stringify(res && res.data || ''))) return 'এই আইডি বা নম্বর আগে থেকেই আছে, অন্যটা দিন।';
  if (/PIN/i.test(msg)) return 'পিন হবে ৪ থেকে ৬ সংখ্যার।';
  return 'যোগ করা যায়নি' + (msg ? ` (${msg})` : '') + '। আবার চেষ্টা করুন।';
}


// ---- মানুষ (admin): find a person, fix their name, phone, class or roll, give a new PIN (admin-users reset_pin) ----
export const PEOPLE_ROLES = [['student', 'ছাত্র'], ['guardian', 'অভিভাবক'], ['teacher', 'শিক্ষক']];
// list: profile rows { id, full_name, login_id, role, phone, students: [{ id, class_level, roll, active }] }. q matches the name, login id or phone (Bangla or English digits).
export function filterPeople(list, { q = '', role = '' } = {}) {
  const k = ascii(q).trim().toLowerCase();
  return (list || []).filter(p => (!role || p.role === role) && (!k || [p.full_name, p.login_id, p.phone].some(x => ascii(x || '').toLowerCase().includes(k))))
    .sort((a, b) => String(a.full_name).localeCompare(String(b.full_name), 'bn'));
}
export const personSub = p => [PEOPLE_ROLES.find(r => r[0] === p.role)?.[1], p.students?.[0]?.class_level ? `ক্লাস ${bn(p.students[0].class_level)}` : null, p.students?.[0]?.roll ? `রোল ${bn(p.students[0].roll)}` : null, p.login_id].filter(Boolean).join(' · ');
// What changed: only the fields that differ go to the server. -> { ok, errors, profile: {}, student: {} }
export function personPatch(p, f) {
  const errors = {}, profile = {}, student = {}, name = String(f.name || '').trim(), phone = digitsOf(f.phone, 11), s0 = p.students?.[0];
  if (!name) errors.name = 'নাম লিখুন।';
  if (phone && !PHONE_OK.test(phone)) errors.phone = 'নম্বর ০১৩ থেকে ০১৯ দিয়ে শুরু, মোট ১১ সংখ্যা। যেমন ০১৭১২৩৪৫৬৭৮';
  if (name && name !== p.full_name) profile.full_name = name;
  if (phone !== (p.phone || '')) profile.phone = phone || null;
  if (s0) {
    if (!LEVELS.includes(Number(f.cls))) errors.cls = 'ক্লাস বেছে নিন।';
    else if (Number(f.cls) !== Number(s0.class_level)) student.class_level = Number(f.cls);
    const roll = digitsOf(f.roll, 9); if (!roll) errors.roll = 'রোল নম্বর দিন।'; else if (roll !== String(s0.roll ?? '')) student.roll = roll;
  }
  return { ok: !Object.keys(errors).length, errors, profile, student, changed: !!(Object.keys(profile).length || Object.keys(student).length) };
}
export const pinResetCall = (login, pin) => ({ action: 'reset_pin', login_id: loginOf(login), pin });
export const pinResetText = (p, pin) => ['ডিফ এডু', '', `${p.full_name}-এর নতুন পিন`, `লগইন আইডি: ${p.login_id}`, `পিন: ${pin}`, '', 'ঢুকে নিজের পছন্দের পিন বানিয়ে নিন।'].join('\n');

// ---- অনুরোধ ও নম্বর সংশোধন: a teacher says a guardian's number is wrong; the admin sets the right one or turns it down (rpc decide_phone_change) ----
export const PHONE_RULE = /^01[3-9]\d{8}$/;
export function phoneDecision(req, typed) {
  const phone = digitsOf(typed, 11);
  if (!PHONE_RULE.test(phone)) return { ok: false, error: 'সঠিক নম্বর দিন (০১ দিয়ে শুরু, ১১ সংখ্যা)।' };
  if (phone === digitsOf(req.old_phone, 11)) return { ok: false, error: 'এটা তো আগের নম্বরই, নতুন নম্বর দিন।' };
  return { ok: true, call: { name: 'decide_phone_change', args: { p_id: req.id, p_approve: true, p_phone: phone } } };
}
export const rejectCall = req => ({ name: 'decide_phone_change', args: { p_id: req.id, p_approve: false, p_phone: null } });
export const phoneReqError = res => /stale/.test(JSON.stringify(res?.data || '')) ? 'নম্বরটা এর মধ্যে বদলে গেছে, পাতা নতুন করে দেখুন।' : /already/.test(JSON.stringify(res?.data || '')) ? 'এটা আগেই ঠিক করা হয়েছে।' : res?.kind === 'offline' ? 'নেট নেই। নেট এলে আবার চেষ্টা করুন।' : 'হয়নি, আবার চেষ্টা করুন।';

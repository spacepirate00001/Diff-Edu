// Fake tables for step 6 (fake mode only): fees (+ record_payment, generate_monthly_fees), teachers' class logs, pay rates, honorarium payments,
// admission inquiries (with the 69 status columns) and notices (archive / delete). Shapes follow the live tables (see features/office/data.js).
// URL switches: &office=empty (nothing anywhere). State lives in mem (per page load).
import { dhakaDay } from '../bn.js';
import { ROSTER } from './teacher-data.js';

const ok = (data, status = 200) => ({ status, data });
const eqv = (q, k) => { const v = q.get(k); return v && v.startsWith('eq.') ? v.slice(3) : null; };
const bound = (q, k, op) => { const g = q.getAll(k).find(x => x.startsWith(op + '.')); return g ? g.slice(op.length + 1) : null; };
const monthOf = (iso, back) => { const [y, m] = iso.split('-').map(Number); const t = y * 12 + (m - 1) - back; return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}-01`; };
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const TEACHERS = [{ id: 'u-teacher', full_name: 'রহিম উদ্দিন' }, { id: 'u-t2', full_name: 'সালমা খাতুন' }, { id: 'u-t3', full_name: 'নাসির আহমেদ' }];

export function createOfficeData({ p, now, mem }) {
  const none = p('office') === 'empty';
  const today = () => dhakaDay(now());
  const stu = ROSTER.filter(s => s.class_level === 6 || s.class_level === 7);
  const mkFee = (s, back, i) => { const amount = s.class_level === 6 ? 800 : 1000, paid = back === 0 ? (i % 3 === 0 ? amount : i % 3 === 1 ? 0 : amount / 2) : (i % 4 === 0 ? 0 : amount); return { id: `f-${s.id}-${back}`, student_id: s.id, month: monthOf(today(), back), amount, paid_amount: paid, status: paid >= amount ? 'paid' : paid > 0 ? 'partial' : 'due' }; };
  const o = mem.of = {
    fees: none ? [] : stu.flatMap((s, i) => [0, 1, 2].map(b => mkFee(s, b, i))),
    ledger: new Set(),
    logs: none ? [] : [...Array(9).keys()].map(i => ({ id: 'cl-a' + i, teacher_id: 'u-teacher', day: addDays(today(), -i), label: i % 2 ? 'সকাল · ১ম ক্লাস · ক্লাস ৬' : 'বিকাল · ২য় ক্লাস · ক্লাস ৭' })).concat([...Array(12).keys()].map(i => ({ id: 'cl-b' + i, teacher_id: 'u-t2', day: addDays(today(), -i), label: 'সকাল · ১ম ক্লাস' }))),
    rates: none ? [] : [{ teacher_id: 'u-teacher', per_class: 150 }],
    paid: [],
    inquiries: none ? [] : [
      { id: 'ad1', child_name: 'সাদিয়া ইসলাম', class_level: 6, guardian_name: 'মোসা. রহিমা', phone: '01712345678', preferred_shift: 'morning', note: 'গণিতে দুর্বল, ভর্তি হতে চাই', status: 'new', staff_note: null, handled_at: null, created_at: new Date(now() - 3 * 3600e3).toISOString() },
      { id: 'ad2', child_name: 'আরিফ হোসেন', class_level: 8, guardian_name: null, phone: '01898765432', preferred_shift: 'afternoon', note: null, status: 'called', staff_note: 'রবিবার আসবে বলেছে', handled_at: new Date(now() - 86400e3).toISOString(), created_at: new Date(now() - 4 * 86400e3).toISOString() },
      { id: 'ad3', child_name: 'নূর জাহান', class_level: 5, guardian_name: 'আব্দুল করিম', phone: '017-12', preferred_shift: null, note: null, status: 'new', staff_note: null, handled_at: null, created_at: new Date(now() - 9 * 86400e3).toISOString() },
      { id: 'ad4', child_name: 'তামিম ইকবাল', class_level: 9, guardian_name: 'ইকবাল হোসেন', phone: '01611223344', preferred_shift: 'night', note: null, status: 'admitted', staff_note: null, handled_at: new Date(now() - 5 * 86400e3).toISOString(), created_at: new Date(now() - 12 * 86400e3).toISOString() }],
    notices: none ? [] : [
      { id: 'nt1', title: 'শুক্রবার মডেল টেস্ট', body: 'সকাল ৯টায় সবাই সময়মতো আসবে।\nকলম ও প্রবেশপত্র আনবে।', audience: 'all', class_level: null, created_at: new Date(now() - 2 * 3600e3).toISOString(), archived_at: null },
      { id: 'nt2', title: 'বার্ষিক ক্রীড়া', body: 'ক্লাস ৮-এর শিক্ষার্থীদের জন্য।', audience: 'students', class_level: 8, created_at: new Date(now() - 6 * 86400e3).toISOString(), archived_at: null },
      { id: 'nt3', title: 'পুরোনো বিজ্ঞপ্তি', body: 'এটা আর দরকার নেই।', audience: 'guardians', class_level: null, created_at: new Date(now() - 40 * 86400e3).toISOString(), archived_at: new Date(now() - 20 * 86400e3).toISOString() }],
  };
  const feeOut = f => { const s = ROSTER.find(x => x.id === f.student_id); return { ...f, student: { class_level: s.class_level, roll: s.roll, profile: { full_name: s.profile.full_name, login_id: s.profile.login_id || 'x' + s.roll, phone: null } } }; };
  const mine = (acc, rows) => (acc.role === 'admin' ? rows : rows.filter(r => r.teacher_id === acc.uid));
  return {
    table(t, q, method, body, acc) {
      switch (t) {
        case 'fees': {
          if (acc.role !== 'admin') return null;
          let l = o.fees; const m = eqv(q, 'month'), lt = bound(q, 'month', 'lt');
          if (m) l = l.filter(f => f.month === m);
          if (lt) l = l.filter(f => f.month < lt);
          if ((q.get('status') || '').startsWith('in.')) l = l.filter(f => f.status !== 'paid');
          return ok(m ? l.map(feeOut) : l);
        }
        case 'profiles': return acc.role === 'admin' && eqv(q, 'role') === 'teacher' ? ok(none ? [] : TEACHERS) : null;
        case 'class_logs': {
          if (method === 'POST') { const r = body; if (!o.logs.some(x => x.teacher_id === acc.uid && x.day === r.day && x.label === r.label)) o.logs.push({ id: 'cl-' + o.logs.length + '-' + r.day, teacher_id: acc.uid, day: r.day, label: r.label }); return ok(null, 201); }
          if (method === 'DELETE') { o.logs = o.logs.filter(x => x.id !== eqv(q, 'id')); return ok(null, 204); }
          const a = bound(q, 'day', 'gte'), b = bound(q, 'day', 'lt');
          return ok(mine(acc, o.logs).filter(x => (!a || x.day >= a) && (!b || x.day < b) && (!eqv(q, 'teacher_id') || x.teacher_id === eqv(q, 'teacher_id'))).sort((x, y) => y.day.localeCompare(x.day)));
        }
        case 'pay_rates':
          if (method === 'POST') { const i = o.rates.findIndex(r => r.teacher_id === body.teacher_id); if (i >= 0) o.rates[i] = { ...o.rates[i], per_class: body.per_class }; else o.rates.push({ teacher_id: body.teacher_id, per_class: body.per_class }); return ok(null, 201); }
          return ok(mine(acc, o.rates).filter(r => !eqv(q, 'teacher_id') || r.teacher_id === eqv(q, 'teacher_id')));
        case 'honorarium_payments':
          if (method === 'POST') { if (!o.paid.some(x => x.teacher_id === body.teacher_id && x.month === body.month)) o.paid.push({ ...body, paid_at: new Date(now()).toISOString() }); return ok(null, 201); }
          return ok(mine(acc, o.paid).filter(x => (!eqv(q, 'month') || x.month === eqv(q, 'month')) && (!eqv(q, 'teacher_id') || x.teacher_id === eqv(q, 'teacher_id'))));
        case 'admission_inquiries': {
          if (acc.role !== 'admin') return null;
          if (method === 'PATCH') { const x = o.inquiries.find(i => i.id === eqv(q, 'id')); if (x) Object.assign(x, body, { handled_at: new Date(now()).toISOString() }); return ok(null, 204); }
          return ok(o.inquiries.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)));
        }
        case 'notices': {
          if (acc.role !== 'admin') return null;
          if (method === 'POST') { o.notices.unshift({ id: body.id, title: body.title, body: body.body, audience: body.audience, class_level: body.class_level, created_at: new Date(now()).toISOString(), archived_at: null }); return ok(null, 201); }
          return ok(o.notices);
        }
        default: return null;
      }
    },
    rpc(name, body, acc) {
      if (acc.role !== 'admin') return null;
      if (name === 'record_payment') {
        const key = [body.p_method, body.p_trx_id, body.p_amount].join('|');
        if (o.ledger.has(key)) return ok('dup');
        for (const a of body.p_allocations) { const f = o.fees.find(x => x.id === a.fee_id); if (!f || f.paid_amount + a.amount > f.amount) return ok({ message: 'allocation is more than the fee due' }, 400); }
        for (const a of body.p_allocations) { const f = o.fees.find(x => x.id === a.fee_id); f.paid_amount += a.amount; f.status = f.paid_amount >= f.amount ? 'paid' : 'partial'; }
        o.ledger.add(key); mem.payments = (mem.payments || []).concat([body]);
        return ok('pay-1');
      }
      if (name === 'generate_monthly_fees') {
        let n = 0; mem.generated = (mem.generated || []).concat([body]);
        for (const s of ROSTER) { if (body.p_class_level && s.class_level !== body.p_class_level) continue; if (o.fees.some(f => f.student_id === s.id && f.month === body.p_month)) continue; o.fees.push({ id: `f-${s.id}-g`, student_id: s.id, month: body.p_month, amount: body.p_amount, paid_amount: 0, status: 'due' }); n++; }
        return ok(n);
      }
      if (name === 'set_notice_archived') { const n = o.notices.find(x => x.id === body.p_id); if (!n) return ok({ message: 'not found' }, 400); n.archived_at = body.p_archived ? new Date(now()).toISOString() : null; return ok(null, 204); }
      if (name === 'delete_archived_notice') { const n = o.notices.find(x => x.id === body.p_id); if (!n || !n.archived_at) return ok({ message: 'not in archive' }, 400); o.notices = o.notices.filter(x => x !== n); return ok(null, 204); }
      return null;
    },
  };
}

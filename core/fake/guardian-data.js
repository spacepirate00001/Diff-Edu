// Fake tables and calls for the guardian screens (fake mode only). Shapes follow the real tables read by pwa-dev/family.js, reports.js, comms.js.
// table() / rpc() / fn() return { status, data } or null when the route is not one of these.
import { dhakaDay } from '../bn.js';
import { STAFF } from './fixtures.js';

const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const monthStart = (iso, back) => { const [y, m] = iso.split('-').map(Number); const t = y * 12 + (m - 1) - back; return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}-01`; };
const ok = (data, status = 200) => ({ status, data });
const SUBJ = ['গণিত', 'ইংরেজি', 'বাংলা', 'বিজ্ঞান'];
const NAMES = { k1: 'তাসনিম আক্তার', k2: 'রাফি হাসান', k3: 'মীম খাতুন' };
const eqv = (q, k) => { const v = q.get(k); return v && v.startsWith('eq.') ? v.slice(3) : null; };
const PH = [['হ্যালো', 'phrase'], ['ধন্যবাদ', 'phrase'], ['দারুণ!', 'phrase'], ['একটু সাহায্য করবে?', 'phrase'], ['খুশি', 'sticker']];

export function createGuardianData({ p, now, mem }) {
  const today = () => dhakaDay(now());
  const cls = id => ({ k1: 6, k2: 5, k3: 8 })[id] || 6;
  mem.seen = new Set();
  // fees: this month and the two before. k1 owes this month, k2 owes two months, k3 owes nothing
  const fees = () => (mem.fees ||= Object.fromEntries(['k1', 'k2', 'k3'].map(id => [id, [0, 1, 2].map(back => {
    const month = monthStart(today(), back), owes = (id === 'k1' && back === 0) || (id === 'k2' && back <= 1), amount = id === 'k3' ? 1200 : 800;
    return { id: `f-${id}-${back}`, student_id: id, month, amount, paid_amount: owes ? 0 : amount, status: owes ? 'unpaid' : 'paid', method: owes ? null : back === 1 ? 'bkash' : 'cash', paid_at: owes ? null : `${addDays(month, 4)}T10:20:00+06:00`, trx_id: owes || back !== 1 ? null : '9K4X2LQ7' };
  })])));
  const idemSeen = {};
  // A payment made in the fake provider shows up in the fee rows after a couple of polls (?pay=slow: more polls, ?pay=never: it never does)
  const applyPending = () => {
    const pd = mem.pending; if (!pd) return;
    if (p('pay') === 'never' || ++pd.polls < (p('pay') === 'slow' ? 6 : 2)) return;
    for (const a of pd.allocations) for (const f of Object.values(fees()).flat()) if (f.id === a.fee_id) { f.paid_amount = Math.min(f.amount, f.paid_amount + a.amount); f.status = f.paid_amount >= f.amount ? 'paid' : 'partial'; f.method = pd.method; f.paid_at = new Date(now()).toISOString(); f.trx_id = pd.trx; }
    mem.pending = null;
  };
  const att = id => {
    const out = [], t = today();
    for (let i = 0; i < 60; i++) {
      const d = addDays(t, -i), wd = new Date(d + 'T00:00:00Z').getUTCDay();
      if (wd === 5 || i === 0) continue;
      const absent = id === 'k2' ? i % 4 === 1 : i % 9 === 4;
      out.push({ date: d, check_in: absent ? null : `${d}T0${i % 3 ? 8 : 9}:${String(10 + i % 40).padStart(2, '0')}:00+06:00`, check_out: null, source: i % 5 === 0 ? 'cctv' : 'manual' });
    }
    return out;
  };
  const ratings = id => Array.from({ length: 14 }, (_, i) => ({ day: addDays(today(), -i), behavior: 3, homework: i % 4 === 0 ? 0 : 3, performance: id === 'k2' ? 2 : 3 + (i % 2) })).filter((r, i) => i % 6 !== 5);
  const exams = id => SUBJ.concat('গণিত').map((s, i) => ({ id: `e-${id}-${i}`, title: `${i === 4 ? 'মডেল টেস্ট' : 'সাপ্তাহিক পরীক্ষা'}: ${s}`, exam_date: addDays(today(), -4 - i * 6), full_marks: i === 4 ? 100 : 20, subject: { name: s } }));
  const marks = id => exams(id).map((e, i) => ({ obtained: id === 'k2' ? [12, 9, 15, null, 55][i] : [18, 16, 17, 14, 82][i], exam: e }));
  const card = (id, i) => {
    const lines = SUBJ.map((s, j) => ({ s, d: addDays(today(), -i * 7 - j), f: 20, o: id === 'k2' && j === 2 && i === 0 ? null : [18, 15, 17, 14][j] - (i % 2), p: [16, 14, 15, 13][j] }));
    const got = lines.reduce((s, l) => s + (l.o || 0), 0), pct = 100 * got / 80, rating = 8.4 - i * 0.3;
    return { id: `rc-${id}-${i}`, student_id: id, kind: 'weekly', title: 'সাপ্তাহিক রিপোর্ট কার্ড', period_from: addDays(today(), -i * 7 - 7), period_to: addDays(today(), -i * 7 - 1), class_level: cls(id), rank: [2, 3, 5][i], class_size: 24, award: i === 0 && id === 'k1' ? 'improved' : null,
      data: { name: NAMES[id], roll: id === 'k1' ? 5 : 12, batch: id === 'k1' ? 'সকাল' : 'বিকেল', lines, b: 2.8, h: 2.5, pe: 3.2, rating, present: 5 - (id === 'k2' ? 2 : 0), days: 6, score: 0.6 * pct + 0.4 * rating * 10 },
      status: 'published', published_at: `${addDays(today(), -i * 7)}T08:00:00+06:00`, seen_at: i > 0 ? `${addDays(today(), -i * 7)}T20:00:00+06:00` : mem.seen.has(`rc-${id}-${i}`) ? new Date(now()).toISOString() : null };
  };
  const msgs = tid => PH.map(([label, kind], i) => ({ id: `cm${i}`, thread_id: tid, sender_id: i % 2 ? 'zz1' : tid.slice(2), created_at: new Date(now() - (PH.length - i) * 3600e3).toISOString(), phrase: { label, kind } }));

  return {
    fees, applyPending,
    table(t, q) {
      const sid = eqv(q, 'student_id'), c = +eqv(q, 'class_level') || 6;
      switch (t) {
        case 'fees': applyPending(); return ok((sid ? fees()[sid] || [] : Object.values(fees()).flat()).slice().sort((a, b) => b.month.localeCompare(a.month)));
        case 'attendance': return ok(sid ? att(sid) : []);
        case 'class_ratings': return ok(sid ? ratings(sid) : []);
        case 'period_attendance': return ok([]);
        case 'marks': return ok(sid ? marks(sid) : []);
        case 'exams': return ok(q.get('exam_date')?.startsWith('gte.') && c === 6 ? [{ id: 'ex1', title: 'মাসিক পরীক্ষা', exam_date: addDays(today(), 9), class_level: 6, chapter_ids: ['c1', 'c2', 'c3', 'c4'], subject: { name: 'গণিত' } }] : []);
        case 'chapters': return ok(['c1', 'c2', 'c3', 'c4'].map((id, i) => ({ id, class_level: 6, subject: 'গণিত', number: i + 1, title: ['ভগ্নাংশ', 'দশমিক', 'অনুপাত', 'জ্যামিতি'][i], pages: '', status: i < 2 ? 'done' : 'pending', done_on: null })));
        case 'report_cards': return ok(sid ? [0, 1, 2].map(i => card(sid, i)) : []);
        case 'homework': return ok([{ id: 'h1', title: 'অনুশীলনী ৫.২', due_date: addDays(today(), 1), subject: { name: 'গণিত' } }, { id: 'h2', title: 'রচনা: আমার গ্রাম', due_date: addDays(today(), 3), subject: { name: 'বাংলা' } }, { id: 'h3', title: 'Unit 4 words', due_date: addDays(today(), -2), subject: { name: 'ইংরেজি' } }]);
        case 'homework_done': return ok(sid === 'k1' ? [{ homework_id: 'h3' }] : []);
        case 'class_periods': return ok([1, 2, 3].flatMap(slot => ['morning', 'afternoon'].map(shift => ({ shift, slot, class_level: slot === 3 ? c : null, teacher: { full_name: STAFF[slot % 2].full_name } }))));
        case 'materials': return ok([
          { id: 'm1', chapter: 'ভগ্নাংশ', title: 'ভগ্নাংশের নোট', kind: 'pdf', url: null, storage_path: 'x/frac.pdf', subject: { name: 'গণিত' } },
          { id: 'm2', chapter: 'ভগ্নাংশ', title: 'ভগ্নাংশ বোঝার ভিডিও', kind: 'video', url: 'https://www.youtube.com/watch?v=abcdefghijk', subject: { name: 'গণিত' } },
          { id: 'm3', chapter: 'Tense', title: 'Tense চার্ট', kind: 'note', url: null, storage_path: 'x/tense.png', subject: { name: 'ইংরেজি' } },
          { id: 'm4', chapter: '', title: 'বাংলা ব্যাকরণ সারসংক্ষেপ', kind: 'link', url: 'https://example.com/grammar', subject: { name: 'বাংলা' } }]);
        case 'student_goals': return ok(sid === 'k1' ? [{ id: 'g1', subject: 'গণিত', target_percent: 90, achieved_at: null }, { id: 'g2', subject: 'ইংরেজি', target_percent: 80, achieved_at: '2026-10-30' }] : []);
        case 'praise_cards': return ok(sid === 'k1' ? [{ id: 'pc1', badge: 'helper', note: 'বন্ধুকে অঙ্ক বুঝিয়েছে।', created_at: new Date(now() - 5 * 864e5).toISOString(), giver: { full_name: 'রহিম উদ্দিন' } }] : []);
        case 'chat_threads': { const k = (q.get('or') || '').match(/student_a\.eq\.(\w+)/)?.[1]; return ok(k && k !== 'k3' ? [{ id: 't-' + k, student_a: k, student_b: 'zz1' }] : []); }
        case 'chat_messages': { const tid = (q.get('thread_id') || '').match(/t-\w+/)?.[0] || 't-k1'; return ok(msgs(tid)); }
        default: return null;
      }
    },
    rpc(name, body) {
      if (name === 'mark_report_seen') { mem.seen.add(body.p_id); return ok(null); }
      if (name === 'report_message') return ['rude', 'unsafe', 'personal_info', 'other'].includes(body.p_reason) ? ok('rep-1') : ok({ message: 'bad reason' }, 400);
      return null;
    },
    // The payment start call. NOTE: no such edge function exists in the repo yet (payment_intents is written by the service role only).
    fn(name, body) {
      if (name !== 'payment-start') return null;
      if (p('pay') === 'fail') return ok({ error: 'provider down' }, 502);
      const seen = idemSeen[body.key];
      if (seen) return ok({ ...seen, reused: true });
      const trx = 'FK' + Math.random().toString(36).slice(2, 9).toUpperCase();
      const brand = body.method === 'bkash' ? 'bKash' : 'Nagad';
      const out = { intent_id: 'pi-' + Object.keys(idemSeen).length, method: body.method, amount: body.amount, trx_id: trx, steps: [`${brand} অ্যাপ খুলুন`, '"পেমেন্ট" চাপুন, ডিফ এডুর মার্চেন্ট নম্বর দিন', `${brand} থেকে টাকা পাঠান, রেফারেন্সে ${trx} লিখুন`] };
      idemSeen[body.key] = out; mem.pending = { allocations: body.allocations, method: body.method, trx, polls: 0 };
      return ok(out);
    },
  };
}

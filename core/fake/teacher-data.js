// Fake tables and calls for the teacher's screens (fake mode only, ?fake=teacher). Shapes follow the real contracts:
// class_periods, batches, students, student_batches, period_attendance, class_ratings (periods.sql, classroom.sql), attendance (needs_review rows),
// rpc resolve_gate_review / change_attendance / change_rating / automation_status (66), doubts, homework, teacher_notes, guardian_students, push_subscriptions (67).
// table(t, q, method, body) / rpc(name, body) return { status, data } or null when the route is not one of these. State lives in mem (per page load).
// URL switches: &silent=off|unknown (what automation_status says; default on), &state=empty (no routine, nothing waiting), &review=0 (no camera items).
import { dhakaDay } from '../bn.js';
import { STUDENTS } from './fixtures.js';

const ok = (data, status = 200) => ({ status, data });
const bad = (message, status = 400) => ({ status, data: { message } });
const eqv = (q, k) => { const v = q.get(k); return v && v.startsWith('eq.') ? v.slice(3) : null; };
const inv = (q, k) => { const v = q.get(k); return v && v.startsWith('in.(') ? v.slice(4, -1).split(',') : null; };
const SHIFT_OF = { 'b-m': 'morning', 'b-a': 'afternoon', 'b-n': 'night' };
const BATCH_OF = { s1: 'b-a', s2: 'b-a', s3: 'b-m', s4: 'b-a', s5: 'b-a', s6: 'b-m', s7: 'b-n', s8: 'b-n' };
// [id, class, roll, name, batch]
const EXTRA = [['t1', 6, 1, 'সুমি আক্তার', 'b-a'], ['t2', 6, 2, 'ফারহান ইসলাম', 'b-a'], ['t3', 6, 3, 'নাঈম হাসান', 'b-a'], ['t4', 6, 4, 'জান্নাতুল ফেরদৌস', 'b-a'], ['t5', 6, 6, 'রিয়াদ হোসেন', 'b-a'], ['t6', 6, 8, 'মিথিলা রায়', 'b-a'],
  ['t7', 7, 2, 'আবির আহমেদ', 'b-a'], ['t8', 7, 3, 'তাহমিনা খাতুন', 'b-a'], ['t9', 7, 4, 'সাকিব আল হাসান', 'b-a'], ['t10', 7, 5, 'নুসাইবা আক্তার', 'b-a'], ['t11', 8, 1, 'ইমন হোসেন', 'b-m'], ['t12', 8, 2, 'প্রিয়া দাস', 'b-m'], ['t13', 8, 4, 'শাহরিয়ার কবির', 'b-m']];
const ROSTER = [...STUDENTS.map(s => ({ ...s, batch_id: BATCH_OF[s.id] || 'b-a' })),
  ...EXTRA.map(([id, class_level, roll, full_name, batch_id], i) => ({ id, class_level, roll, active: true, batch_id, profile: { full_name, login_id: 'x' + id, phone: '0181100' + String(200 + i) } }))]
  .map(s => ({ ...s, batch: { shift: SHIFT_OF[s.batch_id] } }));
const NO_PHONE = new Set(['t3']), MOTHER_ONLY = new Set(['s4']);
const guardiansOf = (id, i) => NO_PHONE.has(id) ? [] : [...(MOTHER_ONLY.has(id) ? [] : [{ relation: 'বাবা', name: 'আব্দুল ' + id, phone: '0171100' + String(300 + i) }]), { relation: 'মা', name: 'রহিমা ' + id, phone: '0171100' + String(400 + i) }];

export function createTeacherData({ p, now, mem }) {
  const today = () => dhakaDay(now());
  const empty = () => p('state') === 'empty';
  const th = mem.th = {
    att: [], rat: [], notes: [], subs: [], sent: [], changes: [],
    periods: [['afternoon', 1, 6, 'u-teacher'], ['afternoon', 3, 7, 'u-teacher'], ['morning', 2, 8, 'u-teacher'], ['afternoon', 2, 6, 'u-teacher2'], ['morning', 1, 8, 'u-teacher2'], ['night', 1, 10, 'u-teacher2']]
      .map(([shift, slot, class_level, teacher_id]) => ({ shift, slot, class_level, teacher_id })),
    review: p('review') === '0' ? [] : [['a-r1', 's1', 0.71, 40], ['a-r2', 't2', 0.64, 25], ['a-r3', 't9', 0.58, 12]].map(([id, student_id, confidence, min]) => ({ id, student_id, date: today(), check_in: new Date(now() - min * 60e3).toISOString(), confidence, needs_review: true, source: 'cctv' })),
    doubts: [
      ['d1', 6, 'গণিত', 'ভগ্নাংশ যোগ করার সময় হর কেন এক করতে হয়?', null, 50], ['d2', 7, 'ইংরেজি', 'Present perfect tense কখন ব্যবহার করব?', null, 30], ['d3', 6, 'বিজ্ঞান', 'গাছ রাতে কেন অক্সিজেন নেয়?', 'দিনে গাছ আলো পেয়ে খাবার বানায়। রাতে আলো নেই, তাই শ্বাস নেয়। কাল ক্লাসে দেখিয়ে দেব।', 28],
      ['d4', 8, 'বাংলা', 'সমাস কীভাবে চিনব?', null, 20], ['d5', 6, 'গণিত', 'দশমিককে ভগ্নাংশ করার সহজ নিয়ম কী?', null, 6]]
      .map(([id, class_level, subject, body, answer, h]) => ({ id, class_level, subject, body, answer, answered_at: answer ? new Date(now() - 20 * 3600e3).toISOString() : null, hidden: false, created_at: new Date(now() - h * 3600e3).toISOString() })),
    homework: [['hw1', 6, 'অনুশীলনী ৫.২, ১ থেকে ৮ নম্বর', 'খাতায় করে আনবে।', 1, 20], ['hw2', 6, 'বাংলা রচনা: আমার প্রিয় ঋতু', null, 3, 50], ['hw3', 7, 'বিজ্ঞান: ৩য় অধ্যায় পড়ে আসবে', null, 2, 30]]
      .map(([id, class_level, title, details, due, h]) => ({ id, class_level, title, details, due_date: dhakaDay(now() + due * 86400e3), created_at: new Date(now() - h * 3600e3).toISOString(), created_by: 'u-teacher', coaching_id: 'c1' })),
  };
  // Morning period 2 (class 8) was done earlier today: everyone present but ইমন... one absent; ratings for all present but one, so "ratings left" shows.
  const d0 = today();
  for (const id of ['s3', 't11', 't12', 't13']) th.att.push({ student_id: id, day: d0, shift: 'morning', slot: 2, present: id !== 't12', session: 'class', exam_title: null });
  for (const id of ['s3', 't11']) th.rat.push({ student_id: id, day: d0, shift: 'morning', slot: 2, behavior: 3, homework: 3, performance: 2 });
  if (empty()) { th.periods = []; th.review = []; th.doubts = []; th.homework = []; th.att = []; th.rat = []; }

  const upsert = (list, rows, keyOf) => { for (const r of [].concat(rows)) { const i = list.findIndex(x => keyOf(x) === keyOf(r)); if (i >= 0) list[i] = { ...list[i], ...r }; else list.push({ ...r }); } };
  const k = r => `${r.student_id}|${r.day}|${r.shift}|${r.slot}`;
  const pick = (list, q) => {
    const ids = inv(q, 'student_id');
    return list.filter(r => (!eqv(q, 'day') || r.day === eqv(q, 'day')) && (!eqv(q, 'shift') || r.shift === eqv(q, 'shift')) && (!eqv(q, 'slot') || String(r.slot) === eqv(q, 'slot')) && (!ids || ids.includes(r.student_id)) && (!eqv(q, 'student_id') || r.student_id === eqv(q, 'student_id')));
  };
  const studentView = s => ({ id: s.id, class_level: s.class_level, roll: s.roll, active: true, batch_id: s.batch_id, batch: s.batch, profile: s.profile });
  const reviewRow = r => { const s = ROSTER.find(x => x.id === r.student_id); return { ...r, student: { roll: s.roll, class_level: s.class_level, profile: { full_name: s.profile.full_name } } }; };

  return {
    table(t, q, method, body) {
      switch (t) {
        case 'class_periods': return ok(th.periods.filter(r => !eqv(q, 'teacher_id') || r.teacher_id === eqv(q, 'teacher_id')));
        case 'batches': return ok(Object.entries(SHIFT_OF).filter(([, sh]) => !eqv(q, 'shift') || sh === eqv(q, 'shift')).map(([id, shift]) => ({ id, shift, name: { morning: 'সকাল ব্যাচ', afternoon: 'বিকেল ব্যাচ', night: 'রাত ব্যাচ' }[shift], start_time: { morning: '07:00:00', afternoon: '15:00:00', night: '19:00:00' }[shift], end_time: { morning: '10:00:00', afternoon: '18:00:00', night: '22:00:00' }[shift] })));
        case 'student_batches': return ok([]);
        case 'students': {
          if (empty()) return ok([]);
          const bs = inv(q, 'batch_id'), ids = inv(q, 'id');
          return ok(ROSTER.filter(s => (!bs || bs.includes(s.batch_id)) && (!ids || ids.includes(s.id)) && (!eqv(q, 'id') || s.id === eqv(q, 'id'))).map(studentView)
            .sort((a, b) => (/order=class_level/.test(String(q)) ? a.class_level - b.class_level : 0) || a.roll - b.roll));
        }
        case 'period_attendance':
          if (method === 'POST') { upsert(th.att, body, k); return ok(null, 201); }
          return ok(pick(th.att, q));
        case 'class_ratings':
          if (method === 'POST') { upsert(th.rat, body, k); return ok(null, 201); }
          return ok(pick(th.rat, q));
        case 'attendance': return ok(q.get('needs_review') ? th.review.map(reviewRow) : []);
        case 'guardian_students': {
          const ids = inv(q, 'student_id') || ROSTER.map(s => s.id);
          return ok(ids.flatMap(id => guardiansOf(id, ROSTER.findIndex(s => s.id === id)).map((g, j) => ({ student_id: id, guardian_id: `g-${id}-${j}`, relation: g.relation, guardian: { full_name: g.name, phone: g.phone } }))));
        }
        case 'doubts': {
          if (method === 'PATCH') { const d = th.doubts.find(x => x.id === eqv(q, 'id')); if (!d) return ok([]); Object.assign(d, body); return ok([{ id: d.id }]); }
          return ok(th.doubts.filter(d => !(q.get('hidden') === 'is.false' && d.hidden) && (!eqv(q, 'class_level') || String(d.class_level) === eqv(q, 'class_level'))));
        }
        case 'homework': {
          if (method === 'POST') { if (th.homework.some(h => h.id === body.id)) return bad('duplicate key', 409); th.homework.unshift({ ...body, created_at: new Date(now()).toISOString() }); return ok(null, 201); }
          return ok(th.homework.filter(h => !eqv(q, 'class_level') || String(h.class_level) === eqv(q, 'class_level')));
        }
        case 'homework_done': return ok(th.homework.slice(0, 2).flatMap((h, i) => Array.from({ length: 4 - i }, (_, j) => ({ homework_id: h.id, student_id: 's' + (j + 1) }))));
        case 'teacher_notes':
          if (method === 'POST') { th.notes.unshift({ ...body, created_at: new Date(now()).toISOString() }); return ok(null, 201); }
          return ok(th.notes.filter(n => !eqv(q, 'student_id') || n.student_id === eqv(q, 'student_id')));
        case 'messages': {
          if (method === 'POST') { mem.chat.push({ ...body, created_at: new Date(now()).toISOString() }); return ok(null, 201); }
          const sid = eqv(q, 'thread_student_id'), H = 3600e3;
          const seed = [{ id: 'tm1', body: 'স্যার, আজ একটু দেরিতে আসবে। বাসে সমস্যা হয়েছে।', sender_id: 'u-guardian', thread_student_id: 's1', created_at: new Date(now() - 5 * H).toISOString() },
            { id: 'tm2', body: 'ঠিক আছে, আসতে বলুন।', sender_id: 'u-teacher', thread_student_id: 's1', created_at: new Date(now() - 4.5 * H).toISOString() },
            { id: 'tm3', body: 'স্যার, রাফির গণিতটা একটু বুঝিয়ে দেবেন?', sender_id: 'u-guardian2', thread_student_id: 's2', created_at: new Date(now() - 2 * H).toISOString() }];
          return ok(empty() ? [] : [...seed, ...mem.chat].filter(m => !sid || m.thread_student_id === sid).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))));
        }
        case 'notices': if (method === 'POST') { th.sent.push(body); return ok(null, 201); } return null;
        case 'sender_settings': return ok([]);                       // admin-only table: a teacher's read returns nothing (RLS)
        case 'push_subscriptions':
          if (method === 'POST') { upsert(th.subs, body, r => r.device_id); return ok(null, 201); }
          if (method === 'DELETE') { th.subs = th.subs.filter(s => s.device_id !== eqv(q, 'device_id')); return ok(null, 204); }
          return ok(th.subs);
        default: return null;
      }
    },
    rpc(name, body) {
      switch (name) {
        case 'attendance_today': return ok(ROSTER.filter(s => SHIFT_OF[s.batch_id] === body.p_shift).slice(0, 5).map((s, i) => ({ student_id: s.id, state: i === 1 || i === 3 ? 'absent' : 'present' })));
        case 'students_presence': return ok(ROSTER.map((s, i) => ({ student_id: s.id, last_seen: i % 3 === 0 ? new Date(Date.now() - 60000).toISOString() : i % 3 === 1 ? new Date(Date.now() - 3 * 3600000).toISOString() : null, opened_today: i % 3 !== 2 })));
        case 'ping_presence': return ok(null);
        case 'resolve_gate_review': th.review = th.review.filter(r => r.id !== body.p_attendance_id); return ok(null);
        case 'change_attendance': {
          if (String(body.p_reason || '').trim().length < 3) return bad('reason_required');
          const r = th.att.find(x => x.student_id === body.p_student && x.day === body.p_day && x.shift === body.p_shift && x.slot === body.p_slot); if (!r) return bad('student_not_found');
          r.present = body.p_present; if (!r.present) th.rat = th.rat.filter(x => k(x) !== k(r)); th.changes.push(body); return ok(null);
        }
        case 'change_rating': {
          const r = th.rat.find(x => k(x) === `${body.p_student}|${body.p_day}|${body.p_shift}|${body.p_slot}`);
          if (r && String(body.p_reason || '').trim().length < 3) return bad('reason_required');
          upsert(th.rat, { student_id: body.p_student, day: body.p_day, shift: body.p_shift, slot: body.p_slot, behavior: body.p_behavior, homework: body.p_homework, performance: body.p_performance }, k); th.changes.push(body); return ok(null);
        }
        case 'automation_status': {
          const m = p('silent');
          if (m === 'unknown') return bad('function not found', 404);
          return ok({ silent_mode: m !== 'off', paused: false, attendance_paused: false, sms_on: false, quiet_from: m === 'off' ? '22:00:00' : null, quiet_to: m === 'off' ? '07:00:00' : null, has_settings: true });
        }
        default: return null;
      }
    },
  };
}
export { ROSTER };

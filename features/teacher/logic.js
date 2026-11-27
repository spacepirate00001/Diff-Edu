// The teacher's rules, pure (no DOM, no network), so node --test can check them. Contracts are the live ones (pwa-dev/teacher.js):
//   period_attendance  one row per (student_id, day, shift, slot): present boolean, session 'class', teacher_id, marked_at
//   class_ratings      one row per (student_id, day, shift, slot): behavior 0-3, homework 0/1.5/3, performance 0-4 (total is generated)
// Saved rows are LOCKED: a changed value needs a reason and goes through rpc change_attendance / change_rating (attendance2.sql).
// New rows are a direct upsert, kept in the outbox when the net is down.
import { bn } from '../../core/bn.js';

// ---- shifts and periods ----
export const SHIFTS = [{ id: 'morning', name: 'সকাল', startH: 7 }, { id: 'afternoon', name: 'বিকাল', startH: 15 }, { id: 'night', name: 'রাত', startH: 19 }];
export const SLOTS = [1, 2, 3];
export const SLOT_MIN = 40;                       // three 40-minute periods from the shift's start (same assumption as the old app; the server stores no times)
export const shiftName = id => SHIFTS.find(s => s.id === id)?.name || '';
export const slotName = n => ({ 1: '১ম', 2: '২য়', 3: '৩য়' })[n] || bn(n);
export const periodOrder = (shift, slot) => Math.max(0, SHIFTS.findIndex(s => s.id === shift)) * 10 + Number(slot);
export const periodKey = (shift, slot) => `${shift}-${slot}`;
// The real start of each shift comes from table batches (start_time); until it is loaded the defaults above are used.
const STARTS = {};
export function setBatchStarts(batches) { for (const b of batches || []) { const m = /^(\d{1,2}):(\d{2})/.exec(b.start_time || ''); if (m && SHIFTS.some(s => s.id === b.shift)) STARTS[b.shift] = Number(m[1]) * 60 + Number(m[2]); } }
export function periodSpan(shift, slot) {
  const s = SHIFTS.find(x => x.id === shift); if (!s) return null;
  const from = (STARTS[shift] ?? s.startH * 60) + (slot - 1) * SLOT_MIN;
  return { from, to: from + SLOT_MIN };
}
// The shift a teacher most likely means at `minutes`: the running one, else the next to start, else the last of the day.
export function guessShift(minutes) {
  const spans = SHIFTS.map(s => ({ id: s.id, from: periodSpan(s.id, 1).from, to: periodSpan(s.id, 3).to }));
  return (spans.find(x => minutes >= x.from && minutes < x.to) || spans.find(x => x.from > minutes) || spans.at(-1)).id;
}
export const clock12 = m => bn(`${Math.floor(m / 60) % 12 || 12}:${String(m % 60).padStart(2, '0')}`);
export const spanText = (shift, slot) => { const p = periodSpan(shift, slot); return p ? `${clock12(p.from)} – ${clock12(p.to)}` : ''; };
// 'now' | 'next' | 'done' | 'later' for a period at `minutes` since midnight (Dhaka)
export function periodPhase(shift, slot, minutes, list = []) {
  const p = periodSpan(shift, slot); if (!p) return 'later';
  if (minutes >= p.from && minutes < p.to) return 'now';
  if (minutes >= p.to) return 'done';
  const upcoming = list.map(x => periodSpan(x.shift, x.slot)).filter(x => x && x.from > minutes).sort((a, b) => a.from - b.from)[0];
  return upcoming && upcoming.from === p.from ? 'next' : 'later';
}
// class_periods rows of one teacher -> [{ shift, slot, levels: [class_level] | null (everyone), key }] in the day's order
export function myPeriods(rows, uid) {
  const by = new Map();
  for (const r of rows || []) {
    if (uid && r.teacher_id && r.teacher_id !== uid) continue;
    const slot = Number(r.slot); if (!SLOTS.includes(slot) || !SHIFTS.some(s => s.id === r.shift)) continue;
    const k = periodKey(r.shift, slot);
    const e = by.get(k) || { shift: r.shift, slot, levels: [], all: false, key: k };
    if (r.class_level == null) e.all = true; else if (!e.levels.includes(Number(r.class_level))) e.levels.push(Number(r.class_level));
    by.set(k, e);
  }
  return [...by.values()].map(e => ({ shift: e.shift, slot: e.slot, key: e.key, levels: e.all || !e.levels.length ? null : e.levels.sort((a, b) => a - b) })).sort((a, b) => periodOrder(a.shift, a.slot) - periodOrder(b.shift, b.slot));
}
export const levelsText = levels => (levels ? 'ক্লাস ' + levels.map(bn).join(', ') : 'সব ক্লাস');
// The period to open first: the one running now, else the next one, else the last of the day.
export function currentPeriod(periods, minutes) {
  if (!periods.length) return null;
  return periods.find(p => periodPhase(p.shift, p.slot, minutes, periods) === 'now') || periods.find(p => (periodSpan(p.shift, p.slot)?.from ?? 0) > minutes) || periods.at(-1);
}

// ---- attendance: statuses, default all present, late / leave rules ----
// Four words the teacher uses; the server only knows present true/false.
//   late  = came late: still PRESENT (the server has no "late" column; the word only helps the teacher and the summary)
//   leave = went early / on leave for this period: ABSENT for this period. If the child was present in an earlier period today,
//           the server's early-leave rule (35) raises a staff signal first; the guardian is told only after staff confirm.
export const STATUS_NAME = { present: 'উপস্থিত', late: 'দেরিতে এসেছে', absent: 'অনুপস্থিত', leave: 'আগে চলে গেছে' };
export const STATUSES = Object.keys(STATUS_NAME);
export const isPresent = st => st === 'present' || st === 'late';
export const toggleAbsent = st => (isPresent(st) ? 'absent' : 'present');
// Nobody is marked yet: everyone is present (the teacher taps only the absentees). A saved row wins over the default.
export function initialStatuses(roster, saved = {}) {
  const out = {};
  for (const s of roster) out[s.id] = s.id in saved ? (saved[s.id].present ? 'present' : 'absent') : 'present';
  return out;
}
// What the teacher is told before saving, per status (one short line).
export function consequence(status, { earlierPresent = null, silent = null } = {}) {
  if (status === 'late') return 'উপস্থিত ধরা হবে। দেরির কথাটা শুধু আপনার জন্য, সার্ভারে আলাদা করে রাখা হয় না।';
  if (status === 'leave' && earlierPresent === null) return 'এই ক্লাসে অনুপস্থিত ধরা হবে। আজ আগের ক্লাসে উপস্থিত থাকলে শিক্ষক-অ্যাডমিনের কাছে "আগে বের হয়েছে" সংকেত যাবে, অভিভাবক জানবেন আপনারা নিশ্চিত করলে।';
  if (status === 'leave') return earlierPresent ? 'আগের ক্লাসে উপস্থিত ছিল, তাই শিক্ষক-অ্যাডমিনের কাছে "আগে বের হয়েছে" সংকেত যাবে। অভিভাবক জানবেন আপনারা নিশ্চিত করলে।' : 'এই ক্লাসে অনুপস্থিত ধরা হবে।';
  if (status === 'absent') return silent === true ? 'অনুপস্থিত। এখন অভিভাবকের কাছে খবর যাচ্ছে না।' : silent === false ? 'অনুপস্থিত। দিনে কোথাও উপস্থিত না থাকলে অভিভাবকের কাছে "আসেনি" খবর যেতে পারে।' : 'অনুপস্থিত। চুপ মোড জানা নেই: দিনে কোথাও উপস্থিত না থাকলে অভিভাবকের কাছে "আসেনি" খবর যেতে পারে।';
  return 'উপস্থিত।';
}
export function summarize(statuses, ids) {
  const c = { present: 0, late: 0, absent: 0, leave: 0 };
  for (const id of ids) c[statuses[id] || 'present']++;
  return { ...c, here: c.present + c.late, away: c.absent + c.leave, total: ids.length };
}
// Rows to write. fresh = students with no saved row (direct upsert); changes = saved rows whose present value differs (need a reason, rpc).
// Students whose value did not change are NOT in either list (changed-rows-only).
export function attendanceDiff({ statuses, saved = {}, ids }) {
  const fresh = [], changes = [];
  for (const id of ids) {
    const present = isPresent(statuses[id] || 'present');
    if (!(id in saved)) fresh.push({ id, present });
    else if (!!saved[id].present !== present) changes.push({ id, present, was: !!saved[id].present });
  }
  return { fresh, changes };
}
export const attendanceRow = ({ coaching_id, uid, day, shift, slot, id, present, now = Date.now() }) =>
  ({ coaching_id, student_id: id, day, shift, slot: Math.min(3, Math.max(0, slot)), present, session: 'class', exam_title: null, teacher_id: uid, marked_at: new Date(now).toISOString() });

// ---- ratings: steppers ----
export const RATING = { behavior: { name: 'আচরণ', min: 0, max: 3, step: 1 }, homework: { name: 'হোমওয়ার্ক', min: 0, max: 3, step: 1.5 }, performance: { name: 'পারফরম্যান্স', min: 0, max: 4, step: 1 } };
export const RATING_KEYS = Object.keys(RATING);
export const RATING_DEFAULT = Object.freeze({ behavior: 3, homework: 3, performance: 2 });   // 8/10, the old app's default
export const ratingTotal = r => RATING_KEYS.reduce((s, k) => s + Number(r[k]), 0);
export const num = v => bn(Number.isInteger(+v) ? String(+v) : String(+v));
export const hwWord = v => (+v === 0 ? 'করেনি' : +v === 3 ? 'করেছে' : 'আধা');
export function stepRating(r, key, dir) {
  const d = RATING[key]; if (!d) return r;
  const v = Math.min(d.max, Math.max(d.min, Math.round((Number(r[key]) + dir * d.step) * 10) / 10));
  return { ...r, [key]: v };
}
export const sameRating = (a, b) => !!a && !!b && RATING_KEYS.every(k => Math.round(Number(a[k]) * 10) === Math.round(Number(b[k]) * 10));
// Only students who are present are rated. Fresh = no saved rating (new row, default 8/10 unless edited); changes = saved rating that differs.
export function ratingDiff({ ratings = {}, saved = {}, presentIds }) {
  const fresh = [], changes = [];
  for (const id of presentIds) {
    const r = ratings[id] || (id in saved ? saved[id] : RATING_DEFAULT);
    if (!(id in saved)) fresh.push({ id, ...pickRating(r) });
    else if (!sameRating(r, saved[id])) changes.push({ id, ...pickRating(r), was: saved[id] });
  }
  return { fresh, changes };
}
const pickRating = r => ({ behavior: Number(r.behavior), homework: Number(r.homework), performance: Number(r.performance) });
export const ratingRow = ({ coaching_id, uid, day, shift, slot, id, behavior, homework, performance }) =>
  ({ coaching_id, student_id: id, day, shift, slot: Math.min(3, Math.max(1, slot)), behavior, homework, performance, comment: null, rated_by: uid });

// ---- the write plan: attendance FIRST, then ratings (a rating needs an attendance row that is present) ----
export const ATT_PATH = '/rest/v1/period_attendance?on_conflict=student_id,day,shift,slot';
export const RATE_PATH = '/rest/v1/class_ratings?on_conflict=student_id,day,shift,slot';
const MERGE = 'return=minimal,resolution=merge-duplicates';
export function writePlan({ attFresh = [], rateFresh = [] }) {
  const ops = [];
  if (attFresh.length) ops.push({ kind: 'attendance', method: 'POST', path: ATT_PATH, body: attFresh, prefer: MERGE, label: 'হাজিরা' });
  if (rateFresh.length) ops.push({ kind: 'rating', method: 'POST', path: RATE_PATH, body: rateFresh, prefer: MERGE, label: 'রেটিং' });
  return ops;
}
// Sends the plan through the outbox in order. A rating is never written when its attendance was refused or not kept.
// -> { states: { attendance?: 'saved'|'queued'|'failed'|'rejected', rating?: ... }, state: worst-of }
export async function submitPlan(outbox, uid, ops) {
  const states = {};
  for (const op of ops) {
    if (op.kind === 'rating' && states.attendance && !['saved', 'queued'].includes(states.attendance)) { states.rating = 'skipped'; continue; }
    const r = await outbox.submit({ uid, method: op.method, path: op.path, body: op.body, prefer: op.prefer, label: op.label });
    states[op.kind] = r.state;
  }
  const order = ['rejected', 'failed', 'skipped', 'queued', 'saved'];
  const state = order.find(s => Object.values(states).includes(s)) || 'saved';
  return { states, state };
}
// Reasons the teacher can tap when a saved value is changed (min 3, max 200 characters on the server).
export const WHY = ['ভুল চাপ পড়েছিল', 'দেরিতে এসেছে', 'আগে ভুল শুনেছিলাম', 'অন্য কারণ'];
export const validReason = t => { const s = String(t ?? '').trim(); return s.length >= 3 && s.length <= 200 ? s : null; };
export const changeAttendanceCall = ({ id, day, shift, slot, present, reason }) => ({ name: 'change_attendance', args: { p_student: id, p_day: day, p_shift: shift, p_slot: Math.min(3, Math.max(0, slot)), p_present: present, p_session: 'class', p_exam_title: null, p_reason: reason } });
export const changeRatingCall = ({ id, day, shift, slot, behavior, homework, performance, reason = null }) => ({ name: 'change_rating', args: { p_student: id, p_day: day, p_shift: shift, p_slot: slot, p_behavior: behavior, p_homework: homework, p_performance: performance, p_reason: reason } });

// ---- needs-review sightings (gate / office camera) ----
// A match that is not sure enough waits for a teacher. Accept = it counts as an arrival (and the guardian arrival notice may follow, silent mode permitting);
// reject = the row is removed. Both are rpc resolve_gate_review (all.sql) on the daily attendance row.
export const reviewCall = (id, accept) => ({ name: 'resolve_gate_review', args: { p_attendance_id: id, p_accept: !!accept } });
export const matchPct = c => Math.round(Math.min(1, Math.max(0, Number(c) || 0)) * 100);
export function reviewItems(rows) {
  return (rows || []).map(r => ({ id: r.id, studentId: r.student_id, name: r.student?.profile?.full_name || r.student?.roll || 'শিক্ষার্থী', roll: r.student?.roll ?? null, level: r.student?.class_level ?? null,
    day: r.date, at: r.check_in, pct: matchPct(r.confidence) })).sort((a, b) => String(b.at || b.day).localeCompare(String(a.at || a.day)));
}

// ---- homework ----
export const TITLE_MAX = 120, DETAIL_MAX = 1000;
export function validateHomework({ class_level, title, details, due_date }, today) {
  const errors = {};
  const lv = Number(class_level);
  if (!(lv >= 1 && lv <= 10)) errors.class_level = 'ক্লাস বেছে নিন।';
  const t = String(title ?? '').replace(/\s+/g, ' ').trim();
  if (!t) errors.title = 'কী করতে হবে, ছোট করে লিখুন।'; else if (t.length > TITLE_MAX) errors.title = 'লেখাটা একটু ছোট করুন।';
  const d = String(details ?? '').trim();
  if (d.length > DETAIL_MAX) errors.details = 'বিস্তারিত একটু ছোট করুন।';
  if (due_date && !/^\d{4}-\d{2}-\d{2}$/.test(due_date)) errors.due_date = 'তারিখ ঠিক নেই।';
  else if (due_date && today && due_date < today) errors.due_date = 'জমার তারিখ আজকের আগে হতে পারে না।';
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, errors, value: { class_level: lv, title: t, details: d || null, due_date: due_date || null } };
}
export const homeworkRow = ({ id, coaching_id, uid, value }) => ({ id, coaching_id, class_level: value.class_level, title: value.title, details: value.details, due_date: value.due_date, created_by: uid });

// ---- doubts (the students' "send to teacher" box; the table has no student id for teachers: anonymous) ----
export const doubtStatus = d => (d.hidden ? 'hidden' : d.answer ? 'done' : 'open');
export function filterDoubts(list, { cls = null, status = 'open' } = {}) {
  return (list || []).filter(d => !d.hidden && (cls == null || d.class_level === cls) && (status === 'all' || doubtStatus(d) === status))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}
export const openDoubts = list => (list || []).filter(d => doubtStatus(d) === 'open').length;
export function validateAnswer(text) { const t = String(text ?? '').trim(); return !t ? { ok: false, why: 'empty' } : t.length > 1000 ? { ok: false, why: 'long' } : { ok: true, text: t }; }
export const answerPatch = (text, now = Date.now()) => ({ answer: text, answered_at: new Date(now).toISOString() });

// ---- guardian call sheet: always three slots, in this order (same as the old app's callsheet.js) ----
export const CALL_SLOTS = ['বাবা', 'মা', 'অন্য কেউ'];
export const slotOfRelation = rel => { const r = String(rel || '').trim(); return r === 'বাবা' || /^father$/i.test(r) ? 'বাবা' : r === 'মা' || /^mother$/i.test(r) ? 'মা' : 'অন্য কেউ'; };
export const telHref = p => 'tel:' + String(p || '').replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d)).replace(/[^\d+]/g, '');
export function callSlots(guardians) {
  const gs = (guardians || []).filter(g => g && g.phone);
  return CALL_SLOTS.map(slot => ({ slot, people: gs.filter(g => slotOfRelation(g.relation) === slot) }));
}

// ---- what is left to do today ----
// period: { key, shift, slot }; state per period: { total, marked, rated, present }
export function leftToDo({ periods = [], state = {}, review = 0, homeworkToday = null }) {
  const out = [];
  for (const p of periods) {
    const s = state[p.key]; if (!s) continue;
    const name = `${shiftName(p.shift)} · ${slotName(p.slot)} ক্লাস`;
    if (s.total === 0) continue;
    if (s.marked < s.total) out.push({ id: 'att-' + p.key, kind: 'attendance', text: `${name}: হাজিরা নেওয়া হয়নি`, p });
    else if (s.present > 0 && s.rated < s.present) out.push({ id: 'rate-' + p.key, kind: 'rating', text: `${name}: রেটিং বাকি (${bn(s.present - s.rated)} জন)`, p });
  }
  if (review > 0) out.push({ id: 'review', kind: 'review', text: `ক্যামেরার ${bn(review)}টা শনাক্ত দেখে ঠিক করুন` });
  if (homeworkToday === false && periods.length) out.push({ id: 'homework', kind: 'homework', text: 'আজকের বাড়ির কাজ দেওয়া হয়নি' });
  return out;
}

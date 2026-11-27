// The teacher's reads and writes, on the live contracts (see logic.js). Every loader returns { kind, data }: kind 'ok' | 'offline' | 'error' | 'forbidden' ...
// Nothing here throws. Writes of new rows go through the outbox (core/outbox-app.js), so they survive a lost connection.
import { sel, rpc, rows, request } from '../../core/api.js';
import { outbox } from '../../core/outbox-app.js';
import { session } from '../../core/session.js';
import { dhakaDay, uuid } from '../../core/bn.js';
import { writeDone } from '../../core/errors.js';
import { myPeriods, setBatchStarts, reviewItems, homeworkRow, attendanceRow, ratingRow, writePlan, submitPlan, periodKey, attendanceDiff, ratingDiff, isPresent } from './logic.js';

const ST = 'id,class_level,roll,batch_id,profile:profiles!students_profile_id_fkey(full_name,login_id)';
const list = ids => `in.(${ids.join(',')})`;
const fail = r => ({ kind: r.kind === 'ok' ? 'error' : r.kind });
const bad = rs => rs.find(r => r.kind !== 'ok');
export const today = () => dhakaDay();

// ---- routine and rosters ----
// -> { kind, data: { periods, batches } }  (my periods for the day, and the three batches with their real start times)
export async function loadRoutine(uid) {
  const [p, b] = await Promise.all([sel('class_periods', `select=shift,slot,class_level,teacher_id&teacher_id=eq.${uid}&order=shift,slot`), sel('batches', 'select=id,name,shift,start_time,end_time')]);
  if (p.kind !== 'ok') return fail(p);
  const batches = b.kind === 'ok' ? rows(b) : [];
  setBatchStarts(batches);
  return { kind: 'ok', data: { periods: myPeriods(rows(p), uid), batches } };
}
const sortRoster = l => l.slice().sort((a, b) => a.class_level - b.class_level || (parseInt(a.roll, 10) || 999) - (parseInt(b.roll, 10) || 999));
export const studentView = s => ({ id: s.id, class_level: s.class_level, roll: s.roll, name: s.profile?.full_name || 'শিক্ষার্থী', login: s.profile?.login_id || '' });
// Students of one shift (their batch, plus those who also come to this shift through student_batches).
export async function loadRoster(shift) {
  const b = await sel('batches', `select=id&shift=eq.${shift}`);
  if (b.kind !== 'ok') return fail(b);
  const ids = rows(b).map(x => x.id);
  if (!ids.length) return { kind: 'ok', data: [] };
  const [main, extra] = await Promise.all([sel('students', `select=${ST}&batch_id=${list(ids)}&active=is.true&order=roll`), sel('student_batches', `select=student_id&batch_id=${list(ids)}`)]);
  if (main.kind !== 'ok') return fail(main);
  let all = rows(main);
  const more = rows(extra).map(r => r.student_id).filter((id, i, a) => a.indexOf(id) === i && !all.some(m => m.id === id));
  if (more.length) { const x = await sel('students', `select=${ST}&id=${list(more)}&active=is.true`); if (x.kind === 'ok') all = all.concat(rows(x)); }
  return { kind: 'ok', data: sortRoster(all).map(studentView) };
}
// What the server has for one period: { roster (filtered to the period's classes), saved: {id: {present}}, savedR: {id: rating} | null }
// local = rows this phone saved or queued a moment ago that the server may not have yet (merged in, so the rating step works offline too).
const local = new Map();
export const rememberAttendance = (key, d, ids, statuses) => { const m = local.get(key + d) || {}; for (const id of ids) m[id] = { present: isPresent(statuses[id] || 'present') }; local.set(key + d, m); };
export const rememberRatings = (key, d, ratings) => { const m = local.get('r' + key + d) || {}; Object.assign(m, ratings); local.set('r' + key + d, m); };
export async function loadPeriodView({ shift, slot, levels }) {
  const r = await loadRoster(shift);
  if (r.kind !== 'ok') return r;
  const roster = levels ? r.data.filter(s => levels.includes(s.class_level)) : r.data;
  const d = today(), key = periodKey(shift, slot);
  if (!roster.length) return { kind: 'ok', data: { roster, saved: {}, savedR: {}, day: d } };
  const idsQ = list(roster.map(s => s.id));
  const [a, c] = await Promise.all([sel('period_attendance', `select=student_id,present,session&day=eq.${d}&shift=eq.${shift}&slot=eq.${slot}&student_id=${idsQ}`), sel('class_ratings', `select=student_id,behavior,homework,performance&day=eq.${d}&shift=eq.${shift}&slot=eq.${slot}&student_id=${idsQ}`)]);
  const e = bad([a]); if (e) return fail(e);
  const saved = {}; for (const x of rows(a)) saved[x.student_id] = { present: !!x.present, session: x.session || 'class', server: true };
  const savedR = {}; for (const x of rows(c)) savedR[x.student_id] = { behavior: +x.behavior, homework: +x.homework, performance: +x.performance, server: true };
  for (const [id, v] of Object.entries(local.get(key + d) || {})) if (!(id in saved)) saved[id] = { ...v, server: false };
  for (const [id, v] of Object.entries(local.get('r' + key + d) || {})) if (!(id in savedR)) savedR[id] = { ...v, server: false };
  return { kind: 'ok', data: { roster, saved, savedR, day: d } };
}
// Per period counts for "আজ": { state: { [key]: { total, marked, rated, present } }, absent: [{ id, name, roll, level, p }] }. One failed period does not hide the others.
export async function loadDayState(periods) {
  const state = {}, absent = []; let kind = 'ok';
  await Promise.all(periods.map(async p => {
    const r = await loadPeriodView(p);
    if (r.kind !== 'ok') { kind = r.kind; return; }
    const { roster, saved, savedR } = r.data, ids = roster.map(s => s.id);
    state[p.key] = { total: ids.length, marked: ids.filter(id => id in saved).length, rated: ids.filter(id => saved[id]?.present && id in savedR).length, present: ids.filter(id => saved[id]?.present).length };
    for (const s of roster) if (saved[s.id] && !saved[s.id].present) absent.push({ id: s.id, name: s.name, roll: s.roll, level: s.class_level, p });
  }));
  return Object.keys(state).length || !periods.length ? { kind: 'ok', data: { state, absent } } : { kind };
}
// Has this teacher posted homework today? (null = could not be read, so nothing is said)
export async function homeworkPostedToday() {
  const r = await sel('homework', `select=id&created_by=eq.${uid()}&created_at=gte.${today()}T00:00:00%2B06:00&limit=1`);
  return r.kind === 'ok' ? rows(r).length > 0 : null;
}

// ---- writes: attendance first, then ratings ----
const coaching = () => session.me()?.coaching_id, uid = () => session.uid();
// -> { state, states }.  Only students with NO saved row are written here; changed saved rows go through changeAttendance (reason needed).
export async function saveAttendance({ view, statuses, shift, slot }) {
  const { fresh } = attendanceDiff({ statuses, saved: view.saved, ids: view.roster.map(s => s.id) });
  if (!fresh.length) return { state: 'saved', states: {} };
  const now = Date.now();
  const res = await submitPlan(outbox, uid(), writePlan({ attFresh: fresh.map(f => attendanceRow({ coaching_id: coaching(), uid: uid(), day: view.day, shift, slot, id: f.id, present: f.present, now })) }));
  if (['saved', 'queued'].includes(res.state)) rememberAttendance(periodKey(shift, slot), view.day, fresh.map(f => f.id), statuses);
  return res;
}
export async function saveRatings({ view, ratings, shift, slot, presentIds }) {
  const { fresh } = ratingDiff({ ratings, saved: view.savedR, presentIds });
  if (!fresh.length) return { state: 'saved', states: {} };
  const res = await submitPlan(outbox, uid(), writePlan({ rateFresh: fresh.map(f => ratingRow({ coaching_id: coaching(), uid: uid(), day: view.day, shift, slot, ...f })) }));
  if (['saved', 'queued'].includes(res.state)) rememberRatings(periodKey(shift, slot), view.day, Object.fromEntries(fresh.map(f => [f.id, { behavior: f.behavior, homework: f.homework, performance: f.performance }])));
  return res;
}
// A saved value changes only with a reason, online (the server logs it). -> 'ok' | 'offline' | 'reason' | 'failed'
export async function callChange(c) {
  const r = await rpc(c.name, c.args);
  if (r.kind === 'ok') return 'ok';
  if (r.kind === 'offline') return 'offline';
  return /reason_required/.test(JSON.stringify(r.data || '')) ? 'reason' : 'failed';
}

// ---- needs review (camera) ----
export async function loadReview() {
  const r = await sel('attendance', 'select=id,student_id,date,check_in,confidence,student:students(roll,class_level,profile:profiles!students_profile_id_fkey(full_name))&needs_review=is.true&source=eq.cctv&order=date.desc&limit=30');
  return r.kind === 'ok' ? { kind: 'ok', data: reviewItems(rows(r)) } : fail(r);
}
// accept / reject goes through the outbox: with no net it waits on the phone (it is safe to repeat). -> 'saved' | 'queued' | 'failed' | 'rejected'
export async function resolveReview(call) {
  const r = await outbox.submit({ uid: uid(), method: 'POST', path: `/rest/v1/rpc/${call.name}`, body: call.args, label: call.args.p_accept ? 'ক্যামেরার শনাক্ত: ঠিক' : 'ক্যামেরার শনাক্ত: ভুল' });
  return r.state;
}

// ---- guardians (call sheet) ----
export async function loadGuardians(studentIds) {
  if (!studentIds.length) return { kind: 'ok', data: {} };
  const r = await sel('guardian_students', `select=student_id,guardian_id,relation,guardian:profiles!guardian_students_guardian_id_fkey(full_name,phone)&student_id=${list(studentIds)}&limit=500`);
  if (r.kind !== 'ok') return fail(r);
  const m = {};
  for (const o of rows(r)) if (o.guardian?.phone) (m[o.student_id] ||= []).push({ id: o.guardian_id, name: o.guardian.full_name, relation: o.relation || '', phone: o.guardian.phone });
  return { kind: 'ok', data: m };
}

// ---- homework ----
export async function loadHomework(level) {
  const [h, done] = await Promise.all([sel('homework', `select=id,class_level,title,details,due_date,created_at&class_level=eq.${level}&order=created_at.desc&limit=20`), sel('homework_done', 'select=homework_id,student_id&limit=2000')]);
  if (h.kind !== 'ok') return fail(h);
  const n = {}; for (const x of rows(done)) n[x.homework_id] = (n[x.homework_id] || 0) + 1;
  return { kind: 'ok', data: rows(h).map(x => ({ ...x, doneCount: done.kind === 'ok' ? n[x.id] || 0 : null })) };
}
// The client id makes a repeat of the same post (retry, replay from the outbox) the same homework. -> 'saved' | 'queued' | 'failed' | 'rejected'
export async function postHomework(value) {
  const row = homeworkRow({ id: uuid(), coaching_id: coaching(), uid: uid(), value });
  return (await outbox.submit({ uid: uid(), method: 'POST', path: '/rest/v1/homework', body: row, prefer: 'return=minimal', label: 'বাড়ির কাজ' })).state;
}
export const homeworkTodayKey = () => `hw.${uid()}.${today()}`;

// ---- doubts ----
export async function loadDoubts() {
  const r = await sel('doubts', 'select=id,class_level,subject,body,answer,answered_at,created_at,hidden&hidden=is.false&order=created_at.desc&limit=100');
  return r.kind === 'ok' ? { kind: 'ok', data: rows(r) } : fail(r);
}
// -> 'ok' | 'offline' | 'failed'
export async function patchDoubt(id, patch) {
  const r = await request('PATCH', `/rest/v1/doubts?id=eq.${id}&select=id`, patch, { prefer: 'return=representation' });
  return r.kind === 'ok' && Array.isArray(r.data) && r.data.length ? 'ok' : r.kind === 'offline' ? 'offline' : 'failed';
}

// ---- students (quick view) and notes ----
export async function loadStudents() {
  const r = await sel('students', 'select=id,class_level,roll,active,profile:profiles!students_profile_id_fkey(full_name,login_id,phone)&active=is.true&order=class_level,roll&limit=3000');
  return r.kind === 'ok' ? { kind: 'ok', data: rows(r) } : fail(r);
}
export async function loadNotes(studentId) {
  const r = await sel('teacher_notes', `select=id,body,created_at&student_id=eq.${studentId}&order=created_at.desc&limit=5`);
  return r.kind === 'ok' ? { kind: 'ok', data: rows(r) } : fail(r);
}
export async function addNote(studentId, body) {
  const row = { id: uuid(), coaching_id: coaching(), student_id: studentId, body, author_id: uid() };
  return (await outbox.submit({ uid: uid(), method: 'POST', path: '/rest/v1/teacher_notes', body: row, prefer: 'return=minimal', label: 'শিক্ষার্থীর নোট' })).state;
}

// ---- notices ----
export async function sendNotice({ title, body, audience, class_level }) {
  const row = { id: uuid(), coaching_id: coaching(), title, body, audience, class_level: class_level || null, created_by: uid() };
  return (await outbox.submit({ uid: uid(), method: 'POST', path: '/rest/v1/notices', body: row, prefer: 'return=minimal', label: 'নোটিশ' })).state;
}
export { writeDone };

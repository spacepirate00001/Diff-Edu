// Step 5 reads and writes (teacher). Every loader returns { kind, data }: 'ok' | 'offline' | 'error' | 'forbidden' ... Nothing throws.
// Marks and new exams go through the outbox (they survive a lost connection); approvals and uploads need the net (they say so).
import { sel, rpc, rows, request, upload, fn } from '../../core/api.js';
import { outbox } from '../../core/outbox-app.js';
import { session } from '../../core/session.js';
import { dhakaDay, uuid } from '../../core/bn.js';
import { loadRoutine, studentView } from '../teacher/data.js';
import { examRow, marksPlan, splitText, storagePath, extOf, kindOfFile, classReadiness, reportWeek, subjectName } from './logic.js';

const fail = r => ({ kind: r.kind === 'ok' ? 'error' : r.kind });
const list = ids => `in.(${ids.join(',')})`;
const coaching = () => session.me()?.coaching_id, uid = () => session.uid();
export const today = () => dhakaDay();
const ST = 'id,class_level,roll,profile:profiles!students_profile_id_fkey(full_name,login_id)';
const sortRoster = l => l.slice().sort((a, b) => (parseInt(a.roll, 10) || 999) - (parseInt(b.roll, 10) || 999));
const outcome = r => (r.kind === 'ok' ? 'ok' : r.kind === 'offline' ? 'offline' : 'failed');

// ---- which classes this teacher teaches (their periods); null = all classes ----
export async function myLevels() {
  const r = await loadRoutine(uid());
  if (r.kind !== 'ok') return { kind: r.kind, data: null };
  if (!r.data.periods.length || r.data.periods.some(p => !p.levels)) return { kind: 'ok', data: null };
  return { kind: 'ok', data: [...new Set(r.data.periods.flatMap(p => p.levels))].sort((a, b) => a - b) };
}
export async function loadSubjects(level) {
  const r = await sel('subjects', `select=id,name,name_bn&class_level=eq.${level}&order=name`);
  return r.kind === 'ok' ? { kind: 'ok', data: rows(r) } : fail(r);
}

// ---- exams and marks ----
// -> { exams: [exam + subject], marksCount: {examId: n}, classSize: {level: n} }
export async function loadExams() {
  const e = await sel('exams', 'select=id,title,class_level,exam_date,full_marks,created_at,subject:subjects(name,name_bn)&order=exam_date.desc&limit=60');
  if (e.kind !== 'ok') return fail(e);
  const exams = rows(e).map(x => ({ ...x, subject_name: subjectName(x.subject) }));
  if (!exams.length) return { kind: 'ok', data: { exams, marksCount: {}, classSize: {} } };
  const [m, s] = await Promise.all([sel('marks', `select=exam_id&exam_id=${list(exams.map(x => x.id))}&obtained=not.is.null&limit=20000`), sel('students', 'select=class_level&active=is.true&limit=3000')]);
  const marksCount = {}; for (const x of rows(m)) marksCount[x.exam_id] = (marksCount[x.exam_id] || 0) + 1;
  const classSize = {}; for (const x of rows(s)) classSize[x.class_level] = (classSize[x.class_level] || 0) + 1;
  return { kind: 'ok', data: { exams, marksCount, classSize, partial: m.kind !== 'ok' || s.kind !== 'ok' } };
}
export async function loadExam(id) {
  const e = await sel('exams', `select=id,title,class_level,exam_date,full_marks,subject:subjects(name,name_bn)&id=eq.${id}`);
  if (e.kind !== 'ok') return fail(e);
  const exam = rows(e)[0];
  if (!exam) return { kind: 'missing' };
  const [st, mk] = await Promise.all([sel('students', `select=${ST}&class_level=eq.${exam.class_level}&active=is.true&order=roll&limit=500`), sel('marks', `select=student_id,obtained&exam_id=eq.${id}&limit=1000`)]);
  if (st.kind !== 'ok') return fail(st);
  if (mk.kind !== 'ok') return fail(mk);
  const saved = {}; for (const x of rows(mk)) saved[x.student_id] = { obtained: x.obtained == null ? null : Number(x.obtained) };
  return { kind: 'ok', data: { exam: { ...exam, subject_name: subjectName(exam.subject) }, roster: sortRoster(rows(st)).map(studentView), saved } };
}
// a new exam: one insert with a client id, so a repeat is the same exam. -> { state, id }
export async function createExam(value) {
  const id = uuid();
  const r = await outbox.submit({ uid: uid(), method: 'POST', path: '/rest/v1/exams', body: examRow({ id, coaching_id: coaching(), uid: uid(), value }), prefer: 'return=minimal', label: 'নতুন পরীক্ষা' });
  return { state: r.state, id };
}
// -> 'saved' | 'queued' | 'failed' | 'rejected'
export async function saveMarks({ exam_id, rows: list }) {
  const op = marksPlan({ coaching_id: coaching(), exam_id, rows: list });
  if (!op) return 'saved';
  return (await outbox.submit({ uid: uid(), ...op })).state;
}

// ---- upload ----
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
export const sha256 = async blobOrText => hex(await crypto.subtle.digest('SHA-256', typeof blobOrText === 'string' ? new TextEncoder().encode(blobOrText) : await blobOrText.arrayBuffer()));
// One source = one sources row, then each part (storage object first, then its job row), then "queued". Needs the net.
// -> { state: 'ok' } | { state: 'offline' | 'duplicate' | 'failed', why? }   progress(done, total) is called after each part
export async function submitSource({ kind, title, class_level, subject_id, text, file }, progress = () => {}) {
  const hash = await sha256(kind === 'text' ? text : file);
  const id = uuid(), parts = kind === 'text' ? splitText(text) : [null];
  const ins = await request('POST', '/rest/v1/sources', { id, coaching_id: coaching(), created_by: uid(), kind, title: title.trim(), class_level, subject_id: subject_id || null, file_hash: hash, parts_total: parts.length, pii_ack: true, status: 'uploading' }, { prefer: 'return=minimal' });
  if (ins.kind === 'conflict' || (ins.status === 409)) return { state: 'duplicate' };
  if (ins.kind !== 'ok') return { state: outcome(ins), why: 'sources' };
  for (let i = 0; i < parts.length; i++) {
    const row = { coaching_id: coaching(), source_id: id, part_no: i + 1, status: 'queued' };
    if (kind === 'text') row.text_body = parts[i];
    else {
      const path = storagePath(coaching(), id, i + 1, extOf(file));
      const up = await upload('sources', path, file, file.type || (kind === 'pdf' ? 'application/pdf' : 'image/jpeg'));
      if (up.kind !== 'ok') return { state: outcome(up), why: 'upload', id };
      row.storage_path = path;
    }
    const j = await request('POST', '/rest/v1/source_jobs', row, { prefer: 'return=minimal' });
    if (j.kind !== 'ok' && j.status !== 409) return { state: outcome(j), why: 'job', id };
    progress(i + 1, parts.length);
  }
  const done = await request('PATCH', `/rest/v1/sources?id=eq.${id}`, { parts_total: parts.length, status: 'queued' }, { prefer: 'return=minimal' });
  return done.kind === 'ok' ? { state: 'ok', id } : { state: outcome(done), why: 'queued', id };
}
// The worker does one job per call. -> { state: 'idle' | 'processed' | 'offline' | 'failed', due, waiting }
export async function pokeWorker() {
  const r = await fn('extract-source', { action: 'process' }, true);
  if (r.kind === 'offline') return { state: 'offline' };
  if (r.kind !== 'ok' || !r.data) return { state: 'failed' };
  return { state: r.data.state === 'idle' ? 'idle' : 'processed', due: r.data.due_jobs || 0, waiting: r.data.waiting_jobs || 0 };
}
// Recent sources with their question counts. -> [{...source, pending, approved, jobsFailed}]
export async function loadSources() {
  const s = await sel('sources', 'select=id,title,kind,class_level,status,parts_total,created_at,subject:subjects(name,name_bn)&order=created_at.desc&limit=30');
  if (s.kind !== 'ok') return fail(s);
  const src = rows(s);
  if (!src.length) return { kind: 'ok', data: [] };
  const ids = list(src.map(x => x.id));
  const [it, jb] = await Promise.all([sel('source_items', `select=source_id,status&source_id=${ids}&limit=10000`), sel('source_jobs', `select=source_id,status&source_id=${ids}&limit=2000`)]);
  const pend = {}, appr = {}, bad = {};
  for (const x of rows(it)) { const m = x.status === 'pending' ? pend : x.status === 'approved' ? appr : null; if (m) m[x.source_id] = (m[x.source_id] || 0) + 1; }
  for (const x of rows(jb)) if (x.status === 'failed') bad[x.source_id] = (bad[x.source_id] || 0) + 1;
  return { kind: 'ok', data: src.map(x => ({ ...x, subject_name: subjectName(x.subject), pending: pend[x.id] || 0, approved: appr[x.id] || 0, jobsFailed: bad[x.id] || 0 })) };
}
// failed parts go back in the line (up to 3 tries each are the server's rule)
export async function retryFailed(sourceId) {
  const r = await request('PATCH', `/rest/v1/source_jobs?source_id=eq.${sourceId}&status=eq.failed`, { status: 'queued', attempts: 0, next_run_at: new Date().toISOString(), error_code: null }, { prefer: 'return=minimal' });
  return outcome(r);
}

// ---- approval ----
export async function loadItems(sourceId) {
  const [s, it] = await Promise.all([
    sel('sources', `select=id,title,kind,class_level,subject:subjects(id,name,name_bn)&id=eq.${sourceId}`),
    sel('source_items', `select=id,qtype,body,options,answer,marks,needs_figure,has_table,review_note,chapter_hint,topic_suggestion,source_ref,difficulty,chapter_id&source_id=eq.${sourceId}&status=eq.pending&order=item_idx&limit=500`)]);
  if (s.kind !== 'ok') return fail(s);
  if (it.kind !== 'ok') return fail(it);
  const source = rows(s)[0];
  if (!source) return { kind: 'missing' };
  return { kind: 'ok', data: { source: { ...source, subject_name: subjectName(source.subject) }, items: rows(it) } };
}
export async function loadChapters(level) {
  const r = await sel('chapters', `select=id,subject,number,title&class_level=eq.${level}&order=subject,number&limit=400`);
  return r.kind === 'ok' ? { kind: 'ok', data: rows(r) } : fail(r);
}
// -> { state: 'ok', result } | { state: 'offline' | 'failed' }
export async function callApprove(call) {
  const r = await rpc(call.name, call.args);
  return r.kind === 'ok' ? { state: 'ok', result: r.data } : { state: outcome(r) };
}
export async function patchItem(id, patch) {
  const r = await request('PATCH', `/rest/v1/source_items?id=eq.${id}&status=eq.pending&select=id`, patch, { prefer: 'return=representation' });
  return r.kind === 'ok' && Array.isArray(r.data) && r.data.length ? 'ok' : outcome(r);
}

// ---- question bank ----
export async function loadBank(level) {
  const r = await sel('question_bank', `select=id,class_level,subject,chapter_name,qtype,difficulty,body,options,answer,created_at&class_level=eq.${level}&order=created_at.desc&limit=1000`);
  return r.kind === 'ok' ? { kind: 'ok', data: rows(r) } : fail(r);
}
export async function loadBankCounts() {
  const r = await sel('question_bank', 'select=class_level,subject,qtype&limit=20000');
  return r.kind === 'ok' ? { kind: 'ok', data: rows(r) } : fail(r);
}
// ---- report cards (status of one class for one week) ----
// -> { weeks: ..., classes: [{ level, size, state, missing, ratingsLeft, exams }] } for the levels given
export async function loadCardStatus(levels, weekIso) {
  const w = reportWeek(weekIso);
  const [ex, st, cards] = await Promise.all([
    sel('exams', `select=id,title,class_level,full_marks&exam_date=gte.${w.from}&exam_date=lte.${w.to}&class_level=${list(levels)}&limit=200`),
    sel('students', `select=id,class_level&active=is.true&class_level=${list(levels)}&limit=3000`),
    sel('report_cards', `select=class_level,status&kind=eq.weekly&period_from=eq.${w.from}&period_to=eq.${w.to}&class_level=${list(levels)}&limit=3000`)]);
  if (ex.kind !== 'ok') return fail(ex);
  if (st.kind !== 'ok') return fail(st);
  const exams = rows(ex), students = rows(st);
  const sidq = list(students.map(x => x.id)), none = { kind: 'ok', data: [] };
  const [mk, rt, pa] = await Promise.all([
    exams.length ? sel('marks', `select=exam_id,student_id&exam_id=${list(exams.map(x => x.id))}&obtained=not.is.null&limit=20000`) : none,
    students.length ? sel('class_ratings', `select=student_id&day=gte.${w.from}&day=lte.${w.to}&student_id=${sidq}&limit=20000`) : none,
    students.length ? sel('period_attendance', `select=student_id&present=is.true&day=gte.${w.from}&day=lte.${w.to}&student_id=${sidq}&limit=20000`) : none]);
  const bad = [mk, rt, pa].find(x => x.kind !== 'ok'); if (bad) return fail(bad);
  const marksBy = {}; for (const x of rows(mk)) (marksBy[x.exam_id] ||= new Set()).add(x.student_id);
  const rated = new Set(rows(rt).map(x => x.student_id)), present = new Set(rows(pa).map(x => x.student_id));
  const published = {}; for (const c of rows(cards)) if (c.status === 'published') published[c.class_level] = (published[c.class_level] || 0) + 1;
  const classes = levels.map(level => {
    const sts = students.filter(s => s.class_level === level), es = exams.filter(e => e.class_level === level);
    const marks = Object.fromEntries(es.map(e => [e.id, marksBy[e.id]?.size || 0]));
    return { level, size: sts.length, exams: es.length, ...classReadiness({ exams: es, marks, size: sts.length, ratingsLeft: sts.filter(s => present.has(s.id) && !rated.has(s.id)).length, anyRated: sts.some(s => rated.has(s.id)), published: published[level] || 0 }) };
  });
  return { kind: 'ok', data: { week: w, classes } };
}

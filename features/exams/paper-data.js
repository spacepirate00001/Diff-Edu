// Reads and writes of the paper builder (teacher). Every loader returns { kind, data }; writers return a state word. Nothing throws.
// Papers need the net (a saved paper is shared with the other teachers); they say so.
import { sel, rows, request } from '../../core/api.js';
import { session } from '../../core/session.js';
import { paperRow, paperFromRow, onlinePlan } from './paper-logic.js';

const fail = r => ({ kind: r.kind === 'ok' ? 'error' : r.kind });
const state = r => (r.kind === 'ok' ? 'ok' : r.kind === 'offline' ? 'offline' : r.kind === 'forbidden' ? 'forbidden' : 'failed');
const coaching = () => session.me()?.coaching_id, uid = () => session.uid();
const MIN = { prefer: 'return=minimal' };
const BANK_COLS = 'id,class_level,subject,chapter_name,qtype,difficulty,body,options,answer,visibility,marks,needs_figure,created_at';

// ---- bank (all columns the builder needs), paged by 1000 up to 4000 ----
export async function loadBankFull(level) {
  const all = [];
  for (let off = 0; off < 4000; off += 1000) {
    const r = await sel('question_bank', `select=${BANK_COLS}&class_level=eq.${level}&order=created_at.desc,id&limit=1000&offset=${off}`);
    if (r.kind !== 'ok') return fail(r);
    const part = rows(r); all.push(...part);
    if (part.length < 1000) break;
  }
  return { kind: 'ok', data: all };
}

// ---- papers ----
export async function loadPapers() {
  const r = await sel('papers', 'select=*&order=updated_at.desc&limit=100');
  return r.kind === 'ok' ? { kind: 'ok', data: rows(r).map(paperFromRow) } : fail(r);
}
export async function loadPaper(id) {
  const r = await sel('papers', `select=*&id=eq.${id}`);
  if (r.kind !== 'ok') return fail(r);
  const x = rows(r)[0];
  return x ? { kind: 'ok', data: paperFromRow(x) } : { kind: 'missing' };
}
// -> 'saved' | 'offline' | 'failed' | 'forbidden'
export async function savePaper(paper, { isNew = false } = {}) {
  const patch = () => request('PATCH', `/rest/v1/papers?id=eq.${paper.id}`, paperRow(paper), MIN);
  let r;
  if (isNew) {
    r = await request('POST', '/rest/v1/papers', paperRow(paper, { coaching_id: coaching(), uid: uid() }), MIN);
    if (r.status === 409 || r.kind === 'conflict') r = await patch();   // a retry of the same save
  } else r = await patch();
  return r.kind === 'ok' ? 'saved' : state(r);
}
export async function deletePaper(id) { return state(await request('DELETE', `/rest/v1/papers?id=eq.${id}`, undefined, MIN)); }

// ---- run the MCQs as an online exam ----
// runValue = validateRun().value. The exam row starts as a draft and is published only when every question and option is in.
// -> { state: 'ok', examId } | { state: 'empty' | 'offline' | 'failed', why? }
export async function publishOnline(paper, runValue) {
  const plan = onlinePlan(paper, { coaching_id: coaching(), uid: uid(), ...runValue });
  if (!plan.questions.length) return { state: 'empty' };
  const ex = await request('POST', '/rest/v1/online_exams', plan.exam, MIN);
  if (ex.kind !== 'ok') return { state: state(ex) === 'offline' ? 'offline' : 'failed', why: 'exam' };
  const undo = () => request('DELETE', `/rest/v1/online_exams?id=eq.${plan.examId}`, undefined, MIN);
  for (const [why, list] of [['questions', plan.questions], ['options', plan.options]]) {
    for (let i = 0; i < list.length; i += 200) {
      const r = await request('POST', `/rest/v1/exam_${why}`, list.slice(i, i + 200), MIN);
      if (r.kind !== 'ok') { await undo(); return { state: state(r) === 'offline' ? 'offline' : 'failed', why }; }
    }
  }
  const pub = await request('PATCH', `/rest/v1/online_exams?id=eq.${plan.examId}`, { status: 'published' }, MIN);
  if (pub.kind !== 'ok') { await undo(); return { state: state(pub) === 'offline' ? 'offline' : 'failed', why: 'publish' }; }
  return { state: 'ok', examId: plan.examId };
}
// The exams made from this paper, with how many students have submitted.
export async function loadPaperRuns(paperId) {
  const r = await sel('online_exams', `select=id,title,kind,status,starts_at,ends_at,duration_minutes,class_level,created_at&paper_id=eq.${paperId}&order=created_at.desc&limit=50`);
  if (r.kind !== 'ok') return fail(r);
  const list = rows(r);
  if (!list.length) return { kind: 'ok', data: [] };
  const a = await sel('exam_attempts', `select=exam_id&submitted_at=not.is.null&exam_id=in.(${list.map(x => x.id).join(',')})&limit=20000`);
  const n = {}; for (const x of rows(a)) n[x.exam_id] = (n[x.exam_id] || 0) + 1;
  return { kind: 'ok', data: list.map(x => ({ ...x, attempts: n[x.id] || 0 })), partial: a.kind !== 'ok' };
}
// Students stop seeing it (back to draft).
export async function closeRun(examId) { return state(await request('PATCH', `/rest/v1/online_exams?id=eq.${examId}`, { status: 'draft' }, MIN)); }

// "প্রশ্নপত্র" (teacher): build a question paper from the question bank. Pure (no DOM, no network), so node --test can check it.
// A paper keeps its own COPY of every question (items), so editing a paper never changes the bank.
//   paper = { id, title, class_level, subject, header: { institute, exam_name, date, minutes, note }, items: [item], created_at, updated_at }
//   item  = { key, bank_id, qtype, body, options[], answer, marks, chapter, difficulty, needs_figure, edited }
import { bn, ascii, uuid } from '../../core/bn.js';
import { QT, LAB } from './logic.js';

export const DIFF = { easy: 'সহজ', medium: 'মাঝারি', hard: 'কঠিন' };
export const TYPE_ORDER = ['mcq', 'short', 'creative', 'math', 'other'];
export const SECTION = { mcq: 'বহুনির্বাচনী প্রশ্ন', short: 'সংক্ষিপ্ত প্রশ্ন', creative: 'সৃজনশীল প্রশ্ন', math: 'গাণিতিক প্রশ্ন', other: 'অন্যান্য প্রশ্ন' };
export const DEFAULT_MARKS = { mcq: 1, short: 2, creative: 10, math: 3, other: 2 };
export const MAX_ITEMS = 200;
export const TITLE_MAX = 120;
export const BODY_MAX = 4000;

const norm = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const num = (v, d = 0) => { const n = Number(ascii(String(v ?? '')).replace(/,/g, '.')); return Number.isFinite(n) ? n : d; };
// 1 -> "১", 2.5 -> "২.৫"
export const marksText = n => bn(Math.round(Number(n) * 100) / 100);

// ---- one question ----
// A question of the bank -> a copy for the paper.
export function itemFromBank(r, marks) {
  return { key: uuid(), bank_id: r.id || null, qtype: r.qtype || 'other', body: String(r.body ?? ''), options: (r.options || []).map(String), answer: String(r.answer ?? ''),
    marks: marks != null ? Number(marks) : r.marks != null ? Number(r.marks) : DEFAULT_MARKS[r.qtype] ?? 1, chapter: r.chapter_name || '', difficulty: r.difficulty || '', needs_figure: !!r.needs_figure, edited: false };
}
// A blank question the teacher writes by hand (no bank_id).
export const blankItem = (qtype = 'short') => ({ key: uuid(), bank_id: null, qtype, body: '', options: qtype === 'mcq' ? ['', '', '', ''] : [], answer: '', marks: DEFAULT_MARKS[qtype] ?? 1, chapter: '', difficulty: '', needs_figure: false, edited: false });
// An MCQ is sound when it has 2+ options and the answer is exactly one of them.
export const mcqOk = it => it.qtype === 'mcq' && it.options.filter(o => norm(o)).length >= 2 && it.options.map(String).includes(String(it.answer ?? ''));
export const answerIndex = it => (it.qtype === 'mcq' ? it.options.map(String).indexOf(String(it.answer ?? '')) : -1);
export const answerLetter = it => { const i = answerIndex(it); return i >= 0 ? LAB[i] || bn(i + 1) : ''; };
// Edit sheet -> a checked copy of the item. -> { ok, item } | { ok: false, error }
export function editItem(it, { body, options, answer, marks }) {
  const b = String(body ?? '').trim();
  if (!b) return { ok: false, error: 'প্রশ্ন লিখুন' };
  if (b.length > BODY_MAX) return { ok: false, error: `প্রশ্ন ${bn(BODY_MAX)} অক্ষরের মধ্যে রাখুন` };
  const m = num(marks, NaN);
  if (!(m > 0 && m <= 100)) return { ok: false, error: 'নম্বর ০-এর বেশি আর ১০০-এর মধ্যে দিন' };
  const next = { ...it, body: b, marks: Math.round(m * 100) / 100, edited: it.edited || b !== it.body };
  if (it.qtype === 'mcq') {
    const opts = (options || []).map(o => String(o).trim()).filter(Boolean);
    if (opts.length < 2) return { ok: false, error: 'অন্তত দুটি অপশন দিন' };
    if (!opts.includes(String(answer ?? ''))) return { ok: false, error: 'সঠিক উত্তর বেছে নিন' };
    if (JSON.stringify(opts) !== JSON.stringify(it.options) || String(answer) !== it.answer) next.edited = true;
    next.options = opts; next.answer = String(answer);
  } else { next.answer = String(answer ?? '').trim(); if (next.answer !== it.answer) next.edited = true; }
  return { ok: true, item: next };
}

// ---- the bank: what the teacher sees while picking ----
// rows = question_bank rows of one class and subject. Filters: qtype, chapters (Set of names, empty = all), difficulty, q (search), hideFigure, only ('practice' | 'reserved' | null), exclude (Set of bank ids already in the paper).
export function pickable(rows, { qtype = null, chapters = null, difficulty = null, q = '', hideFigure = false, only = null, exclude = null } = {}) {
  const t = norm(q).toLowerCase();
  return rows.filter(r => (!qtype || r.qtype === qtype) && (!chapters || !chapters.size || chapters.has(r.chapter_name || ''))
    && (!difficulty || r.difficulty === difficulty) && (!only || (r.visibility || 'practice') === only) && !(hideFigure && r.needs_figure)
    && !(exclude && exclude.has(r.id)) && (!t || norm(r.body).toLowerCase().includes(t) || (r.options || []).some(o => norm(o).toLowerCase().includes(t))));
}
// Fisher-Yates (rnd is injectable for tests).
export function shuffle(list, rnd = Math.random) { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// "অটো বাছাই": n questions at random out of rows, spread over the chapters (one from each chapter in turn) so the paper covers the syllabus,
// and never the same question twice. mix = { easy: 2, medium: 5, hard: 3 } asks for that many of each difficulty first (what cannot be found is filled from the rest).
export function autoPick(rows, n, { spread = true, mix = null, rnd = Math.random } = {}) {
  const want = Math.max(0, Math.min(Math.floor(n) || 0, rows.length));
  const out = [], used = new Set();
  const take = (pool, k) => {
    if (k <= 0) return;
    if (!spread) { for (const r of shuffle(pool, rnd)) { if (out.length >= want || k <= 0) break; if (!used.has(r.id)) { used.add(r.id); out.push(r); k--; } } return; }
    const by = new Map();
    for (const r of shuffle(pool, rnd)) { if (used.has(r.id)) continue; const c = r.chapter_name || ''; (by.get(c) || by.set(c, []).get(c)).push(r); }
    const lists = shuffle([...by.values()], rnd);
    while (k > 0 && out.length < want && lists.some(l => l.length)) for (const l of lists) { if (k <= 0 || out.length >= want) break; const r = l.shift(); if (r) { used.add(r.id); out.push(r); k--; } }
  };
  if (mix) for (const d of ['easy', 'medium', 'hard']) take(rows.filter(r => r.difficulty === d), Math.min(Number(mix[d]) || 0, want - out.length));
  take(rows, want - out.length);
  return out;
}

// ---- the paper ----
export const newPaper = (over = {}) => ({ id: uuid(), title: '', class_level: null, subject: '', header: { institute: '', exam_name: '', date: '', minutes: '', note: '' }, items: [], ...over });
export function totals(items) {
  const byType = {}; let marks = 0;
  for (const it of items) { byType[it.qtype] = (byType[it.qtype] || 0) + 1; marks += Number(it.marks) || 0; }
  return { count: items.length, marks: Math.round(marks * 100) / 100, byType };
}
// "২০টা প্রশ্ন · পূর্ণমান ২০ · বহুনির্বাচনী ১৫, সংক্ষিপ্ত ৫"
export function totalsLine(items) {
  const t = totals(items), parts = TYPE_ORDER.filter(k => t.byType[k]).map(k => `${QT[k]} ${bn(t.byType[k])}`);
  return `${bn(t.count)}টা প্রশ্ন · পূর্ণমান ${marksText(t.marks)}${parts.length ? ' · ' + parts.join(', ') : ''}`;
}
export const addItems = (items, rows) => { const have = new Set(items.map(i => i.bank_id).filter(Boolean)); return [...items, ...rows.filter(r => !have.has(r.id)).map(r => itemFromBank(r)).slice(0, Math.max(0, MAX_ITEMS - items.length))]; };
export const removeAt = (items, i) => items.filter((_, k) => k !== i);
export function moveItem(items, i, to) { if (to < 0 || to >= items.length || i === to) return items; const a = items.slice(); const [x] = a.splice(i, 1); a.splice(to, 0, x); return a; }
export const setMarksAll = (items, qtype, m) => items.map(it => (it.qtype === qtype ? { ...it, marks: m } : it));
// Keep the order the teacher chose, but a paper reads best with each kind together: MCQ, then short, then creative.
export const groupByType = items => TYPE_ORDER.flatMap(k => items.filter(i => i.qtype === k));
// For printing: sections with a heading, each question with its running number (restarts per section) -> [{ qtype, title, marks, rows: [{ no, item }] }]
export function sections(items) {
  return TYPE_ORDER.map(k => items.filter(i => i.qtype === k)).filter(l => l.length).map(l => ({ qtype: l[0].qtype, title: SECTION[l[0].qtype], marks: totals(l).marks, rows: l.map((item, i) => ({ no: i + 1, item })) }));
}
// -> { ok, errors: { title, class_level, subject, items, marks, minutes } }
export function validatePaper(p) {
  const errors = {}, title = norm(p.title);
  if (!title) errors.title = 'প্রশ্নপত্রের একটা নাম দিন (যেমন: ৬ষ্ঠ শ্রেণি গণিত, প্রথম সাময়িক)'; else if (title.length > TITLE_MAX) errors.title = `নাম ${bn(TITLE_MAX)} অক্ষরের মধ্যে রাখুন`;
  if (!(p.class_level >= 1 && p.class_level <= 10)) errors.class_level = 'ক্লাস বেছে নিন';
  if (!norm(p.subject)) errors.subject = 'বিষয় বেছে নিন';
  if (!p.items.length) errors.items = 'অন্তত একটা প্রশ্ন বাছুন';
  else if (p.items.length > MAX_ITEMS) errors.items = `${bn(MAX_ITEMS)}টার বেশি প্রশ্ন রাখা যায় না`;
  else if (p.items.some(i => !norm(i.body))) errors.items = 'কোনো প্রশ্ন খালি আছে';
  else if (p.items.some(i => i.qtype === 'mcq' && !mcqOk(i))) errors.items = 'কোনো বহুনির্বাচনী প্রশ্নের উত্তর অপশনের সাথে মিলছে না';
  if (p.items.some(i => !(Number(i.marks) > 0))) errors.marks = 'প্রতিটি প্রশ্নে নম্বর দিন';
  const mins = String(p.header?.minutes ?? '').trim();
  if (mins && !(num(mins, 0) >= 1 && num(mins, 0) <= 600)) errors.minutes = 'সময় ১ থেকে ৬০০ মিনিটের মধ্যে দিন';
  return { ok: !Object.keys(errors).length, errors };
}
// Header fields are trimmed and capped; empty ones are left out.
export function cleanHeader(h = {}) {
  const out = {};
  for (const [k, max] of [['institute', 80], ['exam_name', 80], ['date', 30], ['minutes', 4], ['note', 300]]) { const v = norm(h[k]).slice(0, max); if (v) out[k] = k === 'minutes' ? String(num(v, '')) || '' : v; }
  if (out.minutes === '') delete out.minutes;
  return out;
}
// papers row for insert / patch (PostgREST body)
export const paperRow = (p, { coaching_id, uid } = {}) => ({ ...(coaching_id ? { id: p.id, coaching_id, created_by: uid } : {}), title: norm(p.title), class_level: Number(p.class_level), subject: norm(p.subject), header: cleanHeader(p.header), items: p.items.map(i => ({ ...i, marks: Number(i.marks) })) });
// papers row from the server -> paper (items made safe)
export const paperFromRow = r => ({ id: r.id, title: r.title || '', class_level: r.class_level, subject: r.subject || '', header: { institute: '', exam_name: '', date: '', minutes: '', note: '', ...(r.header || {}) },
  items: (Array.isArray(r.items) ? r.items : []).map(i => ({ key: i.key || uuid(), bank_id: i.bank_id || null, qtype: i.qtype || 'other', body: String(i.body ?? ''), options: (i.options || []).map(String), answer: String(i.answer ?? ''), marks: Number(i.marks) || 1, chapter: i.chapter || '', difficulty: i.difficulty || '', needs_figure: !!i.needs_figure, edited: !!i.edited })),
  created_by: r.created_by, created_at: r.created_at, updated_at: r.updated_at });
// A copy for "কপি করে নতুন বানান": new id, " (কপি)" after the name.
export const copyPaper = p => ({ ...p, id: uuid(), title: (norm(p.title) + ' (কপি)').slice(0, TITLE_MAX), items: p.items.map(i => ({ ...i, key: uuid() })), created_at: undefined, updated_at: undefined });

// ---- print ----
// Everything print.html needs, as plain data (it is kept on this phone for the print page, nothing is sent). withAnswers adds the answer key page.
export function printJob(p, { withAnswers = false } = {}) {
  const items = groupByType(p.items), t = totals(items);
  return { kind: 'paper', title: p.title, withAnswers, class_level: p.class_level, subject: p.subject, header: cleanHeader(p.header), total: t.marks, count: t.count,
    sections: sections(items).map(s => ({ qtype: s.qtype, title: s.title, marks: s.marks, rows: s.rows.map(({ no, item }) => ({ no, body: item.body, options: item.options, marks: item.marks, answer: item.answer, letter: answerLetter(item), needs_figure: item.needs_figure })) })) };
}

// ---- run as an online exam (only the MCQs can be marked by the app; the rest are for the printed paper) ----
export const onlineItems = p => groupByType(p.items).filter(mcqOk);
export function onlineSummary(p) {
  const on = onlineItems(p).length, off = p.items.length - on;
  return { on, off, text: on ? `${bn(on)}টা বহুনির্বাচনী প্রশ্ন অ্যাপে আসবে${off ? `; বাকি ${bn(off)}টা শুধু ছাপা কাগজে` : ''}` : 'অ্যাপে পরীক্ষার জন্য অন্তত একটা বহুনির্বাচনী প্রশ্ন লাগবে' };
}
// Rows for online_exams / exam_questions / exam_options (client ids, so a retry is the same exam). status starts as 'draft' and is switched to 'published' only after every row is in.
// opts: { coaching_id, uid, kind: 'practice' | 'live', starts_at, ends_at (ISO), minutes }
export function onlinePlan(p, { coaching_id, uid, kind = 'practice', starts_at = null, ends_at = null, minutes }) {
  const examId = uuid(), qs = onlineItems(p), questions = [], options = [];
  qs.forEach((it, qi) => {
    const qid = uuid();
    questions.push({ id: qid, exam_id: examId, coaching_id, position: qi + 1, body: it.body });
    it.options.forEach((o, oi) => options.push({ id: uuid(), question_id: qid, coaching_id, position: oi + 1, body: String(o), is_correct: String(o) === it.answer }));
  });
  return { examId, exam: { id: examId, coaching_id, title: norm(p.title).slice(0, TITLE_MAX), kind, status: 'draft', starts_at: kind === 'live' ? starts_at : null, ends_at: kind === 'live' ? ends_at : null,
    duration_minutes: Math.max(1, Math.round(num(minutes, 30))), created_by: uid, class_level: Number(p.class_level), paper_id: p.id }, questions, options };
}
// Teacher's form -> { ok, errors, value } for starting an online exam. startText 'YYYY-MM-DDTHH:MM' is Dhaka time.
export function validateRun({ kind, start, minutes, endMode, end }, nowMs = Date.now()) {
  const errors = {}, mins = Math.round(num(minutes, 0));
  if (!(mins >= 1 && mins <= 600)) errors.minutes = 'সময় ১ থেকে ৬০০ মিনিটের মধ্যে দিন';
  let starts_at = null, ends_at = null;
  if (kind === 'live') {
    const s = Date.parse((start || '') + ':00+06:00');
    if (!Number.isFinite(s)) errors.start = 'শুরুর তারিখ ও সময় দিন';
    else if (s < nowMs - 5 * 60e3) errors.start = 'শুরুর সময় পার হয়ে গেছে';
    else { starts_at = new Date(s).toISOString(); const e = endMode === 'custom' ? Date.parse((end || '') + ':00+06:00') : s + (mins + 30) * 60e3;
      if (!Number.isFinite(e)) errors.end = 'শেষের সময় দিন'; else if (e < s + mins * 60e3) errors.end = 'শেষের সময় পরীক্ষার সময়ের চেয়ে কম হতে পারে না'; else ends_at = new Date(e).toISOString(); }
  }
  return { ok: !Object.keys(errors).length, errors, value: { kind, minutes: mins, starts_at, ends_at } };
}

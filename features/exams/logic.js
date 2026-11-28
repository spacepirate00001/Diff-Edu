// Step 5 (teacher): marks, question upload / approval / bank, report-card status. Pure (no DOM, no network), so node --test can check it.
// Contracts are the live ones: exams, marks (unique exam_id + student_id), sources / source_jobs / source_items, rpc approve_source_items / reject_source_items,
// question_bank, report_cards (status draft | published), report_settings.
import { bn, ascii } from '../../core/bn.js';

export const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const TITLE_MAX = 80;
export const MARKS_PATH = '/rest/v1/marks?on_conflict=exam_id,student_id';
export const MERGE = 'return=minimal,resolution=merge-duplicates';

// ---- exams ----
// -> { ok, errors: {title, class_level, full_marks, exam_date}, value }
export function validateExam(v, today) {
  const errors = {}, title = String(v.title ?? '').trim();
  const level = Number(v.class_level), full = Number(ascii(v.full_marks));
  if (!title) errors.title = 'পরীক্ষার নাম লিখুন';
  else if (title.length > TITLE_MAX) errors.title = `নাম ${bn(TITLE_MAX)} অক্ষরের মধ্যে রাখুন`;
  if (!LEVELS.includes(level)) errors.class_level = 'ক্লাস বেছে নিন';
  if (!(full >= 1 && full <= 1000)) errors.full_marks = 'পূর্ণমান ১ থেকে ১০০০-এর মধ্যে দিন';
  const date = v.exam_date || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.exam_date = 'তারিখ ঠিক নয়';
  return { ok: !Object.keys(errors).length, errors, value: { title, class_level: level, full_marks: full, exam_date: date, subject_id: v.subject_id || null } };
}
export const examRow = ({ id, coaching_id, uid, value }) => ({ id, coaching_id, created_by: uid, title: value.title, class_level: value.class_level, full_marks: value.full_marks, exam_date: value.exam_date, subject_id: value.subject_id });
export const subjectName = s => (s ? s.name_bn || s.name || '' : '');
// Newest first; each exam with how many of its class have a mark.
export function examCards(exams, marksCount = {}, classSize = {}) {
  return exams.slice().sort((a, b) => (b.exam_date || '').localeCompare(a.exam_date || '') || (b.created_at || '').localeCompare(a.created_at || ''))
    .map(e => { const done = marksCount[e.id] || 0, total = classSize[e.class_level] ?? null; return { ...e, done, total, complete: total != null && total > 0 && done >= total }; });
}

// ---- marks entry ----
// One box per student. Blank = not entered yet. Digits may be Bangla. Decimals up to 2 places. Above the full marks is refused here, not sent.
// -> { ok, value: number|null, error? }
export function parseMark(text, full) {
  const s = ascii(String(text ?? '')).trim().replace(/,/g, '.');
  if (s === '') return { ok: true, value: null };
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return { ok: false, value: null, error: 'শুধু সংখ্যা লিখুন' };
  const n = Number(s);
  if (n > full) return { ok: false, value: null, error: `পূর্ণমান ${bn(full)}-এর বেশি হবে না` };
  return { ok: true, value: n };
}
// entered: { id: text typed } (only boxes the teacher touched). saved: { id: { obtained } }. -> { rows: [{id, value, changed}], errors: {id: text}, untouched }
export function marksDiff({ ids, entered = {}, saved = {}, full }) {
  const rows = [], errors = {};
  for (const id of ids) {
    if (!(id in entered)) continue;
    const p = parseMark(entered[id], full);
    if (!p.ok) { errors[id] = p.error; continue; }
    if (p.value == null) continue;                       // a blank box never erases a saved mark
    const was = saved[id]?.obtained;
    if (was != null && Number(was) === p.value) continue;
    rows.push({ id, value: p.value, changed: was != null });
  }
  return { rows, errors };
}
export const markRow = ({ coaching_id, exam_id, id, value }) => ({ coaching_id, exam_id, student_id: id, obtained: value });
export function marksPlan({ coaching_id, exam_id, rows }) {
  return rows.length ? { method: 'POST', path: MARKS_PATH, body: rows.map(r => markRow({ coaching_id, exam_id, id: r.id, value: r.value })), prefer: MERGE, label: 'পরীক্ষার নম্বর' } : null;
}
// Words for the top of the entry page: how many have a mark, and the best / average (only from saved + typed valid marks).
export function marksSummary({ ids, entered = {}, saved = {}, full }) {
  const vals = [];
  for (const id of ids) {
    const typed = id in entered ? parseMark(entered[id], full) : null;
    const v = typed ? (typed.ok ? typed.value : null) : saved[id]?.obtained != null ? Number(saved[id].obtained) : null;
    if (v != null) vals.push(v);
  }
  const done = vals.length, avg = done ? vals.reduce((a, b) => a + b, 0) / done : null;
  return { done, total: ids.length, left: ids.length - done, avg: avg == null ? null : Math.round(avg * 10) / 10, top: done ? Math.max(...vals) : null };
}

// ---- question upload ----
export const KIND_BN = { pdf: 'PDF', image: 'ছবি', text: 'লেখা', docx: 'ওয়ার্ড', youtube: 'ভিডিও' };
export const TEXT_MAX = 100000;            // source_jobs.text_body limit
export const FILE_MAX = 12 * 1024 * 1024;  // one file goes up as ONE part; bigger files need the old app's splitter
export const TEXT_PART = 30000;            // characters per part
export function kindOfFile(f) {
  const n = String(f?.name || '').toLowerCase(), t = String(f?.type || '');
  if (t === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  if (t.startsWith('image/') || /\.(jpe?g|png|webp)$/.test(n)) return 'image';
  if (t === 'text/plain' || /\.(txt|md)$/.test(n)) return 'text';
  if (n.endsWith('.docx')) return 'docx';
  return null;
}
// Pasted text -> parts of up to TEXT_PART characters, cut at a line break when there is one near the end.
export function splitText(text, size = TEXT_PART) {
  const t = String(text ?? '').replace(/\r\n/g, '\n').trim();
  const out = [];
  let rest = t;
  while (rest.length > size) {
    let cut = rest.lastIndexOf('\n', size);
    if (cut < size * 0.6) cut = size;
    out.push(rest.slice(0, cut).trim()); rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}
export const storagePath = (coaching, source, part, ext) => `${coaching}/${source}/${part}.${ext}`;
export const extOf = f => { const m = /\.([a-z0-9]{2,5})$/i.exec(f?.name || ''); const e = m ? m[1].toLowerCase() : ''; return e === 'jpeg' ? 'jpg' : e || (f?.type === 'application/pdf' ? 'pdf' : 'jpg'); };
// -> { ok, errors: {class_level, title, text, file, ack} }
export function validateUpload({ kind, class_level, title, text, file, ack }) {
  const errors = {};
  if (!LEVELS.includes(Number(class_level))) errors.class_level = 'ক্লাস বেছে নিন';
  if (!String(title ?? '').trim()) errors.title = 'একটা নাম দিন (যেমন: ৬ষ্ঠ শ্রেণি গণিত অধ্যায় ৩)';
  else if (String(title).trim().length > 200) errors.title = 'নাম আরও ছোট করুন';
  if (kind === 'text') { if (!String(text ?? '').trim()) errors.text = 'লেখা পেস্ট করুন'; else if (String(text).length > 300000) errors.text = 'লেখা খুব বড়, ভাগ করে দিন'; }
  else if (!file) errors.file = 'ফাইল বেছে নিন';
  else if (!kindOfFile(file)) errors.file = 'PDF, ছবি বা .txt ফাইল দিন';
  else if (kindOfFile(file) === 'docx') errors.file = 'ওয়ার্ড ফাইল এখনো চলে না: লেখা কপি করে পেস্ট করুন বা PDF করে দিন';
  else if (file.size > FILE_MAX) errors.file = 'ফাইল ১২ MB-এর বেশি। ছোট করে বা কম্পিউটার থেকে দিন';
  if (!ack) errors.ack = 'শিক্ষার্থীর ব্যক্তিগত তথ্য নেই, এটা মেনে নিন';
  return { ok: !Object.keys(errors).length, errors };
}
export const SOURCE_STATUS = { uploading: 'জমা হচ্ছে', queued: 'লাইনে আছে', processing: 'AI পড়ছে', done: 'প্রশ্ন তৈরি', partial: 'কিছু অংশ হয়নি', failed: 'হয়নি', retracted: 'ফেরত নেওয়া' };
export const sourceBusy = s => ['uploading', 'queued', 'processing'].includes(s);

// ---- question approval ----
export const QT = { mcq: 'বহুনির্বাচনী', short: 'সংক্ষিপ্ত', creative: 'সৃজনশীল', math: 'গণিত', other: 'অন্যান্য' };
export const LAB = ['ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ'];
const norm = s => String(s ?? '').replace(/\s+/g, ' ').trim();
// An MCQ whose answer is empty or not exactly one of its options cannot be approved as it is.
export const mcqBad = it => it.qtype === 'mcq' && !(it.options || []).map(String).includes(String(it.answer ?? ''));
// Needs the teacher's eyes: a note, a figure, a type the AI was unsure of, or a broken MCQ.
export const needsLook = it => !!(it.review_note || it.needs_figure || it.qtype === 'math' || it.qtype === 'other' || mcqBad(it));
// The ones safe to approve together: not flagged, and short / creative / a sound MCQ with its answer.
export const isSafe = it => !needsLook(it) && (it.qtype === 'creative' || it.qtype === 'short' || (it.qtype === 'mcq' && !mcqBad(it)));
export const splitItems = items => ({ safe: items.filter(isSafe), look: items.filter(it => !isSafe(it)) });
// The AI sometimes writes its own reading of the answer in review_note ("AI-র পড়া উত্তর: <text> — ..."): offer it as one tap.
const SUG = /AI-র পড়া উত্তর: (.+?) — /g;
export function suggestOf(it) {
  if (it.qtype !== 'mcq' || norm(it.answer) !== '') return null;
  const opts = (it.options || []).map(String);
  for (const m of String(it.review_note ?? '').matchAll(SUG)) {
    const idx = opts.findIndex(o => norm(o) === norm(m[1]));
    if (idx >= 0 && LAB[idx]) return { idx, letter: LAB[idx], text: opts[idx] };
  }
  return null;
}
// A chapter label the AI should replace: empty, a bare number, a code ("ch-10"), "মডেল টেস্ট", "অধ্যায়-১" (same rule as the classify-chapters function).
export const chapterJunk = s => typeof s !== 'string' || /^\s*$|^[\s০-৯0-9.,;:\-–—_/()]+$|^ch[-_ ]?[\d, ]+$|মডেল\s*টেস্ট|^অধ্যায়[\s\-–—]*[\d০-৯]*\s*$|^chapter[\s\-]*\d*$|^unit[\s\-]*\d*$/i.test(s);
export const approveCall = (ids, { visibility = null, chapter_id = null, subject = null } = {}) => ({ name: 'approve_source_items', args: { p_ids: ids, p_visibility: visibility, p_chapter_id: chapter_id, p_subject: subject } });
export const rejectCall = ids => ({ name: 'reject_source_items', args: { p_ids: ids } });
export const REASON = { not_pending: 'আগেই নিষ্পত্তি হয়েছে', no_class: 'সোর্সে ক্লাস নেই', no_subject: 'বিষয় দিন', bad_type: 'ধরন বাছুন', body_too_long: 'প্রশ্ন খুব বড়', mcq_options: 'অন্তত দুটি অপশন দিন',
  chapter_class_mismatch: 'অধ্যায়টি অন্য ক্লাসের', not_found: 'পাওয়া যায়নি', bank_conflict: 'প্রশ্নটি ব্যাংকে আগে থেকেই আছে' };
// rpc answer { approved, skipped: [{id, reason}] } -> a line for the teacher
export function approveResult(r) {
  const n = Number(r?.approved || 0), sk = Array.isArray(r?.skipped) ? r.skipped : [];
  const why = [...new Set(sk.map(s => REASON[s.reason] || 'হয়নি'))];
  return { n, skipped: sk.length, text: `${bn(n)}টা ব্যাংকে গেছে${sk.length ? `, ${bn(sk.length)}টা যায়নি (${why.join('; ')})` : ''}` };
}
// source rows + their pending counts -> cards with pending first
export function sourceCards(sources, pending = {}) {
  return sources.map(s => ({ ...s, pending: pending[s.id] || 0 })).sort((a, b) => (b.pending > 0) - (a.pending > 0) || (b.created_at || '').localeCompare(a.created_at || ''));
}
// An edit sheet writes back only what changed, and only for an mcq keeps the answer inside the options.
export function editPatch(it, { body, options, answer }) {
  const patch = {}, b = String(body ?? '').trim();
  if (!b || b.length > 4000) return { ok: false, error: 'প্রশ্ন লিখুন (৪০০০ অক্ষরের মধ্যে)' };
  if (b !== it.body) patch.body = b;
  if (it.qtype === 'mcq') {
    const opts = (options || []).map(o => String(o).trim()).filter(Boolean);
    if (opts.length < 2) return { ok: false, error: 'অন্তত দুটি অপশন দিন' };
    if (!opts.includes(String(answer ?? ''))) return { ok: false, error: 'সঠিক উত্তর বেছে নিন' };
    if (JSON.stringify(opts) !== JSON.stringify((it.options || []).map(String))) patch.options = opts;
    if (String(answer) !== String(it.answer ?? '')) patch.answer = String(answer);
  } else if (answer != null && String(answer) !== String(it.answer ?? '')) patch.answer = String(answer);
  return { ok: true, patch };
}

// ---- question bank ----
// Counts per class > subject for the bank page.
export function bankTree(rows) {
  const by = new Map();
  for (const r of rows) {
    const k = `${r.class_level}|${r.subject}`;
    const e = by.get(k) || { class_level: r.class_level, subject: r.subject, n: 0, mcq: 0, short: 0, creative: 0 };
    e.n++; if (e[r.qtype] != null) e[r.qtype]++;
    by.set(k, e);
  }
  return [...by.values()].sort((a, b) => a.class_level - b.class_level || a.subject.localeCompare(b.subject, 'bn'));
}
export function bankFilter(rows, { qtype = null, chapter = null, q = '' } = {}) {
  const t = norm(q).toLowerCase();
  return rows.filter(r => (!qtype || r.qtype === qtype) && (!chapter || (r.chapter_name || '') === chapter) && (!t || norm(r.body).toLowerCase().includes(t)));
}
export const chaptersOf = rows => [...new Set(rows.map(r => r.chapter_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'bn'));

// ---- report cards (teacher side: status only; scores are computed on the server) ----
// The week the report covers: Saturday to Friday (the plan's "শনি–শুক্র"). iso = 'YYYY-MM-DD' of any day -> { from, to } of the week that CONTAINS it.
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const dowOf = iso => new Date(iso + 'T00:00:00Z').getUTCDay();   // 0 = Sunday ... 6 = Saturday
export function reportWeek(iso) { const back = (dowOf(iso) + 1) % 7; const from = addDays(iso, -back); return { from, to: addDays(from, 6) }; }
export const prevWeek = w => ({ from: addDays(w.from, -7), to: addDays(w.to, -7) });
export const shiftWeek = (w, n) => ({ from: addDays(w.from, 7 * n), to: addDays(w.to, 7 * n) });
// One class's readiness for its card (the server's rule in 68-auto-report-cards.sql): every student has a mark for every exam of the week, and every student who
// was present in some period has a rating. marks: { examId: students with a mark }. ratingsLeft: present students with no rating yet. anyRated: some rating exists.
// -> { state: 'published' | 'ready' | 'waiting' | 'empty', missing: [{ id, title, left }], ratingsLeft }
export function classReadiness({ exams = [], marks = {}, size = 0, ratingsLeft = 0, anyRated = false, published = 0 }) {
  if (published > 0) return { state: 'published', missing: [], ratingsLeft: 0 };
  const missing = exams.map(e => ({ id: e.id, title: e.title, left: Math.max(0, size - (marks[e.id] || 0)) })).filter(m => m.left > 0);
  if (!exams.length && !anyRated) return { state: 'empty', missing, ratingsLeft };
  return { state: !missing.length && !ratingsLeft ? 'ready' : 'waiting', missing, ratingsLeft };
}
export const READY_WORD = { published: 'প্রকাশ হয়েছে', ready: 'সব তথ্য আছে, শনিবার সকালে নিজে প্রকাশ হবে', waiting: 'তথ্য বাকি, কার্ড আটকে আছে', empty: 'এই সপ্তাহে পরীক্ষা বা রেটিং নেই' };

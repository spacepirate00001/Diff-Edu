// Fake tables for the teacher's exam work (step 5; fake mode only): exams, subjects, marks, sources, source_jobs, source_items, chapters, question_bank, report_cards,
// rpc approve_source_items / reject_source_items, the storage upload and the extract-source worker. Shapes follow the live tables (see features/exams/data.js).
// URL switches: &exams=empty (no exams, no sources, empty bank). State lives in mem (per page load).
import { dhakaDay } from '../bn.js';
import { ROSTER } from './teacher-data.js';

const ok = (data, status = 200) => ({ status, data });
const eqv = (q, k) => { const v = q.get(k); return v && v.startsWith('eq.') ? v.slice(3) : null; };
const inv = (q, k) => { const v = q.get(k); return v && v.startsWith('in.(') ? v.slice(4, -1).split(',') : null; };
const SUBJ = [['sb6m', 6, 'Math', 'গণিত'], ['sb6e', 6, 'English', 'ইংরেজি'], ['sb7m', 7, 'Math', 'গণিত'], ['sb8b', 8, 'Bangla', 'বাংলা']].map(([id, class_level, name, name_bn]) => ({ id, class_level, name, name_bn }));
const subjOf = id => SUBJ.find(s => s.id === id) || null;
const MCQ = (i, body, options, answer, extra = {}) => ({ id: 'it' + i, qtype: 'mcq', body, options, answer, marks: 1, needs_figure: false, has_table: false, review_note: null, chapter_hint: null, topic_suggestion: null, source_ref: 'পৃষ্ঠা ' + (40 + i), difficulty: 'medium', chapter_id: null, item_idx: i, ...extra });

export function createExamData({ p, now, mem }) {
  const day = n => dhakaDay(now() + n * 86400e3);
  const none = p('exams') === 'empty';
  const ex = mem.ex = {
    exams: none ? [] : [
      { id: 'e1', title: 'ইউনিট টেস্ট', class_level: 6, exam_date: day(0), full_marks: 50, subject_id: 'sb6m', created_at: new Date(now() - 3e6).toISOString() },
      { id: 'e2', title: 'মাসিক পরীক্ষা', class_level: 6, exam_date: day(-2), full_marks: 100, subject_id: 'sb6e', created_at: new Date(now() - 2e8).toISOString() },
      { id: 'e3', title: 'মডেল টেস্ট ১', class_level: 7, exam_date: day(-9), full_marks: 100, subject_id: 'sb7m', created_at: new Date(now() - 8e8).toISOString() }],
    marks: none ? [] : [...ROSTER.filter(s => s.class_level === 6).map((s, i) => ({ exam_id: 'e2', student_id: s.id, obtained: 60 + i * 3 })), ...ROSTER.filter(s => s.class_level === 6).slice(0, 3).map((s, i) => ({ exam_id: 'e1', student_id: s.id, obtained: 30 + i }))],
    sources: none ? [] : [
      { id: 'src1', title: 'ষষ্ঠ শ্রেণি গণিত, অধ্যায় ৩', kind: 'pdf', class_level: 6, subject_id: 'sb6m', status: 'done', parts_total: 2, created_at: new Date(now() - 5e6).toISOString() },
      { id: 'src2', title: 'ইংরেজি গ্রামার ছবি', kind: 'image', class_level: 6, subject_id: 'sb6e', status: 'partial', parts_total: 3, created_at: new Date(now() - 9e7).toISOString() }],
    jobs: none ? [] : [{ source_id: 'src2', status: 'failed' }, { source_id: 'src2', status: 'done' }, { source_id: 'src1', status: 'done' }],
    items: none ? [] : [
      MCQ(1, '৪৫ ÷ ৫ = কত?', ['৭', '৮', '৯', '১০'], '৯'), MCQ(2, 'কোনটি মৌলিক সংখ্যা?', ['৯', '১৫', '১৭', '২১'], '১৭'),
      MCQ(3, 'একটি ত্রিভুজের তিন কোণের সমষ্টি কত?', ['৯০°', '১৮০°', '২৭০°', '৩৬০°'], '', { review_note: 'AI-র পড়া উত্তর: ১৮০° — গোল চিহ্ন থেকে পড়া' }),
      MCQ(4, 'চিত্রে ABC ত্রিভুজের ক্ষেত্রফল কত?', ['১০', '১২', '১৫', '২০'], '১২', { needs_figure: true }),
      { ...MCQ(5, 'ভগ্নাংশ (3/4) + (1/4) এর মান লিখো।', [], '১'), qtype: 'short', options: null },
      { ...MCQ(6, '(x+2)/2 = 5 হলে x এর মান নির্ণয় করো।', [], '৮'), qtype: 'math', options: null },
      { ...MCQ(7, 'রহিমের কাছে ১২০ টাকা আছে। সে ৩টি কলম ও ২টি খাতা কিনল। (ক) মোট খরচ কত? (খ) কত টাকা বাকি?', [], ''), qtype: 'creative', options: null, marks: 10 },
      MCQ(8, 'সবচেয়ে ছোট জোড় সংখ্যা কোনটি?', ['০', '১', '২', '৪'], '২')].map(i => ({ ...i, source_id: 'src1', status: 'pending' })),
    bank: none ? [] : [
      { id: 'q1', class_level: 6, subject: 'গণিত', chapter_name: 'অধ্যায় ২: গসাগু', qtype: 'mcq', difficulty: 'easy', body: '১২ ও ১৮ এর গসাগু কত?', options: ['২', '৩', '৬', '৯'], answer: '৬', created_at: day(-3) },
      { id: 'q2', class_level: 6, subject: 'গণিত', chapter_name: 'অধ্যায় ২: গসাগু', qtype: 'short', difficulty: 'medium', body: 'লসাগু ও গসাগুর সম্পর্ক লিখো।', options: [], answer: '', created_at: day(-3) },
      { id: 'q3', class_level: 6, subject: 'ইংরেজি', chapter_name: '', qtype: 'mcq', difficulty: 'easy', body: 'She ___ to school every day.', options: ['go', 'goes', 'going', 'gone'], answer: 'goes', created_at: day(-5) },
      { id: 'q4', class_level: 7, subject: 'গণিত', chapter_name: 'অধ্যায় ১', qtype: 'creative', difficulty: 'hard', body: 'একটি দোকানে ...', options: [], answer: '', created_at: day(-6) }],
    approved: [], rejected: [], uploads: [],
  };
  const withSubj = r => ({ ...r, subject: r.subject_id ? subjOf(r.subject_id) : null });
  const pick = (list, q, ...keys) => list.filter(r => keys.every(k => { const e = eqv(q, k), i = inv(q, k); return (!e || String(r[k]) === e) && (!i || i.includes(String(r[k]))); }));
  return {
    table(t, q, method, body, path) {
      switch (t) {
        case 'subjects': return ok(pick(SUBJ, q, 'class_level'));
        case 'exams':
          if (method === 'POST') { if (ex.exams.some(e => e.id === body.id)) return ok({ message: 'duplicate key' }, 409); ex.exams.unshift({ ...body, created_at: new Date(now()).toISOString() }); return ok(null, 201); }
          return ok(pick(ex.exams, q, 'id', 'class_level').filter(e => (!q.get('exam_date') || true)).map(withSubj).filter(e => { const g = q.getAll('exam_date'); return g.every(x => x.startsWith('gte.') ? (e.exam_date >= x.slice(4)) : x.startsWith('lte.') ? (e.exam_date <= x.slice(4)) : true); }));
        case 'marks':
          if (method === 'POST') { for (const r of [].concat(body)) { const i = ex.marks.findIndex(m => m.exam_id === r.exam_id && m.student_id === r.student_id); if (i >= 0) ex.marks[i] = { ...ex.marks[i], ...r }; else ex.marks.push({ ...r }); } return ok(null, 201); }
          return ok(pick(ex.marks, q, 'exam_id'));
        case 'students': { const lv = eqv(q, 'class_level'), lvs = inv(q, 'class_level'); if (!lv && !lvs) return null; return ok(ROSTER.filter(s => (!lv || String(s.class_level) === lv) && (!lvs || lvs.includes(String(s.class_level)))).map(s => ({ id: s.id, class_level: s.class_level, roll: s.roll, active: true, profile: s.profile })).sort((a, b) => a.roll - b.roll)); }
        case 'sources':
          if (method === 'POST') { ex.sources.unshift({ ...body, created_at: new Date(now()).toISOString() }); return ok(null, 201); }
          if (method === 'PATCH') { const s = ex.sources.find(x => x.id === eqv(q, 'id')); if (s) Object.assign(s, body); return ok(null, 204); }
          return ok(pick(ex.sources, q, 'id').map(withSubj));
        case 'source_jobs':
          if (method === 'POST') { ex.jobs.push({ ...body }); return ok(null, 201); }
          if (method === 'PATCH') { for (const j of ex.jobs) if (j.source_id === eqv(q, 'source_id') && j.status === 'failed') j.status = 'queued'; return ok(null, 204); }
          return ok(pick(ex.jobs, q, 'source_id'));
        case 'source_items':
          if (method === 'PATCH') { const it = ex.items.find(x => x.id === eqv(q, 'id') && x.status === 'pending'); if (!it) return ok([]); Object.assign(it, body); return ok([{ id: it.id }]); }
          return ok([...ex.items, ...ex.approved].filter(i => !q.get('status') || i.status === eqv(q, 'status') || !eqv(q, 'status')).filter(i => !eqv(q, 'source_id') || i.source_id === eqv(q, 'source_id')).filter(i => !inv(q, 'source_id') || inv(q, 'source_id').includes(i.source_id)));
        case 'chapters': return ok(none ? [] : [{ id: 'ch1', subject: 'গণিত', number: 2, title: 'গসাগু ও লসাগু', class_level: 6 }, { id: 'ch2', subject: 'গণিত', number: 3, title: 'ভগ্নাংশ', class_level: 6 }, { id: 'ch3', subject: 'ইংরেজি', number: 1, title: 'Tenses', class_level: 6 }]);
        case 'question_bank':
          if (method === 'DELETE') { ex.bank = ex.bank.filter(b => b.id !== eqv(q, 'id')); return ok(null, 204); }
          return ok(pick(ex.bank, q, 'class_level'));
        case 'report_cards': return ok(p('cards') === 'published' ? ROSTER.filter(s => s.class_level === 6).map(s => ({ class_level: 6, status: 'published', student_id: s.id })) : []);
        case 'class_ratings': return null;
        default: return null;
      }
    },
    rpc(name, body) {
      if (name === 'approve_source_items') {
        const ids = body.p_ids || [], skipped = [];
        let n = 0;
        for (const id of ids) {
          const it = ex.items.find(x => x.id === id && x.status === 'pending');
          if (!it) { skipped.push({ id, reason: 'not_pending' }); continue; }
          if (!(body.p_subject || subjOf('sb6m'))) { skipped.push({ id, reason: 'no_subject' }); continue; }
          if (it.qtype === 'math' || it.qtype === 'other') { skipped.push({ id, reason: 'bad_type' }); continue; }
          it.status = 'approved'; ex.bank.unshift({ id: 'bq-' + id, class_level: 6, subject: body.p_subject || 'গণিত', chapter_name: '', qtype: it.qtype, difficulty: it.difficulty, body: it.body, options: it.options || [], answer: it.answer || '', created_at: new Date(now()).toISOString() }); n++;
        }
        ex.items = ex.items.filter(i => i.status === 'pending'); mem.approvedCalls = (mem.approvedCalls || []).concat([body]);
        return ok({ approved: n, skipped });
      }
      if (name === 'reject_source_items') { const before = ex.items.length; ex.items = ex.items.filter(i => !(body.p_ids || []).includes(i.id)); return ok(before - ex.items.length); }
      return null;
    },
    upload(path) { ex.uploads.push(path); return ok({ Key: path }); },
    worker() { const left = ex.sources.find(s => ['queued', 'processing'].includes(s.status)); if (!left) return ok({ state: 'idle', due_jobs: 0, waiting_jobs: 0 }); left.status = 'done'; return ok({ state: 'processed', status: 'done', items: 6, due_jobs: 0, waiting_jobs: 0 }); },
  };
}

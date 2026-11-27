// What the study pages read: the live tables the old app's family.js / reports.js read (RLS lets a guardian see only their own children). -> { kind, data }
import { sel, rpc, rows, request } from '../../core/api.js';
import { CFG } from '../../core/config.js';
import { dhakaDay } from '../../core/bn.js';

const wrap = (res, map) => ({ kind: res.kind, data: res.kind === 'ok' ? (map ? map(rows(res)) : rows(res)) : undefined });
const both = async (a, b, map) => { const [x, y] = await Promise.all([a, b]); const bad = [x, y].find(r => r.kind !== 'ok'); return bad ? { kind: bad.kind } : { kind: 'ok', data: map(rows(x), rows(y)) }; };
export const REPORT_COLS = 'id,student_id,kind,title,period_from,period_to,class_level,rank,class_size,award,data,status,published_at,seen_at';

export const loadAttendance = id => sel('attendance', `select=date,check_in,check_out,source&student_id=eq.${id}&order=date.desc&limit=60`).then(r => wrap(r));
export const loadMarks = id => sel('marks', `select=obtained,exam:exams(id,title,exam_date,full_marks,subject:subjects(name))&student_id=eq.${id}`)
  .then(r => wrap(r, l => l.filter(m => m.exam && m.obtained != null).sort((a, b) => (b.exam.exam_date || '').localeCompare(a.exam.exam_date || ''))));
export const loadReports = id => sel('report_cards', `select=${REPORT_COLS}&student_id=eq.${id}&status=eq.published&order=period_to.desc&limit=40`).then(r => wrap(r));
export const markSeen = id => rpc('mark_report_seen', { p_id: id });
export const loadHomework = kid => both(
  sel('homework', `select=id,title,due_date,subject:subjects(name)&class_level=eq.${kid.class_level}&order=due_date.asc`),
  sel('homework_done', `select=homework_id&student_id=eq.${kid.id}`), (hw, done) => { const d = new Set(done.map(x => x.homework_id)); return hw.map(x => ({ ...x, done: d.has(x.id) })); });
const SHIFT = { morning: 'সকাল', afternoon: 'বিকেল', night: 'রাত' };
export const shiftBn = s => SHIFT[s] || s || '';
export const loadRoutine = kid => both(
  sel('students', `select=id,batch:batches(shift)&id=eq.${kid.id}`),
  sel('class_periods', 'select=shift,slot,class_level,teacher:teacher_id(full_name)&order=shift,slot,class_level'),
  (st, ps) => { const shift = st[0]?.batch?.shift || null; return { shift, periods: ps.filter(p => (!shift || p.shift === shift) && (p.class_level == null || p.class_level === kid.class_level)) }; });
export const loadMaterials = kid => sel('materials', `select=id,chapter,title,kind,url,storage_path,subject:subjects(name)&class_level=eq.${kid.class_level}&order=created_at.desc`).then(r => wrap(r));
export const loadRevision = kid => both(
  sel('exams', `select=id,title,exam_date,class_level,chapter_ids,subject:subjects(name)&exam_date=gte.${dhakaDay()}&class_level=eq.${kid.class_level}&order=exam_date`),
  sel('chapters', `select=id,class_level,subject,number,title,pages,status,done_on&class_level=eq.${kid.class_level}&order=subject,number`), (exams, chapters) => ({ exams, chapters }));
export const loadRatings = id => both(
  sel('class_ratings', `select=day,behavior,homework,performance,comment&student_id=eq.${id}&order=day.desc&limit=30`),
  sel('praise_cards', `select=id,badge,note,created_at,giver:given_by(full_name)&student_id=eq.${id}&order=created_at.desc&limit=50`), (ratings, praise) => ({ ratings, praise }));
export const loadGoals = id => sel('student_goals', `select=id,subject,target_percent,achieved_at&student_id=eq.${id}&order=created_at`).then(r => wrap(r));
// the same two reads feed the "আজ" cards when the server sends no preview
export const loadPreviewInputs = id => both(sel('attendance', `select=date,check_in&student_id=eq.${id}&order=date.desc&limit=30`), sel('class_ratings', `select=day,behavior,homework,performance&student_id=eq.${id}&order=day.desc&limit=14`), (att, ratings) => ({ att, ratings }));
// A file in the private "materials" bucket: a short-lived signed link. -> url | null
export async function signedUrl(path) {
  const r = await request('POST', `/storage/v1/object/sign/materials/${path}`, { expiresIn: 600 });
  const s = r.kind === 'ok' && (r.data?.signedURL || r.data?.signedUrl);
  return s ? CFG.url + '/storage/v1' + (s.startsWith('/') ? s : '/' + s) : null;
}
export const safeUrl = u => { u = String(u ?? '').trim(); return /^https?:\/\//i.test(u) ? u : ''; };

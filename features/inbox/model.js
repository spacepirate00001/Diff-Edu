// Inbox logic without the screen: merge the sources, order them, filter by chip, group by day, and decide what is "new".
// "New" for notices and messages is phone-based (no read column on the server): newer than the last time this phone opened the inbox.
// Daily notes and staff notes carry read_at on the server, so their "new" comes from there (spec P14).
import { dhakaDay, bn } from '../../core/bn.js';

export const CHIPS = {
  guardian: [['all', 'সব'], ['notice', 'নোটিশ'], ['child', 'আমার সন্তান'], ['teacher', 'শিক্ষক']],
  teacher: [['all', 'সব'], ['notice', 'নোটিশ'], ['parent', 'অভিভাবক'], ['staff', 'স্টাফ নোট']],
  admin: [['all', 'সব'], ['todo', 'করণীয়'], ['notice', 'নোটিশ'], ['message', 'বার্তা']],
  student: [['all', 'সব'], ['notice', 'নোটিশ']],
};
export const EMPTY_TEXT = { all: 'এখনো কোনো খবর নেই।', notice: 'কোনো নোটিশ নেই। আজ সবাই শান্ত।', child: 'সন্তানের কোনো খবর নেই।', teacher: 'শিক্ষকের কোনো বার্তা নেই।', parent: 'অভিভাবকের কোনো বার্তা নেই।', staff: 'কোনো স্টাফ নোট নেই।', todo: 'আজ করণীয় কিছু নেই।', message: 'কোনো বার্তা নেই।' };
export const KIND_LABEL = { notice: 'নোটিশ', message: 'বার্তা', daily: 'দৈনিক বার্তা', director: 'পরিচালকের বার্তা', staff: 'স্টাফ নোট', todo: 'করণীয়' };
const AUDIENCE_OF = { guardian: 'guardians', student: 'students', teacher: 'teachers' };
// A notice for "all" goes to everybody; one for a group goes to that group. The admin sees every notice.
export const audienceOk = (audience, role) => role === 'admin' || !audience || audience === 'all' || audience === AUDIENCE_OF[role];

const ms = v => (typeof v === 'number' ? v : Date.parse(v));
// Each argument is an array of raw server rows (or undefined when that source failed or is not for this role).
export function buildRows({ role, notices = [], messages = [], staff = [], daily = [], director = [], staffNotes = [], todo = [], kids = [], now = Date.now() }) {
  const classes = new Set(kids.map(k => k.class_level));
  const kidName = Object.fromEntries(kids.map(k => [k.id, k.name]));
  const staffById = Object.fromEntries(staff.map(s => [s.id, s]));
  const rows = [];
  for (const n of notices) {
    if (!audienceOk(n.audience, role)) continue;
    const tags = ['notice'];
    if (role === 'guardian' && n.class_level != null && classes.has(n.class_level)) tags.push('child');
    rows.push({ id: 'n:' + n.id, raw: n.id, source: 'notice', tags, title: n.title, body: n.body || '', at: ms(n.created_at), who: n.class_level != null ? `শ্রেণি ${bn(n.class_level)}` : '', read: null });
  }
  for (const m of messages) {
    const s = staffById[m.sender_id];
    const fromStaff = s && (s.role === 'teacher' || s.role === 'admin');
    rows.push({ id: 'm:' + m.id, raw: m.id, source: 'message', tags: ['message', fromStaff ? 'teacher' : 'parent'], title: m.body, body: m.body, at: ms(m.created_at),
      who: [fromStaff ? (s.full_name || 'শিক্ষক') : 'অভিভাবক', kidName[m.thread_student_id]].filter(Boolean).join(' · '), childId: m.thread_student_id, read: null });
  }
  for (const d of daily) rows.push({ id: 'g:' + d.id, raw: d.id, source: 'daily', tags: ['child'], title: d.title, body: d.body, at: ms(d.updated_at), who: kidName[d.student_id] || '', childId: d.student_id, read: !!d.read_at });
  for (const d of director) rows.push({ id: 'd:' + d.id, raw: d.id, source: 'director', tags: ['notice'], title: d.title, body: d.body, at: Date.parse(d.published_on + 'T00:00:00+06:00'), who: 'পরিচালক', read: null, video: d.video_url || null });
  for (const s of staffNotes) rows.push({ id: 's:' + s.id, raw: s.id, source: 'staff', tags: ['staff'], title: s.title, body: s.body, at: ms(s.created_at), who: '', read: !!s.read_at });
  for (const t of todo) rows.push({ id: 't:' + t.key, raw: t.key, source: 'todo', tags: ['todo'], title: t.title, body: '', at: now, who: String(t.count), read: false });
  return rows.filter(r => Number.isFinite(r.at)).sort((a, b) => b.at - a.at || (a.id < b.id ? -1 : 1));
}
export const filterRows = (rows, chip) => (chip === 'all' || !chip ? rows : rows.filter(r => r.tags.includes(chip)));
// seenAt: ms of the last time this phone opened the inbox (null = never: nothing counts as new yet).
export const isNew = (row, seenAt) => (row.read !== null ? row.read === false : seenAt != null && row.at > seenAt);
export const unreadCount = (rows, seenAt) => rows.filter(r => isNew(r, seenAt)).length;
// Today / this week / earlier, by Dhaka calendar day.
export function groupByDay(rows, now = Date.now()) {
  const today = dhakaDay(now), week = dhakaDay(now - 6 * 864e5);
  const day = r => dhakaDay(r.at);
  return [['আজ', rows.filter(r => day(r) >= today)], ['এই সপ্তাহ', rows.filter(r => day(r) >= week && day(r) < today)], ['আগের', rows.filter(r => day(r) < week)]].filter(g => g[1].length);
}
// The first time a phone opens the inbox there is no earlier visit: start from now so old notices are not all "new".
export const firstSeen = (stored, now = Date.now()) => (stored == null ? now : stored);

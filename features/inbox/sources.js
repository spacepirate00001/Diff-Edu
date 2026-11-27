// One fetch per source, each on its own, so one failing source never hides the others (spec P14).
import { sel, rpc, rows } from '../../core/api.js';

const PAGE = 30;
const q = (cols, order, limit, extra = '') => `select=${cols}&${extra}order=${order}&limit=${limit}`;
// role -> [source name, fetcher(limit)]
export const SOURCES = {
  notice: n => sel('notices', q('id,title,body,audience,class_level,created_at', 'created_at.desc', n, 'archived_at=is.null&')),
  message: n => sel('messages', q('id,body,created_at,sender_id,thread_student_id', 'created_at.desc', n)),
  daily: n => sel('guardian_notes', q('id,student_id,day,title,body,read_at,updated_at', 'updated_at.desc', n)),
  director: n => sel('director_messages', q('id,title,body,video_url,published_on', 'published_on.desc', n)),
  staffNotes: n => sel('staff_notes', q('id,day,title,body,read_at,created_at', 'created_at.desc', n)),
  todo: async () => {
    const r = await rpc('today_admin');
    if (r.kind !== 'ok') return r;
    const d = r.data || {};
    const L = [['needs_review', 'অনুমোদনের অপেক্ষায়'], ['early_leave_open', 'আগে ছুটির খবর খোলা'], ['fee_call', 'ফি তাগাদা তালিকা'], ['chat_reports_open', 'চ্যাট রিপোর্ট'], ['report_drafts', 'রিপোর্ট কার্ড খসড়া']];
    return { ...r, data: L.filter(([k]) => d[k] > 0).map(([k, title]) => ({ key: k, title, count: d[k] })) };
  },
};
export const FOR_ROLE = {
  guardian: ['notice', 'message', 'daily', 'director'],
  student: ['notice'],
  teacher: ['notice', 'message', 'staffNotes'],
  admin: ['notice', 'message', 'staffNotes', 'todo'],
};
// -> { data: { notices, messages, ... staff }, failed: [source], more: bool }
export async function loadSources(role, pages = 1) {
  const limit = PAGE * pages;
  const names = FOR_ROLE[role] || ['notice'];
  const out = await Promise.all(names.map(async n => [n, await SOURCES[n](limit)]));
  const data = {}, failed = []; let more = false;
  for (const [n, res] of out) {
    if (res.kind !== 'ok') { failed.push(n); continue; }
    const list = rows(res); data[n] = list;
    if (n !== 'todo' && list.length >= limit) more = true;
  }
  // names of the people who sent the messages
  const ids = [...new Set((data.message || []).map(m => m.sender_id))];
  if (ids.length) { const s = await sel('staff_public', `select=id,full_name,role&id=in.(${ids.join(',')})`); data.staff = rows(s); }
  const offline = failed.length === names.length && out.every(([, r]) => r.kind === 'offline');
  return { data, failed, more, offline, allFailed: failed.length === names.length };
}
export const SOURCE_FOR_ROW = { notice: 'notice', message: 'message', daily: 'daily', director: 'director', staff: 'staffNotes', todo: 'todo' };

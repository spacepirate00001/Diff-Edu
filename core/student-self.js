// The signed-in student's own record: id, class, first name, stars, streak, owned shop items. One read (+ one for rewards), kept on the phone.
// The record is also set as the account's only "child" (core/children.js), so the study pages reused from the guardian side show the student's own data.
import { sel, rows } from './api.js';
import { cache } from './cache.js';
import { session } from './session.js';
import { kids } from './children.js';

let rec = null;
export const self = {
  get: () => rec,
  reset() { rec = null; },
  patch(p) { if (rec) { rec = { ...rec, ...p }; cache.set(session.uid(), 'self', rec); } },
  // -> { kind: 'ok' | 'offline' | 'missing' | ..., data, stale }. A student with no linked record (office has not linked the account) gets kind 'missing'.
  async load() {
    const uid = session.uid();
    const st = await sel('students', `select=id,class_level,roll,batch:batches(shift),profile:profiles!students_profile_id_fkey(full_name)&active=is.true&profile_id=eq.${uid}&limit=1`);
    if (st.kind === 'ok') {
      const s = rows(st)[0];
      if (!s) { rec = null; kids.setSelf(null); return { kind: 'missing' }; }
      const rr = await sel('student_rewards', `select=stars,streak_days,owned,avatar,theme&student_id=eq.${s.id}`);
      const w = (rr.kind === 'ok' && rows(rr)[0]) || {};
      rec = { id: s.id, name: String(s.profile?.full_name || 'শিক্ষার্থী').trim(), class_level: s.class_level, roll: s.roll, shift: s.batch?.shift || null,
        stars: w.stars || 0, streak_days: w.streak_days || 0, owned: w.owned || [], avatar: w.avatar || null, theme: w.theme || null };
      cache.set(uid, 'self', rec); kids.setSelf(rec);
      return { kind: 'ok', data: rec };
    }
    const old = cache.get(uid, 'self');
    if (old) { rec = old.v; kids.setSelf(rec); return { kind: st.kind, data: rec, stale: true }; }
    return { kind: st.kind };
  },
};
export const firstName = full => String(full || '').trim().split(/\s+/)[0] || '';

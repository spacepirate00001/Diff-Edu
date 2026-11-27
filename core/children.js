// A guardian's children and which one is chosen (spec P8). The choice is the student's id (not a position), the same on every tab.
// Source: rpc today_guardian (children[]), or the old path guardian_students -> students if that function is not on the server.
import { rpc, sel, rows } from './api.js';
import { cache } from './cache.js';
import { session } from './session.js';
import { store } from './store.js';

let list = [], today = null, staleAt = null, chosen = null, at = 0;
const subs = new Set();
const key = () => 'de.next.kid.' + session.uid();
export const kids = {
  list: () => list,
  today: () => today,
  staleAt: () => staleAt,
  on: f => { subs.add(f); return () => subs.delete(f); },
  current() { return list.find(k => k.id === chosen) || list[0] || null; },
  set(id) { if (!list.some(k => k.id === id) || id === chosen) return; chosen = id; store.set(key(), id); subs.forEach(f => f(id)); },
  reset() { list = []; today = null; staleAt = null; chosen = null; },
  // A student's own record is the one "child" of the account, so the study pages built for a guardian's child show the student's own data (core/student-self.js).
  setSelf(rec) { list = rec ? [{ id: rec.id, name: rec.name, class_level: rec.class_level, shift: rec.shift || null }] : []; chosen = list[0]?.id ?? null; at = Date.now(); subs.forEach(f => f(chosen)); },
  // -> { kind: 'ok'|'offline'|'error'|..., stale }
  async load({ maxAge = 0 } = {}) {
    if (maxAge && !staleAt && list.length && Date.now() - at < maxAge) return { kind: 'ok', stale: false };   // just loaded: reuse
    const uid = session.uid();
    chosen = store.get(key());
    let res = await rpc('today_guardian');
    if (res.kind === 'ok' && res.data && Array.isArray(res.data.children)) {
      today = res.data; staleAt = null; cache.set(uid, 'today', today);
      list = today.children.map(c => ({ id: c.student_id, name: c.name, class_level: c.class_level, shift: c.shift || null }));
      return finish('ok');
    }
    if (res.kind === 'missing') {       // the server has no today_guardian yet: the older two-step read
      const links = await sel('guardian_students', 'select=student_id');
      const ids = rows(links).map(r => r.student_id);
      const st = ids.length ? await sel('students', `select=id,class_level,profile:profiles!students_profile_id_fkey(full_name)&active=is.true&id=in.(${ids.join(',')})`) : { kind: 'ok', data: [] };
      if (links.kind === 'ok' && st.kind === 'ok') {
        today = null; staleAt = null;
        list = rows(st).map(s => ({ id: s.id, name: s.profile?.full_name || 'শিক্ষার্থী', class_level: s.class_level, shift: null }));
        return finish('ok');
      }
      res = links.kind === 'ok' ? st : links;
    }
    const old = cache.get(uid, 'today');   // offline or server trouble: the last copy
    if (old) { today = old.v; staleAt = old.at; list = today.children.map(c => ({ id: c.student_id, name: c.name, class_level: c.class_level, shift: c.shift || null })); return finish(res.kind, true); }
    list = []; today = null;
    return { kind: res.kind, stale: false };
    function finish(kind, stale = false) { at = Date.now(); if (!list.some(k => k.id === chosen)) chosen = list[0]?.id ?? null; subs.forEach(f => f(chosen)); return { kind, stale }; }
  },
};

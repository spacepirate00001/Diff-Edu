// Inbox state shared by the inbox page and the badges (bell, tab). Remembers the last copy per user, and the last visit on this phone.
import { cache } from '../../core/cache.js';
import { session } from '../../core/session.js';
import { store } from '../../core/store.js';
import { KEYS } from '../../core/config.js';
import { kids } from '../../core/children.js';
import { loadSources } from './sources.js';
import { buildRows, unreadCount, firstSeen } from './model.js';

const subs = new Set();
const emit = () => subs.forEach(f => f());
const seenKey = () => KEYS.seen + session.uid();
let st = { rows: [], failed: [], more: false, status: 'idle', pages: 1, staleAt: null, loading: false };
export const inbox = {
  get: () => st,
  on: f => { subs.add(f); return () => subs.delete(f); },
  reset() { st = { rows: [], failed: [], more: false, status: 'idle', pages: 1, staleAt: null, loading: false }; emit(); },
  seenAt() { const v = store.get(seenKey()); return firstSeen(v == null ? null : Number(v)); },
  unread() { return unreadCount(st.rows, inbox.seenAt()); },
  // The page was opened: the earlier visit time is kept for this visit's "new" marks, and now becomes the new last-visit time.
  visit() { const before = inbox.seenAt(); store.set(seenKey(), String(Date.now())); emit(); return before; },
  // Read a server-read note locally (after rpc mark_*_read succeeded).
  markRead(rowId) { const r = st.rows.find(x => x.id === rowId); if (r && r.read === false) { r.read = true; emit(); } },
  async load({ more = false } = {}) {
    const role = session.me()?.role, uid = session.uid();
    if (!role) return st;
    if (more) st.pages += 1;
    if (st.status === 'idle') { const c = cache.get(uid, 'inbox'); if (c) st = { ...st, rows: c.v.rows, staleAt: c.at, status: 'cached' }; }
    st.loading = true; emit();
    const r = await loadSources(role, st.pages);
    st.loading = false;
    if (r.allFailed) { st.status = r.offline ? 'offline' : 'error'; emit(); return st; }
    const d = r.data;
    const todo = d.todo || [];
    st.rows = buildRows({ role, notices: d.notice, messages: d.message, staff: d.staff, daily: d.daily, director: d.director, staffNotes: d.staffNotes, todo, kids: kids.list() });
    st.failed = r.failed; st.more = r.more; st.status = r.failed.length ? 'partial' : 'ok'; st.staleAt = null;
    cache.set(uid, 'inbox', { rows: st.rows.filter(x => x.source !== 'todo') });
    if (store.get(seenKey()) == null) store.set(seenKey(), String(Date.now()));   // first ever load: nothing is "new" yet
    emit();
    return st;
  },
};

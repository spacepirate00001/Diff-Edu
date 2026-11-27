// Writes made while the net is down wait on the phone (IndexedDB) and go later, in order. Nothing is dropped silently:
// a write the server refuses stays in the list as "rejected" with the reason (spec P15).
import { KEYS } from './config.js';
import { uuid } from './bn.js';
import { writeDone, retryLater } from './errors.js';

// ---- stores: the same four methods, so tests use memory and the app uses IndexedDB ----
export function memStore() {
  const m = new Map();
  return { available: true, all: async () => [...m.values()], put: async r => { m.set(r.key, { ...r }); }, del: async k => { m.delete(k); } };
}
export function idbStore(name = KEYS.outboxDb) {
  let dbp = null;
  const open = () => (dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open(name, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('outbox', { keyPath: 'key' });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }).catch(e => { dbp = null; throw e; }));
  const tx = (mode, f) => open().then(db => new Promise((res, rej) => {
    const t = db.transaction('outbox', mode); const req = f(t.objectStore('outbox'));
    t.oncomplete = () => res(req.result); t.onerror = t.onabort = () => rej(t.error || new Error('outbox'));
  }));
  return { available: typeof indexedDB !== 'undefined', all: () => tx('readonly', s => s.getAll()), put: r => tx('readwrite', s => s.put(r)), del: k => tx('readwrite', s => s.delete(k)) };
}
// Plain reason shown for a write the server refused.
const reasonOf = res => (res.status === 403 ? 'অনুমতি নেই' : res.status === 400 || res.status === 422 ? 'তথ্য ঠিক ছিল না' : 'সার্ভার নেয়নি');

export function createOutbox({ store, send, now = Date.now }) {
  let seq = 0, flushing = null;
  const subs = new Set();
  const changed = () => subs.forEach(f => f());
  const ordered = rows => rows.slice().sort((a, b) => (a.seq - b.seq) || (a.at - b.at));
  const api = {
    on: f => { subs.add(f); return () => subs.delete(f); },
    available: () => store.available !== false,
    async list(uid) { try { return ordered((await store.all()).filter(r => !uid || r.uid === uid)); } catch { return []; } },
    // Returns the row, or null when the phone cannot keep it (then the caller says "not sent", never "kept").
    async add({ uid, method, path, body, prefer, label }) {
      if (!api.available()) return null;
      try {
        if (!seq) seq = (await store.all()).reduce((m, r) => Math.max(m, r.seq || 0), 0);
        const row = { key: uuid(), uid, method, path, body, prefer, label, at: now(), seq: ++seq, state: 'waiting' };
        await store.put(row); changed(); return row;
      } catch { return null; }
    },
    async remove(key) { try { await store.del(key); } catch { /* ignore */ } changed(); },
    async retry(key) { const r = (await store.all()).find(x => x.key === key); if (r) { await store.put({ ...r, state: 'waiting', why: undefined }); changed(); } },
    // Sends this user's waiting rows, oldest first. Stops at the first row that needs the net / a new session / patience.
    flush(uid) {
      return flushing ||= (async () => {
        const out = { sent: 0, rejected: 0, stopped: null };
        for (const row of ordered((await api.list(uid)).filter(r => r.state === 'waiting'))) {
          const res = await send(row);
          if (writeDone(res)) { await store.del(row.key); out.sent++; changed(); continue; }
          if (retryLater(res)) { out.stopped = res.status ? 'busy' : 'offline'; break; }
          await store.put({ ...row, state: 'rejected', why: reasonOf(res), status: res.status }); out.rejected++; changed();
        }
        return out;
      })().finally(() => { flushing = null; });
    },
    // One write from a screen: keep it first, then try once. -> 'saved' | 'queued' | 'failed' | 'rejected'
    async submit(item) {
      const row = await api.add(item);
      const res = await send(row || item);
      if (writeDone(res)) { if (row) await api.remove(row.key); return { state: 'saved', row }; }
      if (retryLater(res)) return row ? { state: 'queued', row } : { state: 'failed', row: null };
      if (row) { await store.put({ ...row, state: 'rejected', why: reasonOf(res), status: res.status }); changed(); }
      return { state: 'rejected', row };
    },
  };
  return api;
}

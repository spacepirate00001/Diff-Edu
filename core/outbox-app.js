// The one outbox of the running app: IndexedDB store, sends through core/api.js. Sending times: when the net returns, when the app
// opens, every 15 seconds while online, and when someone taps "এখনই পাঠান" (spec P15).
import { createOutbox, idbStore } from './outbox.js';
import { request } from './api.js';
import { session } from './session.js';
import { net } from './net.js';
import { store } from './store.js';
import { KEYS } from './config.js';
import { uuid } from './bn.js';

const idb = idbStore();
export const outbox = createOutbox({ store: idb, send: row => request(row.method, row.path, row.body, { prefer: row.prefer }) });
export const flushNow = () => (session.has() && !net.isOffline() ? outbox.flush(session.uid()) : Promise.resolve({ sent: 0, rejected: 0, stopped: 'offline' }));
let timer = null;
export function startFlushing() {
  if (timer) return;
  timer = setInterval(() => { if (!net.isOffline()) flushNow(); }, 15000);
  net.on(off => { if (!off) flushNow(); });
  flushNow();
}
// Once: rows the old experimental client kept in localStorage move into IndexedDB; the old copy goes only after all rows are stored.
export async function migrateLegacy() {
  const raw = store.get(KEYS.outboxDb);
  if (raw == null) return;
  let list = []; try { list = JSON.parse(raw); } catch { /* ignore */ }
  try {
    for (const it of Array.isArray(list) ? list : []) if (it?.path) await idb.put({ ...it, key: String(it.key || it.id || uuid()), seq: it.seq || 0, state: 'waiting', label: it.label || 'অফলাইন পেন্ডিং কাজ' });
    store.del(KEYS.outboxDb);
  } catch { /* no IndexedDB here: keep the old copy for the next start */ }
}

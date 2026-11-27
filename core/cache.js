// Last-seen copies on the phone, per user (a copy whose uid does not match is never shown), with the time they were saved.
import { KEYS } from './config.js';
import { store } from './store.js';

const k = (uid, key) => `${KEYS.cache}${uid}.${key}`;
export const cache = {
  get(uid, key) { if (!uid) return null; const c = store.json(k(uid, key)); return c && c.uid === uid ? c : null; },
  set(uid, key, v) { if (uid) store.setJson(k(uid, key), { uid, at: Date.now(), v }); },
  // Logout / refresh: forget every copy of this user (all users when uid is empty). The outbox is never touched here.
  clear(uid) { const p = uid ? `${KEYS.cache}${uid}.` : KEYS.cache; store.keys().filter(x => x.startsWith(p)).forEach(x => store.del(x)); },
};

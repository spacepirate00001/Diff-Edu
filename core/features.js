// Which features the server says are on for this role (rpc my_features -> [{key, tier}]).
// If the call fails the answer is "unknown" and everything is shown (spec P11).
import { rpc } from './api.js';
import { cache } from './cache.js';
import { session } from './session.js';

let keys = null;                       // Set of keys, or null = unknown
export const features = {
  known: () => keys !== null,
  has: key => keys === null || keys.has(key),
  keys: () => (keys === null ? null : new Set(keys)),
  set(list) { keys = Array.isArray(list) ? new Set(list.map(f => f.key)) : null; },
  reset() { keys = null; },
  async load() {
    const uid = session.uid();
    const res = await rpc('my_features');
    if (res.kind === 'ok' && Array.isArray(res.data)) { cache.set(uid, 'features', res.data); features.set(res.data); return true; }
    const old = cache.get(uid, 'features');   // offline: the last answer; unavailable (404) or error: show everything
    features.set(res.kind === 'offline' && old ? old.v : null);
    return false;
  },
};

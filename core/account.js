// Profile loading and the PIN change (steps and retries ported from the old app, spec P6).
import { sel, rpc, request } from './api.js';
import { session, exchange } from './session.js';
import { cache } from './cache.js';
import { credsFor } from './pin.js';
import { KEYS } from './config.js';
import { store } from './store.js';

export const PROFILE_COLS = 'id,full_name,role,login_id,phone,coaching_id,must_change_pin';
// -> { me, kind, stale }. A saved copy is used when the network is down.
export async function loadMe() {
  const uid = session.uid();
  const res = await sel('profiles', `select=${PROFILE_COLS}&id=eq.${uid}`);
  if (res.kind === 'ok') {
    const me = Array.isArray(res.data) ? res.data[0] : null;
    if (!me) return { me: null, kind: 'noprofile' };
    cache.set(uid, 'me', me); session.setMe(me);
    return { me, kind: 'ok' };
  }
  const old = cache.get(uid, 'me');
  if (old && (res.kind === 'offline' || res.kind === 'server')) { session.setMe(old.v); return { me: old.v, kind: res.kind, stale: true }; }
  return { me: null, kind: res.kind };
}
// Old PIN check before a voluntary change: signs in again with it (counts wrong tries on the server).
export async function checkOldPin(pin) {
  const me = session.me();
  const r = await exchange(me.login_id, pin);
  if (r.ok) session.set(r.tokens);
  return r;
}
// Step 1: new password. Step 2: clear must_change_pin (3 tries). -> { ok } | { ok:false, stage:'auth'|'flag', kind }
export async function changePin(newPin, wait = ms => new Promise(r => setTimeout(r, ms))) {
  const me = session.me();
  const { password } = credsFor(me.login_id, newPin);
  const put = await request('PUT', '/auth/v1/user', { password });
  const same = put.status === 422 && /same_password/.test(JSON.stringify(put.data || ''));   // an earlier try already saved it
  if (put.kind !== 'ok' && !same) return { ok: false, stage: 'auth', kind: put.kind };
  for (let i = 0; i < 3; i++) {
    const r = await rpc('pin_changed');
    if (r.kind === 'ok') { me.must_change_pin = false; cache.set(session.uid(), 'me', me); return { ok: true }; }
    await wait(800 * (i + 1));
  }
  return { ok: false, stage: 'flag', kind: 'server' };
}
export const rememberedId = () => store.get(KEYS.prefs + '.id') || '';
export const rememberId = id => (id ? store.set(KEYS.prefs + '.id', id) : store.del(KEYS.prefs + '.id'));

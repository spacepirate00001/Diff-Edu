// Sign-in and the saved session. Own key 'diffedu-next-auth': the old app's session is never read or written,
// because a refresh token works once and two apps sharing one would log each other out (spec P4).
import { CFG, KEYS } from './config.js';
import { http } from './http.js';
import { store } from './store.js';
import { cache } from './cache.js';
import { credsFor, loginId, validLoginId, normPin } from './pin.js';
import { kindOf } from './errors.js';

let s = store.json(KEYS.auth);       // { access, refresh, uid }
let me = null;
let refreshing = null;
const expiredSubs = new Set();
const write = () => (s ? store.setJson(KEYS.auth, s) : store.del(KEYS.auth));
const fromTokens = t => ({ access: t.access_token, refresh: t.refresh_token, uid: t.user?.id });
const anon = { apikey: CFG.key, 'Content-Type': 'application/json' };

// One try with an id and a PIN. Uses the login function (it counts wrong tries); only if the server says the
// function does not exist (404) it falls back to the plain password sign-in, like the old app.
export async function exchange(id, pin) {
  const idn = loginId(id), p = normPin(pin);
  if (!validLoginId(idn) || !/^\d{4,6}$/.test(p)) return { ok: false, kind: 'bad' };
  let r = await http('POST', '/functions/v1/login', { headers: anon, body: { slug: CFG.slug, login_id: idn, pin: p } });
  if (r.status === 404) r = await http('POST', '/auth/v1/token?grant_type=password', { headers: anon, body: credsFor(idn, p) });
  if (r.status === 200 && r.data?.access_token) return { ok: true, tokens: fromTokens(r.data) };
  const k = kindOf(r);
  if (k === 'offline') return { ok: false, kind: 'offline' };
  if (r.status === 429) return { ok: false, kind: 'rate', retryAfter: r.data?.retry_after || r.retryAfter };
  if (r.status >= 500) return { ok: false, kind: 'busy' };
  return { ok: false, kind: 'bad' };
}
export const session = {
  get: () => s,
  has: () => !!s?.refresh,
  uid: () => s?.uid || null,
  token: () => s?.access || null,
  me: () => me,
  setMe(m) { me = m; },
  set(tokens) { s = tokens; write(); },
  // Returns { ok } or { ok:false, kind, retryAfter }. The caller loads the profile next.
  async signIn(id, pin) {
    const r = await exchange(id, pin);
    if (r.ok) { s = r.tokens; write(); }
    return r;
  },
  // Refresh tokens work once. Two tabs of this app: if the other tab already refreshed, adopt its newer token.
  refresh() { return refreshing ||= doRefresh().finally(() => { refreshing = null; }); },
  onExpired(f) { expiredSubs.add(f); return () => expiredSubs.delete(f); },
  async signOut() {
    const tok = s?.access, uid = s?.uid;
    s = null; me = null; store.del(KEYS.auth); cache.clear(uid);   // the outbox stays
    if (tok) http('POST', '/auth/v1/logout', { headers: { ...anon, Authorization: 'Bearer ' + tok } });
  },
};
async function doRefresh() {
  const used = s?.refresh;
  if (!used) return false;
  const r = await http('POST', '/auth/v1/token?grant_type=refresh_token', { headers: anon, body: { refresh_token: used } });
  if (r.status === 200 && r.data?.access_token) {
    if (!s) return false;                    // signed out meanwhile: do not bring the session back
    s = { ...s, ...fromTokens(r.data) }; write(); return true;
  }
  const stored = store.json(KEYS.auth);
  if (stored?.refresh && stored.refresh !== used) { s = stored; return true; }
  if (r.status === 400 || r.status === 401) { s = null; me = null; store.del(KEYS.auth); expiredSubs.forEach(f => f()); }
  return false;
}

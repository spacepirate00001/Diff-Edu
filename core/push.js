// Web Push, client side (step 4). Behind flag `web_push` (core/flags.js, OFF). The server half is app/supabase/next/67-push-subscriptions.sql and
// app/supabase/functions/web-push-sender (a draft; nothing is deployed). Rules this file keeps:
//   * the browser's permission prompt is shown ONLY after our own Bangla explanation was confirmed (state "explaining" -> "asking");
//   * nothing is subscribed while the flag is off, the public key is not set, or the browser cannot do it;
//   * what goes to the server is the endpoint and the two public keys, one row per user and device (RLS: owner only).
// pushState / pushReduce / routeForPush are pure (tested). The rest touches the browser and runs in fake mode as a simulation.
import { flags } from './flags.js';
import { WEB_PUSH } from './config.js';
import { store } from './store.js';
import { uuid } from './bn.js';
import { request, upsert } from './api.js';
import { session } from './session.js';

// ---- pure part ----
// Where the screen stands, from what the browser and the server say.
export function pushState({ flagOn, keySet = true, supported, permission, subscribed }) {
  if (!flagOn || !keySet) return 'off';
  if (!supported) return 'unsupported';
  if (permission === 'denied') return 'blocked';
  return subscribed && permission === 'granted' ? 'on' : 'ready';
}
const NEXT = {
  ready: { tap_enable: 'explaining' }, error: { tap_enable: 'explaining' },
  explaining: { confirm: 'asking', cancel: 'ready' },
  asking: { granted: 'subscribing', denied: 'blocked', failed: 'error' },
  subscribing: { subscribed: 'on', failed: 'error' },
  on: { tap_disable: 'ready' },
};
// A state that has no arrow for the event stays where it is (a tap in the wrong state does nothing), so "asking" can only come after "explaining".
export const pushReduce = (state, event) => (event === 'flag_off' ? 'off' : NEXT[state]?.[event] || state);
// Where a tapped notification goes. kind = the message kind of guardian_outbox / the inbox sources; ref = an inbox row id when the server knows it.
export function routeForPush({ kind, ref } = {}) {
  const k = String(kind || '');
  if (/^fee/.test(k)) return '/more/fees';
  if (['arrived', 'absent', 'late', 'left', 'early_leave'].includes(k)) return '/today';
  const base = ['notice', 'message', 'daily', 'director', 'staff'].includes(k) ? `/inbox?kind=${k}` : '/inbox';
  return ref && /^[\w:.-]{1,80}$/.test(String(ref)) ? `${base}${base.includes('?') ? '&' : '?'}open=${encodeURIComponent(ref)}` : base;
}
export const safePath = p => (typeof p === 'string' && /^\/[\w/?=&.:%-]{0,200}$/.test(p) && !p.startsWith('//') ? p : '/inbox');
export const keyToBytes = b64 => { const s = atob(String(b64).replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(String(b64).length / 4) * 4, '=')); return Uint8Array.from(s, c => c.charCodeAt(0)); };
export const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const subscriptionRow = (sub, deviceId) => { const j = sub.toJSON ? sub.toJSON() : sub; return { device_id: deviceId, endpoint: j.endpoint, p256dh: j.keys?.p256dh, auth: j.keys?.auth }; };

// ---- browser part ----
const isFake = () => typeof window !== 'undefined' && !!window.DeFake;
export const deviceId = () => { let d = store.get('de.next.deviceId'); if (!d) { d = uuid(); store.set('de.next.deviceId', d); } return d; };
export const pushConfigured = () => !!WEB_PUSH.publicKey || isFake();
export const pushSupported = () => isFake() || (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof window !== 'undefined' && 'PushManager' in window && 'Notification' in window);
export const permissionNow = () => (isFake() ? (store.get('de.next.fakepush.perm') || 'default') : typeof Notification !== 'undefined' ? Notification.permission : 'denied');

async function browserSub() {
  if (isFake()) { const s = store.get('de.next.fakepush.sub'); return s ? { toJSON: () => ({ endpoint: s, keys: { p256dh: 'fake-p256dh-key-0123456789', auth: 'fake-auth-0123' } }), unsubscribe: async () => { store.del('de.next.fakepush.sub'); return true; } } : null; }
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}
// -> 'off' | 'unsupported' | 'blocked' | 'ready' | 'on'
export async function currentPushState() {
  const flagOn = flags.on('web_push');
  if (!flagOn) return 'off';
  const supported = pushSupported();
  let subscribed = false;
  if (supported) { try { subscribed = !!(await browserSub()); } catch { /* treat as not subscribed */ } }
  return pushState({ flagOn, keySet: pushConfigured(), supported, permission: permissionNow(), subscribed });
}
// Step "asking": the browser's own prompt. Call only after the explanation was confirmed. -> 'granted' | 'denied'
export async function askPermission() {
  if (isFake()) { store.set('de.next.fakepush.perm', 'granted'); return 'granted'; }
  const p = await Notification.requestPermission();
  return p === 'granted' ? 'granted' : 'denied';
}
// Step "subscribing": subscribe in the browser, then tell the server. -> 'ok' | 'offline' | 'failed'
export async function subscribeNow() {
  try {
    let sub;
    if (isFake()) { store.set('de.next.fakepush.sub', 'https://push.example.test/fake/' + deviceId()); sub = await browserSub(); }
    else {
      const reg = await navigator.serviceWorker.getRegistration() || await navigator.serviceWorker.ready;
      sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(WEB_PUSH.publicKey) });
    }
    const res = await upsert('push_subscriptions', subscriptionRow(sub, deviceId()), 'user_id,device_id');
    if (res.kind === 'ok' || res.kind === 'conflict') return 'ok';
    return res.kind === 'offline' ? 'offline' : 'failed';
  } catch { return 'failed'; }
}
// "আরও" > বন্ধ করুন, and on logout (best effort). The phone stops first, then the row goes.
export async function unsubscribeNow() {
  try { const sub = await browserSub(); if (sub) await sub.unsubscribe(); } catch { /* the server row below still goes */ }
  if (isFake()) { store.del('de.next.fakepush.sub'); store.set('de.next.fakepush.perm', 'default'); }
  const uid = session.uid();
  if (uid) { const res = await request('DELETE', `/rest/v1/push_subscriptions?user_id=eq.${uid}&device_id=eq.${deviceId()}`); return res.kind === 'ok' || res.kind === 'offline' ? 'ok' : 'failed'; }
  return 'ok';
}

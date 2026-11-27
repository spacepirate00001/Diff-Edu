import { bn } from './bn.js';
// The one table that turns a server answer into a screen state (spec 2.2).
// res = { status, data? }.  status 0 / missing = no answer at all (offline).
export function kindOf(res) {
  const s = res?.status;
  if (!s) return 'offline';
  if (s >= 200 && s < 300) return 'ok';
  if (s === 401) return 'session';
  if (s === 403) return 'forbidden';
  if (s === 404) return 'missing';
  if (s === 408) return 'offline';
  if (s === 409) return 'conflict';
  if (s === 429) return 'rate';
  if (s >= 500) return 'server';
  return 'client';
}
// What the app shows for each kind. 'state' is the screen state name used by ui/states.js.
export const STATES = {
  ok: { state: 'ok', text: '' },
  offline: { state: 'offline', title: 'নেট নেই', text: 'ইন্টারনেট চালু করে আবার চেষ্টা করুন।' },
  session: { state: 'login', title: 'আবার লগইন করুন', text: 'আপনার ঢোকার সময় শেষ হয়েছে।' },
  forbidden: { state: 'forbidden', title: 'এই পাতা আপনার জন্য নয়', text: 'দরকার হলে অফিসে জানান।' },
  missing: { state: 'unavailable', title: 'এই সুবিধা এখনো চালু হয়নি', text: 'কিছুদিন পরে আবার দেখুন।' },
  conflict: { state: 'ok', text: '' },
  rate: { state: 'rate', title: 'একটু পরে আবার চেষ্টা করুন', text: 'এখন অনেকে একসাথে ব্যবহার করছেন।' },
  server: { state: 'error', title: 'এখন আনা যাচ্ছে না', text: 'একটু পরে আবার চেষ্টা করুন।' },
  client: { state: 'error', title: 'এখন আনা যাচ্ছে না', text: 'একটু পরে আবার চেষ্টা করুন।' },
};
export const describe = res => { const kind = kindOf(res); return { kind, ...STATES[kind] }; };
// A write the server answered "already there" (409) counts as done.
export const writeDone = res => { const k = kindOf(res); return k === 'ok' || k === 'conflict'; };
// Errors worth keeping in the outbox and retrying later.
export const retryLater = res => { const k = kindOf(res); return k === 'offline' || k === 'session' || k === 'rate' || k === 'server'; };
// Login answers get their own words (spec P4).
export function loginMessage(kind, retryAfter) {
  if (kind === 'offline') return 'নেট নেই। নেট চালু করে আবার চেষ্টা করুন।';
  if (kind === 'rate') return `অনেকবার ভুল হয়েছে। ${retryAfter ? bn(Math.max(1, Math.ceil(retryAfter / 60))) + ' মিনিট' : 'একটু'} পরে চেষ্টা করুন, বা অফিসে ফোন করুন।`;
  if (kind === 'busy') return 'এখন ঢোকা যাচ্ছে না। একটু পরে আবার চেষ্টা করুন।';
  if (kind === 'noprofile') return 'অ্যাকাউন্ট ঠিক নেই। অফিসে জানান।';
  return 'আইডি বা পিন মিলছে না। আবার চেষ্টা করুন।';
}

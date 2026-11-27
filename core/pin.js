// PIN rules (spec P5, P6, decisions): 4 to 6 digits, typed twice, nothing guessable.
import { ascii } from './bn.js';
import { CFG } from './config.js';

export const normPin = v => ascii(v).replace(/\D/g, '');
export const validPin = v => /^\d{4,6}$/.test(normPin(v));
const WEAK = new Set(['1234', '2580', '12345', '123456', '654321', '4321', '0123', '123123']);
export const allSame = p => /^(\d)\1+$/.test(p);
// null when fine, otherwise the Bangla reason.
export function pinProblem(v) {
  const p = normPin(v);
  if (!/^\d{4,6}$/.test(p)) return 'পিন ৪ থেকে ৬টা সংখ্যার হতে হবে।';
  if (allSame(p)) return 'সব সংখ্যা এক হলে চলবে না। অন্য পিন দিন।';
  if (WEAK.has(p)) return 'এই পিনটা সহজে আন্দাজ করা যায়। অন্য পিন দিন।';
  return null;
}
export const pinsMatch = (a, b) => normPin(a) === normPin(b);
// Server account mapping, the same as the old app and the login function.
export const loginId = id => ascii(id).replace(/[\s-]/g, '').trim().toLowerCase();
export const credsFor = (id, pin) => { const i = loginId(id); return { email: `${i}@${CFG.slug}.diffedu.app`, password: `de-${normPin(pin)}-${i}` }; };
export const validLoginId = id => /^[a-z0-9]{2,20}$/.test(loginId(id));

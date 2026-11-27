// Bangla numbers, Dhaka dates and times. Pure functions, no DOM.
export const DIGITS = '০১২৩৪৫৬৭৮৯';
export const bn = n => String(n ?? '').replace(/\d/g, d => DIGITS[d]);
export const ascii = s => String(s ?? '').replace(/[০-৯]/g, d => DIGITS.indexOf(d));
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const DAYS = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
export const MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
export const money = n => '৳\u00A0' + bn(Number(n || 0).toLocaleString('en-US'));

// Dhaka calendar day of a time (ms or Date). Asia/Dhaka is UTC+6 all year (no daylight saving).
export function dhakaParts(at = Date.now()) {
  const d = new Date(new Date(at).getTime() + 6 * 3600e3);
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, day = d.getUTCDate();
  return {
    y, m, d: day, wd: d.getUTCDay(), hh: d.getUTCHours(), mm: d.getUTCMinutes(), minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
    iso: `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  };
}
export const dhakaDay = at => dhakaParts(at).iso;
export const dhakaDate = at => { const p = dhakaParts(at); return `${DAYS[p.wd]}, ${bn(p.d)} ${MONTHS[p.m - 1]}`; };
export const shortDate = at => { const p = dhakaParts(at); return `${bn(p.d)} ${MONTHS[p.m - 1]}`; };
export const clockText = at => { const p = dhakaParts(at); return bn(`${p.hh % 12 || 12}:${String(p.mm).padStart(2, '0')}`); };

// "২ ঘণ্টা আগের" for the offline banner and the last-seen note.
export function agoText(then, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(then).getTime()) / 1000));
  if (s < 90) return 'এই মাত্র';
  const m = Math.round(s / 60);
  if (m < 60) return `${bn(m)} মিনিট আগের`;
  const h = Math.round(m / 60);
  if (h < 36) return `${bn(h)} ঘণ্টা আগের`;
  return `${bn(Math.round(h / 24))} দিন আগের`;
}
// Greeting by the clock (minutes since midnight, Dhaka). The sky screen has its own by the sun; this one is for "always light" and tests.
export function greetingFor(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  return h < 5 ? 'শুভ রাত্রি' : h < 12 ? 'শুভ সকাল' : h < 15 ? 'শুভ দুপুর' : h < 18 ? 'শুভ অপরাহ্ন' : h < 20 ? 'শুভ সন্ধ্যা' : 'শুভ রাত্রি';
}
// Random id for a queued write. crypto.randomUUID needs a secure context; getRandomValues works everywhere.
export function uuid() {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const b = c?.getRandomValues ? c.getRandomValues(new Uint8Array(16)) : Uint8Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  return [...b].map((x, i) => ([4, 6, 8, 10].includes(i) ? '-' : '') + x.toString(16).padStart(2, '0')).join('');
}
// Bangladesh mobile: 01XXXXXXXXX (also typed with 880 / +880 / Bangla digits). Returns the clean number or null.
export function cleanPhone(v) {
  let p = ascii(v).replace(/[\s-]/g, '').replace(/^\+/, '');
  if (p.startsWith('880')) p = '0' + p.slice(3);
  return /^01\d{9}$/.test(p) ? p : null;
}

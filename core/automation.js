// "অটোমেশনের নিয়ম": which messages the server sends by itself, to whom, when, and whether silent mode is holding them.
// READ ONLY. Nothing here switches silent mode, SMS or anything else on (the admin does that on the server, after the legal sign-off, 36).
// Sources, best first: rpc automation_status (next/66, any staff; yes/no flags only), then the table sender_settings (admin only by RLS),
// else "unknown" and the screen says so. rulesFor / headline are pure (tested). The admin screen of step 6 reuses these helpers.
import { rpc, sel, rows } from './api.js';
import { bn } from './bn.js';

export const UNKNOWN = Object.freeze({ known: false, silent_mode: null, paused: null, attendance_paused: null, sms_on: null, quiet_from: null, quiet_to: null });
const hm = t => (t ? bn(String(t).slice(0, 5)) : null);

// -> { kind: 'ok' | 'offline' | 'unknown', status }. Never throws.
export async function loadAutomation() {
  const r = await rpc('automation_status');
  if (r.kind === 'ok' && r.data && typeof r.data === 'object') return { kind: 'ok', status: { known: true, ...r.data } };
  if (r.kind === 'offline') return { kind: 'offline', status: UNKNOWN };
  const t = await sel('sender_settings', 'select=silent_mode,paused,sms_monthly_cap,quiet_from,quiet_to,attendance_paused&limit=1');
  const row = rows(t)[0];
  if (row) return { kind: 'ok', status: { known: true, silent_mode: row.silent_mode !== false, paused: !!row.paused, attendance_paused: !!row.attendance_paused, sms_on: (row.sms_monthly_cap || 0) > 0, quiet_from: row.quiet_from, quiet_to: row.quiet_to } };
  return { kind: t.kind === 'offline' ? 'offline' : 'unknown', status: UNKNOWN };
}
// Admin only (the server refuses others): the two numbers the owner checks before going live. -> { kind, data: { marks, wrong_child, missed, missed_pct, status } }
export async function loadSilentReport(from, to) {
  const r = await rpc('silent_mode_report', { p_from: from, p_to: to });
  return r.kind === 'ok' ? { kind: 'ok', data: Array.isArray(r.data) ? r.data[0] : r.data } : { kind: r.kind };
}

// The line at the top: what marking attendance does today. tone: 'good' (nothing goes out yet) | 'warn' (messages go out) | 'info' (not known)
export function headline(s = UNKNOWN) {
  if (!s.known) return { tone: 'info', title: 'চুপ মোড চালু না বন্ধ, এখন জানা যাচ্ছে না', text: 'হাজিরা সংরক্ষণের আগে ভালো করে দেখে নিন। চুপ মোড বন্ধ থাকলে সংরক্ষণের পরই অভিভাবকের কাছে "এসেছে" খবর যায়।' };
  if (s.paused) return { tone: 'good', title: 'সব খবর এখন থামানো আছে', text: 'অফিস পাঠানো থামিয়ে রেখেছে। হাজিরা নিলে কেবল লেখা থাকে, কারও কাছে খবর যায় না।' };
  if (s.silent_mode) return { tone: 'good', title: 'অটো-মেসেজ আপাতত বন্ধ', text: 'আপনার নেওয়া হাজিরা সিস্টেমে জমা থাকবে, তবে এখন অভিভাবকদের কাছে অটো নোটিফিকেশন যাচ্ছে না। অফিস থেকে চালু করলে নোটিফিকেশন যাবে।' };
  if (s.attendance_paused) return { tone: 'good', title: 'আজ ছুটি চালু আছে', text: 'আজ হাজিরার কোনো খবর অভিভাবকের কাছে যাবে না। নোটিশ আর ফি-র খবর আগের মতোই যায়।' };
  return { tone: 'warn', title: 'চুপ মোড বন্ধ: হাজিরার খবর যাচ্ছে', text: 'আপনি হাজিরা সংরক্ষণ করলে অভিভাবকের অ্যাপে "এসেছে" খবর যাবে। সংরক্ষণের আগে একবার দেখে নিন, ভুল চাপ পড়লে ঠিক করে নিন।' };
}
// The rules, in plain words. state: 'active' (goes out) | 'held' (silent mode / pause holds it) | 'staff' (a person decides first) | 'unknown'
export function rulesFor(s = UNKNOWN) {
  const attState = !s.known ? 'unknown' : s.paused || s.silent_mode ? 'held' : s.attendance_paused ? 'held' : 'active';
  const attText = { unknown: 'চুপ মোড জানা যাচ্ছে না', held: s.known && s.attendance_paused && !s.silent_mode && !s.paused ? 'আজ ছুটি, তাই যাচ্ছে না' : 'চুপ মোডে আটকে আছে, যাচ্ছে না', active: 'চলছে' }[attState];
  const quiet = s.quiet_from && s.quiet_to ? ` রাত ${hm(s.quiet_from)} থেকে ${hm(s.quiet_to)} পর্যন্ত পাঠানো হয় না।` : '';
  const sms = s.sms_on === true ? 'এসএমএস চালু আছে (অ্যাপ না থাকলে, সীমা পর্যন্ত)।' : 'এসএমএস বন্ধ আছে, শুধু অ্যাপে যায়।';
  return [
    { id: 'arrived', title: 'এসেছে', who: 'অভিভাবক', when: 'হাজিরা সংরক্ষণ করলে, বা ক্যামেরা চিনলে', how: `অ্যাপে (এসএমএস নয়)।${quiet}`, attendance: true, state: attState, stateText: attText },
    { id: 'absent', title: 'আজ আসেনি', who: 'অভিভাবক', when: 'আপনি অনুপস্থিত লিখে সংরক্ষণ করলে। শর্ত: সেদিন কোথাও উপস্থিত ধরা হয়নি, ক্যামেরাও দেখেনি, আর শিফট শেষ হয়নি', how: `আগে অ্যাপে। ${sms} অনেক দেরিতে হলে পাঠানো হয় না।`, attendance: true, state: attState, stateText: attText },
    { id: 'early', title: 'আগে বের হয়েছে', who: 'আগে শিক্ষক ও অ্যাডমিন, নিশ্চিত হলে অভিভাবক', when: 'আগের ক্লাসে উপস্থিত থাকা শিক্ষার্থীকে পরের ক্লাসে অনুপস্থিত লিখলে', how: 'আপনারা "নিশ্চিত" করলে তবেই অভিভাবকের কাছে যায়।', attendance: true, state: attState === 'active' ? 'staff' : attState, stateText: attState === 'active' ? 'আগে মানুষ দেখে' : attText },
    { id: 'review', title: 'ক্যামেরার সন্দেহ', who: 'আপনি', when: 'মুখ পুরো না মিললে', how: 'আপনি "ঠিক" বা "ভুল" না বলা পর্যন্ত অভিভাবকের কাছে কিছু যায় না।', state: 'staff', stateText: 'আপনার সিদ্ধান্ত' },
    { id: 'fee', title: 'ফি-র রিমাইন্ডার', who: 'অভিভাবক', when: 'ফি-র তারিখ আসার আগে ও পার হলে', how: 'অ্যাপে, না দেখলে এসএমএসে (এসএমএস চালু থাকলে)। চুপ মোড এটা আটকায় না।', state: s.known && s.paused ? 'held' : 'active', stateText: s.known && s.paused ? 'এখন থামানো' : 'চলছে' },
    { id: 'notice', title: 'নোটিশ', who: 'যাদের জন্য লিখেছেন', when: 'আপনি নোটিশ পাঠালেই', how: 'অ্যাপের ইনবক্সে। চুপ মোড এটা আটকায় না।', state: s.known && s.paused ? 'held' : 'active', stateText: s.known && s.paused ? 'এখন থামানো' : 'চলছে' },
    { id: 'report', title: 'রিপোর্ট কার্ড মনে করানো', who: 'শিক্ষক (আপনি)', when: 'রিপোর্টের আগে কোনো ক্লাসের রেটিং বা নম্বর বাকি থাকলে', how: 'আপনার আজ-এর কাজের তালিকায় ও অ্যাপে।', state: 'active', stateText: 'চলছে' },
  ];
}
export const STATE_CHIP = { active: ['good', 'চলছে'], held: ['warn', 'আটকে আছে'], staff: ['plain', 'মানুষ দেখে'], unknown: ['plain', 'জানা নেই'] };

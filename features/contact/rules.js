// Chat rules for the guardian side, pure (tested). Two live contracts:
//   1. guardian <-> teacher: table `messages` (free text, thread = the child), same as pwa-dev/comms.js. Max 1000 characters.
//   2. children's phrase chat (40/41/46 sql): guardians may READ their child's threads and REPORT one message with a reason code
//      (rpc report_message(p_message, p_reason); reasons are fixed by the server, there is no free text).
export const MAX_LEN = 1000;
// Ready sentences a guardian can tap to fill the box (never sent without the guardian pressing "পাঠান").
export const PHRASES = [
  'আজ সন্তান ক্লাসে আসতে পারবে না।',
  'সন্তান আজ একটু আগে যাবে।',
  'আজকের পড়াটা কি একটু বুঝিয়ে দেবেন?',
  'আপনার সাথে একটু কথা বলতে চাই।',
  'ধন্যবাদ স্যার।',
];
export const REPORT_REASONS = { rude: 'খারাপ ব্যবহার', unsafe: 'নিরাপদ মনে হচ্ছে না', personal_info: 'ব্যক্তিগত তথ্য চাওয়া হয়েছে', other: 'অন্য কারণ' };
export const REASON_CODES = Object.keys(REPORT_REASONS);
export function validateMessage(text) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return { ok: false, why: 'empty' };
  if (t.length > MAX_LEN) return { ok: false, why: 'long' };
  return { ok: true, text: t };
}
// A phrase fills the box; if there is already text it is added after a space. Over the limit: unchanged.
export const addPhrase = (box, phrase) => { const t = box ? `${box.trimEnd()} ${phrase}` : phrase; return t.length > MAX_LEN ? box : t; };
export const canReport = (m, myStudentIds) => !!m && !myStudentIds.includes(m.sender_id);   // a guardian reports what OTHER children wrote
// The row that goes to the server (client id makes a repeat send the same message).
export const messageRow = ({ id, coaching_id, student_id, sender_id, body }) => ({ id, coaching_id, thread_student_id: student_id, sender_id, body });

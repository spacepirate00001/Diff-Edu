// The eight things a guardian says yes or no to, per child (same keys and words as the old app's family.js).
// Everything starts OFF. A thing is on only if at least one guardian said yes and nobody said no; the server decides (rpc student_consent_on).
import { rpc, sel, rows } from '../../core/api.js';
import { session } from '../../core/session.js';

export const PURPOSES = [
  ['face_gate', 'গেটে ক্যামেরায় হাজিরা', 'গেটের ক্যামেরা চিনে নিলে হাজিরা উঠে যাবে। অনুমতি না দিলে খাতা বা কার্ডে হাজিরা নেওয়া হবে। (চোখ ঠিক রাখলেই হবে, কড়া নজরদারি নয়! 😊)'],
  ['classroom_face', 'ক্লাসরুমে মুখ চিনে হাজিরা', 'ক্লাসরুমের ক্যামেরা মুখ চিনে হাজিরা নেয়।'],
  ['photo_publish', 'ছবি ব্যবহার', 'অনুষ্ঠান ও নোটিশে সন্তানের ছবি ব্যবহার হবে।'],
  ['voice', 'ভয়েস রেকর্ডিং', 'মুখস্থ পড়া ও শিক্ষকের ভয়েস মেসেজ রেকর্ড হবে।'],
  ['merit_list', 'মেধা তালিকায় নাম', 'মেধা তালিকায় সন্তানের নাম দেখানো হবে।'],
  ['ai_tutor', 'AI পড়ার সহায়ক', 'প্রশ্ন Google Gemini AI-তে যায়; নাম বা ফোন নম্বর যায় না।'],
  ['ai_grading', 'AI দিয়ে খাতা দেখা', 'খাতার লেখা বা ছবি AI-তে যায়; চূড়ান্ত নম্বর শিক্ষক দেন।'],
  ['student_chat', 'বন্ধুর সাথে চ্যাট', 'একই ক্লাসের বন্ধুর সাথে শুধু নির্দিষ্ট বাক্য ও স্টিকারে কথা।'],
];
// What turning it off really does (only what the server really does; no promises beyond that).
export const OFF_NOTE = { face_gate: 'গেটের ক্যামেরা আর মুখ চিনবে না।' };
export const TERMS = 'ডিফ এডু আপনার সন্তানের নাম, শ্রেণি, উপস্থিতি, পরীক্ষার ফল, ফি ও শিক্ষকের মন্তব্য সংরক্ষণ করে, যাতে আপনি ও শিক্ষক একসাথে অগ্রগতি দেখতে পারেন। কোনো বিজ্ঞাপন বা ট্র্যাকিং নেই। AI-এর কিছু ফিচারে Google Gemini ব্যবহার হয়। যেকোনো সময় "গোপনীয়তা" পাতা থেকে তথ্য মুছে ফেলার অনুরোধ করতে পারবেন।';
export const NO_DIFFERENCE = 'এতে অনুমতি না দিলেও সন্তানের পড়াশোনায় কোনো প্রভাব পড়বে না।';

// -> { ok, kind, on: {purpose: bool}, mine: Set } for one child
export async function readChild(studentId) {
  const [ons, mine] = await Promise.all([
    Promise.all(PURPOSES.map(([p]) => rpc('student_consent_on', { p_student: studentId, p_purpose: p }))),
    sel('student_consents', `select=purpose&student_id=eq.${studentId}&by_profile=eq.${session.uid()}&granted=is.true`),
  ]);
  const bad = [...ons, mine].find(r => r.kind !== 'ok');
  if (bad) return { ok: false, kind: bad.kind };
  return { ok: true, kind: 'ok', on: Object.fromEntries(PURPOSES.map(([p], i) => [p, ons[i].data === true])), mine: new Set(rows(mine).map(r => r.purpose)) };
}
export const setAnswer = (studentId, purpose, granted) => rpc('set_student_consent', { p_student_id: studentId, p_purpose: purpose, p_granted: granted });
export async function readOne(studentId, purpose) {
  const r = await rpc('student_consent_on', { p_student: studentId, p_purpose: purpose });
  return r.kind === 'ok' ? r.data === true : null;
}

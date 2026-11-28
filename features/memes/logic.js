// Memes: the small pure pieces (tested in logic.test.mjs): picture size, the words for each server answer, the state names.
export const MAX_TEXT = 500;
export const MAX_SIDE = 1080;            // the longest side of a shared picture, in pixels
export const MAX_BYTES = 1500000;        // the bucket takes 1.5 MB
export const PIC_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// -> { w, h } with the longest side at most max, never enlarged
export function fitSize(w, h, max = MAX_SIDE) {
  if (!(w > 0) || !(h > 0)) return { w: 0, h: 0 };
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}
// What the server said (the function's own message) -> a warm Bangla line
export function sayError(msg) {
  const m = String(msg || '');
  if (m.includes('too_many_waiting')) return 'তোমার তিনটা মিম আগে থেকেই অনুমোদনের অপেক্ষায়। স্যার দেখলে আবার দিও।';
  if (m.includes('too_many_today')) return 'আজকের জন্য পাঁচটা মিম হয়ে গেছে। কাল আবার হাসাতে এসো!';
  if (m.includes('empty')) return 'কিছু একটা লেখো বা ছবি দাও।';
  if (m.includes('too_long')) return 'লেখা একটু বেশি বড় হয়ে গেছে। ৫০০ অক্ষরের মধ্যে রাখো।';
  if (m.includes('not_a_student')) return 'শুধু শিক্ষার্থীরা মিম দিতে পারে।';
  return 'এখন হলো না। একটু পরে আবার চেষ্টা করো।';
}
export const STATUS_BN = { pending: 'স্যারের অপেক্ষায়', approved: 'সবাই দেখছে', rejected: 'এবার রাখা গেল না' };
export const STATUS_TONE = { pending: 'warn', approved: 'good', rejected: 'bad' };
// "রিয়া · ক্লাস ৮"
export const byline = (author, level, bn) => `${author}${level ? ' · ক্লাস ' + bn(level) : ''}`;

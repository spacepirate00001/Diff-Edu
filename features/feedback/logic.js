// Pure rules for the feedback note (72-app-feedback.sql): kinds, the length limit, the rpc call, and the admin's list helpers.
export const KINDS = [['problem', 'সমস্যা'], ['idea', 'পরামর্শ'], ['praise', 'ভালো লেগেছে'], ['other', 'অন্য কিছু']];
export const KIND_BN = Object.fromEntries(KINDS);
export const MAX_LEN = 1000;
export function validateFeedback({ kind, message }) {
  const m = String(message || '').trim();
  if (!KIND_BN[kind]) return { ok: false, error: 'কী ধরনের কথা, বেছে নিন।' };
  if (m.length < 3) return { ok: false, error: 'কিছু একটা লিখুন (অন্তত ৩টা অক্ষর)।' };
  if (m.length > MAX_LEN) return { ok: false, error: 'একটু ছোট করে লিখুন।' };
  return { ok: true, value: { kind, message: m } };
}
export const feedbackCall = (v, screen, app) => ({ name: 'send_feedback', args: { p_kind: v.kind, p_message: v.message, p_screen: String(screen || '').slice(0, 80) || null, p_app: String(app || '').slice(0, 60) || null } });
// The admin's list: newest first, the ones still waiting before the done ones.
export const splitFeedback = list => ({ fresh: list.filter(x => x.status !== 'done'), done: list.filter(x => x.status === 'done') });
export const ROLE_NAME = { student: 'ছাত্র', guardian: 'অভিভাবক', teacher: 'শিক্ষক', admin: 'অ্যাডমিন' };

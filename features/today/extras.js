// What the "আজ" cards need that today_guardian does not send: this month's fee, week dots / 7-day trend / streak, homework, and the ডিফি nudges.
// All of it is read from tables a guardian may read, one set of calls per child, and every call may fail on its own (then that card is simply missing).
// Nudges are built by FIXED RULES here (never by AI): homework due tomorrow, a streak within 3 days of a milestone, a test within 3 days.
import { bn } from '../../core/bn.js';
import { dhakaDay } from '../../core/bn.js';
import { cache } from '../../core/cache.js';
import { session } from '../../core/session.js';
import { loadFees } from '../fees/api.js';
import { feeCardOf } from '../fees/logic.js';
import { loadPreviewInputs, loadHomework, loadRevision } from '../study/data.js';
import { derivePreview, addDays } from '../study/calc.js';

export const MILESTONES = [7, 10, 14, 21, 30, 50, 100];
// homework: [{ subject:{name}, title, due_date, done }], exams: [{ exam_date, subject:{name} }] (upcoming). -> [{ kind, text }] at most 3
export function deriveNudges({ homework = [], streak = 0, exams = [], today }) {
  const out = [], tomorrow = addDays(today, 1);
  for (const x of homework) if (!x.done && x.due_date === tomorrow) out.push({ kind: 'homework', text: `${x.subject?.name ? x.subject.name + ': ' : ''}${x.title} কাল জমা দিতে হবে।` });
  const next = MILESTONES.find(m => m > streak);
  if (streak > 0 && next && next - streak <= 3) out.push({ kind: 'streak', text: `আর ${bn(next - streak)} দিন এলেই টানা ${bn(next)} দিন হবে!` });
  for (const e of exams) { const n = Math.round((Date.parse(e.exam_date) - Date.parse(today)) / 864e5); if (n >= 0 && n <= 3) out.push({ kind: 'test', text: `${e.subject?.name ? e.subject.name + ' ' : ''}পরীক্ষা ${n === 0 ? 'আজ' : n === 1 ? 'কাল' : bn(n) + ' দিন পরে'}।` }); }
  return out.slice(0, 3);
}
const dueLabel = (d, today) => (d === today ? 'আজ জমা' : d === addDays(today, 1) ? 'কাল জমা' : 'জমা দিতে হবে');
// -> { [kidId]: { fee?, preview?, nudges?, homework? } }
export async function loadExtras(kids, { now = Date.now() } = {}) {
  const today = dhakaDay(now), uid = session.uid(), out = {};
  await Promise.all(kids.map(async k => {
    const [fees, pv, hw, rev] = await Promise.all([loadFees(k.id), loadPreviewInputs(k.id), loadHomework(k), loadRevision(k)]);
    const c = cache.get(uid, 'todayx.' + k.id)?.v || {}, e = {};
    const fee = fees.kind === 'ok' ? feeCardOf(fees.data, now) : c.fee;
    if (fee) e.fee = fee;
    const preview = pv.kind === 'ok' ? derivePreview(pv.data.att, pv.data.ratings, now) : c.preview;
    if (preview) e.preview = preview;
    const hwl = hw.kind === 'ok' ? hw.data : c.hw, exams = rev.kind === 'ok' ? rev.data.exams : c.exams;
    const open = (hwl || []).filter(x => !x.done && x.due_date >= today);
    if (open.length) e.homework = open.slice(0, 2).map(x => ({ subject: x.subject?.name || '', title: x.title, due_label: dueLabel(x.due_date, today) }));
    const nudges = deriveNudges({ homework: hwl || [], streak: preview?.streak_days || 0, exams: exams || [], today });
    if (nudges.length) e.nudges = nudges;
    cache.set(uid, 'todayx.' + k.id, { fee, preview, hw: hwl, exams });
    out[k.id] = e;
  }));
  return out;
}

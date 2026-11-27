// Fee rules, pure (tested). A fee row is { id, student_id, month: 'YYYY-MM-01', amount, paid_amount, status, method, paid_at, trx_id }.
// Truth is the amounts: due = amount - paid_amount (the ledger keeps paid_amount up to date, 15-payments-ledger.sql).
import { bn, money, MONTHS, dhakaParts } from '../../core/bn.js';

// Reminders go to the 7th and the admin call list starts on the 8th (17-fee-timeline.sql), so the fee is "due by the 7th".
export const FEE_DUE_DAY = 7;
export const METHODS = { bkash: 'bKash', nagad: 'Nagad', cash: 'অফিসে নগদ টাকা' };   // same words as the live app
export const METHOD_BN = METHODS;

export const dueOf = f => Math.max(0, Number(f.amount || 0) - Number(f.paid_amount || 0));
export const monthKey = f => String(f.month || '').slice(0, 7);
export const monthLabel = f => { const [y, m] = monthKey(f).split('-').map(Number); return m ? `${MONTHS[m - 1]} ${bn(y)}` : ''; };
const monthIndex = key => { const [y, m] = key.split('-').map(Number); return y * 12 + m; };
const nowKey = now => { const p = dhakaParts(now); return `${p.y}-${String(p.m).padStart(2, '0')}`; };

// 'paid' | 'partial' | 'late' (an earlier month, or this month past the 7th) | 'due'
export function feeState(f, now = Date.now()) {
  const due = dueOf(f);
  if (due <= 0) return 'paid';
  const cur = nowKey(now), isLate = monthIndex(monthKey(f)) < monthIndex(cur) || (monthKey(f) === cur && dhakaParts(now).d > FEE_DUE_DAY);
  if (isLate) return 'late';
  return Number(f.paid_amount || 0) > 0 ? 'partial' : 'due';
}
export const STATE_BN = { paid: 'পরিশোধিত', partial: 'কিছু বাকি', late: 'বাকি পড়েছে', due: 'বাকি' };
export const dueLabel = (f, now = Date.now()) => {
  const s = feeState(f, now);
  if (s === 'paid') return 'পরিশোধিত';
  if (s === 'late') return 'অফিসে জমা দিন';
  return `${bn(FEE_DUE_DAY)} তারিখের মধ্যে`;
};
export const unpaid = fees => fees.filter(f => dueOf(f) > 0).sort((a, b) => monthKey(a).localeCompare(monthKey(b)));
export const totalDue = fees => fees.reduce((s, f) => s + dueOf(f), 0);
// The fee the "আজ" card shows: this month's, else the oldest unpaid, else the newest.
export function currentFee(fees, now = Date.now()) {
  if (!fees.length) return null;
  const cur = nowKey(now);
  return fees.find(f => monthKey(f) === cur) || unpaid(fees)[0] || fees.slice().sort((a, b) => monthKey(b).localeCompare(monthKey(a)))[0];
}
// -> the card shape v7.js draws
export function feeCardOf(fees, now = Date.now()) {
  const f = currentFee(fees, now);
  if (!f) return null;
  const paid = dueOf(f) <= 0, extra = unpaid(fees).filter(x => x.id !== f.id).length;
  return { month_label: `${monthLabel(f)}-এর ফি`, amount: paid ? Number(f.amount) : dueOf(f), due_label: dueLabel(f, now) + (extra ? ` · আগের ${bn(extra)} মাসও বাকি` : ''), status: paid ? 'paid' : 'due' };
}
export const receiptOf = f => (Number(f.paid_amount || 0) > 0 ? { amount: Number(f.paid_amount), method: METHODS[f.method] || f.method || '', paid_at: f.paid_at || null, trx_id: f.trx_id || null } : null);

// ---- online payment ----
export const PAY_METHODS = ['bkash', 'nagad'];
// Oldest month first. amount defaults to everything due. -> [{ fee_id, amount }]
export function allocate(fees, amount) {
  let left = amount == null ? totalDue(fees) : Number(amount);
  const out = [];
  for (const f of unpaid(fees)) { if (left <= 0) break; const a = Math.min(left, dueOf(f)); out.push({ fee_id: f.id, amount: a }); left -= a; }
  return out;
}
// Same fees in the same state + same method = same key, so a second tap, a second tab or a retry after a dropped answer is the same payment.
export function idemKey(studentId, method, fees, allocations) {
  const byId = Object.fromEntries(fees.map(f => [f.id, f]));
  const canon = [studentId, method, ...allocations.map(a => `${a.fee_id}:${a.amount}:${byId[a.fee_id]?.paid_amount ?? 0}`)].join('|');
  let h1 = 0x811c9dc5, h2 = 5381;                       // two small hashes side by side; the server also treats (method, trx_id) as unique
  for (let i = 0; i < canon.length; i++) { const c = canon.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = (Math.imul(h2, 33) ^ c) >>> 0; }
  return `pi-${h1.toString(36)}${h2.toString(36)}`;
}
// -> { ok:true, intent:{ key, method, amount, allocations } } | { ok:false, why }. Never takes card or wallet secrets: no such field exists.
export function buildIntent({ studentId, fees, method, amount }) {
  if (!PAY_METHODS.includes(method)) return { ok: false, why: 'method' };
  const due = totalDue(fees), amt = amount == null ? due : Number(amount);
  if (!studentId || !(amt > 0) || !Number.isFinite(amt) || amt > due) return { ok: false, why: 'amount' };
  const allocations = allocate(fees, amt);
  if (allocations.reduce((s, a) => s + a.amount, 0) !== amt) return { ok: false, why: 'amount' };
  return { ok: true, intent: { key: idemKey(studentId, method, fees, allocations), method, amount: amt, allocations } };
}
// Runs a payment start once per key, however many times it is asked while one is running or after it finished.
export function createPayGuard() {
  const runs = new Map();
  return { run: (key, fn) => { if (!runs.has(key)) runs.set(key, Promise.resolve().then(fn).catch(e => { runs.delete(key); throw e; })); return runs.get(key); }, forget: key => runs.delete(key), has: key => runs.has(key) };
}
// Polling: after a payment is made the server records it in the ledger and the fee rows change. -> 'paid' | 'partial' | 'waiting'
export function payStatus(before, after, allocations) {
  const was = Object.fromEntries(before.map(f => [f.id, Number(f.paid_amount || 0)])), now = Object.fromEntries(after.map(f => [f.id, Number(f.paid_amount || 0)]));
  const got = allocations.map(a => Math.min(a.amount, (now[a.fee_id] ?? 0) - (was[a.fee_id] ?? 0)));
  if (got.every((g, i) => g >= allocations[i].amount)) return 'paid';
  return got.some(g => g > 0) ? 'partial' : 'waiting';
}
export { money };

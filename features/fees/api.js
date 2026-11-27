// Fee reads and the online-payment calls.
// READ: table `fees` (own children only, RLS), receipts come from the same rows (paid_at, method, trx_id are synced from the ledger by 23-fee-paid-fields.sql).
// START A PAYMENT: POST /functions/v1/payment-start { key, student_id, method, amount, allocations:[{fee_id, amount}] } -> { intent_id, method, amount, trx_id, steps:[text] }.
//   THIS FUNCTION DOES NOT EXIST YET. The repo has payment_intents (written by the service role only) and payment-callback (refuses everything until a provider
//   is chosen), but nothing that lets a guardian start a payment. Until the owner picks a provider and that function is written, the call answers 404
//   and the screen says "এখনো চালু হয়নি". The button itself is hidden by the flag online_pay (core/flags.js).
// STATUS: there is no table a guardian can read for the intent (payment_intents is admin-read only), so polling reads the fee rows again:
//   when the callback records the payment the ledger raises fees.paid_amount, and payStatus() (logic.js) notices.
import { sel, rows, fn } from '../../core/api.js';
import { session } from '../../core/session.js';
import { createPayGuard } from './logic.js';

export const loadFees = id => sel('fees', `select=id,student_id,month,amount,paid_amount,status,method,paid_at,trx_id&student_id=eq.${id}&order=month.desc`).then(r => ({ kind: r.kind, data: r.kind === 'ok' ? rows(r) : undefined }));
const guard = createPayGuard();
// Same key = same call, however often it is asked. A failed start is forgotten so "আবার চেষ্টা" can ask again with the same key (the server treats a repeat key as the same payment).
export const startPayment = (studentId, intent) => guard.run(intent.key, async () => {
  const r = await fn('payment-start', { key: intent.key, student_id: studentId, method: intent.method, amount: intent.amount, allocations: intent.allocations }, true);
  if (r.kind !== 'ok') { guard.forget(intent.key); return { kind: r.kind }; }
  return { kind: 'ok', data: r.data };
});
export const paymentSession = () => session.uid();

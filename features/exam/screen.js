// The online exam screen (student). exam.js stays a plain script with its own tests (tools/next/exam-logic-test.mjs);
// this file loads it on demand and gives it the app's server calls and outbox. Tab switches made offline are logged when the net returns.
// After the answers are accepted the child sees the result (own row of exam_attempts: score, total), once; the exam can be submitted only once.
import { h } from '../../ui/dom.js';
import { request, sel, rows } from '../../core/api.js';
import { outbox } from '../../core/outbox-app.js';
import { session } from '../../core/session.js';
import { bn } from '../../core/bn.js';
import { examStartMessage, attemptResult } from '../student/logic.js';

const load = () => new Promise((res, rej) => {
  if (globalThis.DeExam) return res();
  const s = document.createElement('script'); s.src = 'features/exam/exam.js'; s.onload = res; s.onerror = rej; document.head.append(s);
});
async function showResult(box, attemptId, ctx) {
  const r = await sel('exam_attempts', `select=id,score,total,submitted_at&id=eq.${attemptId}`);
  const a = r.kind === 'ok' ? attemptResult(rows(r)[0]) : null;
  box.append(h('section', { class: 'de-card exam-result', 'aria-live': 'polite' },
    a ? [h('span', { class: 'de-row__sub', text: 'তোমার ফল' }), h('b', { class: 'gx-big', text: `${bn(a.score)}/${bn(a.total)}` }),
      h('span', { class: 'de-row__sub', text: a.pct >= 80 ? 'খুব ভালো করেছ!' : a.pct >= 50 ? 'ভালো চেষ্টা! ভুলগুলো আবার দেখে নিলে আরও ভালো হবে।' : 'চেষ্টা করেছ, এটাই আসল। শিক্ষকের সাথে বসে ভুলগুলো ঠিক করে নিও।' })]
      : h('span', { class: 'de-row__sub', text: 'ফল একটু পরে "পরীক্ষার ফল"-এ দেখতে পাবে।' }),
    h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: () => ctx.replace('/learn/exams'), text: 'পরীক্ষার তালিকায় যাও' })));
}
export function examPage(ctx, examId) {
  const root = h('div', { class: 'exam' });
  const call = async (method, path, body) => {
    const r = await request(method, path, body);
    if (r.kind !== 'ok') throw Object.assign(new Error('HTTP ' + r.status), { status: r.status });
    return r.data;
  };
  const queue = (method, path, body) => outbox.submit({ uid: session.uid(), method, path, body, label: 'পরীক্ষার তথ্য' });
  load().then(() => globalThis.DeExam.open({ root, examId, call, queue, startMessage: examStartMessage, onDone: id => showResult(root, id, ctx) }), () => { root.textContent = 'পরীক্ষা এখন খোলা যাচ্ছে না। ইন্টারনেট দেখে আবার চেষ্টা করুন।'; });
  return { node: root };
}

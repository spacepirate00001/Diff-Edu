// One-question-at-a-time player for quizzes and the mistake notebook. No timer. After a choice the right answer is shown kindly and the child taps "পরের প্রশ্ন"
// (nothing moves by itself). questions: [{ text, options, answer_index }]. onDone(answers) when the last one is answered.
import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { bn } from '../../core/bn.js';

const RIGHT = ['ঠিক! দারুণ!', 'একদম ঠিক!', 'সঠিক উত্তর!'], WRONG = ['প্রায় হয়েছে! ঠিক উত্তরটা সবুজ রঙে দেখো।', 'কোনো ব্যাপার না, ভুল থেকেই শেখা হয়। ঠিক উত্তরটা সবুজ রঙে।'];
export function player({ title, questions, onDone, onQuit }) {
  const root = h('div', { class: 'st-player' });
  const answers = [];
  let i = 0;
  const step = () => {
    const q = questions[i];
    let chosen = null;
    const next = h('button', { class: 'de-btn de-btn--primary', type: 'button', hidden: true, text: i + 1 < questions.length ? 'পরের প্রশ্ন' : 'ফল দেখো', onclick: () => { answers.push(chosen); i++; i < questions.length ? step() : onDone(answers); } });
    const say = h('p', { class: 'st-say', role: 'status' });
    const opts = q.options.map((o, j) => h('button', { class: 'st-opt', type: 'button', 'data-j': String(j), onclick: () => {
      if (chosen != null) return;
      chosen = j;
      opts.forEach((b, k) => { b.setAttribute('aria-disabled', 'true'); if (k === q.answer_index) { b.classList.add('is-right'); b.append(icon('check')); } else if (k === j) b.classList.add('is-wrong'); });
      say.textContent = j === q.answer_index ? RIGHT[(i + j) % RIGHT.length] : WRONG[i % WRONG.length];
      next.hidden = false; next.focus();
    } }, h('span', { text: o })));
    root.replaceChildren(
      h('p', { class: 'de-row__sub', text: bn(`${title} · প্রশ্ন ${i + 1}/${questions.length}`) }),
      h('span', { class: 'gx-bar', role: 'presentation' }, h('i', { class: 'gx-bar__fill', style: { width: Math.round(i / questions.length * 100) + '%' } })),
      h('section', { class: 'de-card st-q' }, h('h2', { class: 'st-q__t', id: 'page-title', tabindex: '-1', text: bn(q.text) }), h('div', { class: 'st-opts', role: 'group', 'aria-label': 'উত্তর বেছে নাও' }, ...opts), say, next),
      onQuit ? h('button', { class: 'de-btn de-btn--text', type: 'button', onclick: onQuit, text: 'এখন থাক, পরে আসব' }) : null);
    root.querySelector('#page-title')?.focus({ preventScroll: true });
  };
  step();
  return root;
}

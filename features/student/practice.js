// "প্রশ্ন ব্যাংকে অনুশীলন" (71-student-practice.sql): pick a subject, answer ten questions the teachers approved for practice, see the right answer after each one.
// The answers never reach the phone before the child chooses: each choice is checked by the server (practice_check). Nothing here changes stars or marks.
import { h } from '../../ui/dom.js';
import { navRow } from '../../ui/navrow.js';
import { emptyState, loading, stateCard } from '../../ui/states.js';
import { toast } from '../../ui/toast.js';
import { rpc, rows } from '../../core/api.js';
import { bn } from '../../core/bn.js';
import { me, noRecState, section } from './common.js';

const LIMIT = 10;
export function practicePage(ctx) {
  const root = h('div', { class: 'st-page' });
  let dead = false;
  const say = (...k) => root.replaceChildren(...k.flat().filter(Boolean));
  const netCard = retry => stateCard({ kind: 'offline', title: 'ইশ, নেট হারিয়ে গেছে', text: 'নেট চালু করে আবার চেষ্টা করো।', action: 'আবার চেষ্টা করো', onAction: retry });

  async function home() {
    say(loading(2));
    const rec = await me(); if (dead) return;
    if (!rec) return say(noRecState(home));
    const r = await rpc('practice_subjects'); if (dead) return;
    if (r.kind !== 'ok') return say(netCard(home));
    const list = rows(r);
    if (!list.length) return say(emptyState('এখনো অনুশীলনের প্রশ্ন নেই', 'শিক্ষক প্রশ্ন ব্যাংকে প্রশ্ন দিলে এখানে দেখা যাবে। আজ একটু কুইজ বা খেলা খেলে নাও।'));
    say(h('p', { class: 'de-row__sub gx-note', text: 'বিষয় বেছে নাও। প্রতিবার ১০টা প্রশ্ন আসবে। ভুল হলে ঠিক উত্তরটা দেখিয়ে দেব, নম্বর কাটা যাবে না।' }),
      section('তোমার ক্লাসের বিষয়'), h('div', { class: 'de-card more-card' }, ...list.map(s => navRow({ ic: 'book', text: s.subject, sub: `${bn(s.n)}টি প্রশ্ন`, onclick: () => start(s.subject) }))));
  }

  async function start(subject) {
    say(loading(2));
    const r = await rpc('practice_questions', { p_subject: subject, p_limit: LIMIT }); if (dead) return;
    if (r.kind !== 'ok') return say(netCard(() => start(subject)));
    const qs = rows(r);
    if (!qs.length) return say(emptyState('এই বিষয়ে এখন প্রশ্ন নেই', 'অন্য বিষয় বেছে নাও।', h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: home, text: 'বিষয়ের তালিকা' })));
    ask(subject, qs, 0, 0);
  }

  function ask(subject, qs, i, correct) {
    const q = qs[i]; let locked = false;
    const next = h('button', { class: 'de-btn de-btn--primary', type: 'button', hidden: true, onclick: () => (i + 1 < qs.length ? ask(subject, qs, i + 1, correct + (next.dataset.ok === '1' ? 1 : 0)) : finish(subject, qs.length, correct + (next.dataset.ok === '1' ? 1 : 0))), text: i + 1 < qs.length ? 'পরের প্রশ্ন' : 'শেষ করো' });
    const note = h('p', { class: 'de-row__sub st-center', 'aria-live': 'polite' });
    const opts = (q.options || []).map(String);
    const btns = opts.map(o => h('button', { class: 'st-opt', type: 'button', onclick: async () => {
      if (locked) return; locked = true;
      const res = await rpc('practice_check', { p_id: q.id, p_choice: o }); if (dead) return;
      if (res.kind !== 'ok' || !res.data) { locked = false; return toast(res.kind === 'offline' ? 'নেট নেই। নেট এলে আবার চাপো।' : 'এখন যাচাই করা গেল না, আবার চাপো।'); }
      const ok = !!res.data.right; next.dataset.ok = ok ? '1' : '0';
      btns.forEach((b, k) => { if (opts[k] === res.data.answer) b.classList.add('is-right'); else if (opts[k] === o) b.classList.add('is-wrong'); });
      note.textContent = ok ? 'ঠিক! চালিয়ে যাও।' : 'এবার না হলেও পরেরবার হবে। ঠিক উত্তরটা সবুজ দাগে দেখো।';
      next.hidden = false; next.focus({ preventScroll: true });
    } }, h('span', { text: o })));
    say(h('p', { class: 'de-row__sub', text: `${subject} · ${bn(`${i + 1}/${qs.length}`)}${q.chapter_name ? ' · ' + q.chapter_name : ''}` }),
      h('section', { class: 'de-card st-q' }, h('p', { class: 'st-qtext', text: q.body }), h('div', { class: 'st-opts' }, ...btns), note, next),
      h('button', { class: 'de-btn de-btn--text', type: 'button', onclick: home, text: 'এখানেই থামি' }));
  }

  function finish(subject, total, correct) {
    say(h('section', { class: 'de-card st-result' }, window.Diffy ? window.Diffy.make(correct === total ? 'cheering' : 'happy', 'de-mascot--lg') : null,
      h('h2', { class: 'st-result__n', id: 'page-title', tabindex: '-1', text: `${bn(correct)}/${bn(total)} সঠিক!` }), h('p', { class: 'de-row__sub', text: correct === total ? 'সবগুলো ঠিক! দারুণ।' : correct * 2 >= total ? 'বেশ ভালো হয়েছে। আরেকবার চেষ্টা করলে সবগুলোই পারবে।' : 'চেষ্টা করেছ, এটাই আসল। আরেকবার করলে আরও ভালো হবে।' }),
      h('div', { class: 'st-actions' }, h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: () => start(subject), text: 'আবার অনুশীলন' }), h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: home, text: 'অন্য বিষয়' }))));
    root.querySelector('#page-title')?.focus({ preventScroll: true });
  }

  home();
  return { node: root, destroy() { dead = true; } };
}

// "প্রশ্ন ব্যাংকে অনুশীলন": pick a subject (the book), then the kind of question (বহুনির্বাচনি / সংক্ষিপ্ত / সৃজনশীল), then a chapter or all of them.
// Only questions the teachers approved for practice. Answers never reach the phone before the child asks: MCQ is checked by the server (practice_check),
// a short or creative model answer comes only when the child taps "উত্তর দেখি" (practice_reveal). Nothing here changes stars or marks.
// If the server has no practice_outline yet (practice-v2.sql not applied), the old flow runs: subjects, then ten MCQs.
import { h } from '../../ui/dom.js';
import { navRow } from '../../ui/navrow.js';
import { chip, chipRow } from '../../ui/chip.js';
import { emptyState, loading, stateCard } from '../../ui/states.js';
import { toast } from '../../ui/toast.js';
import { rpc, rows } from '../../core/api.js';
import { bn } from '../../core/bn.js';
import { me, noRecState, section } from './common.js';

const TYPES = [['mcq', 'বহুনির্বাচনি'], ['short', 'সংক্ষিপ্ত'], ['creative', 'সৃজনশীল']];
const TNAME = Object.fromEntries(TYPES);
const COUNTS = [5, 10, 15, 20];
const OTHER = 'অন্যান্য';
export function practicePage(ctx) {
  const root = h('div', { class: 'st-page' });
  let dead = false, legacy = false, outline = [], qtype = 'mcq', limit = 10;
  const say = (...k) => root.replaceChildren(...k.flat().filter(Boolean));
  const netCard = retry => stateCard({ kind: 'offline', title: 'ইশ, নেট হারিয়ে গেছে', text: 'নেট চালু করে আবার চেষ্টা করো।', action: 'আবার চেষ্টা করো', onAction: retry });
  const back = (text, fn) => h('button', { class: 'de-btn de-btn--text', type: 'button', onclick: fn, text });

  async function home() {
    say(loading(2));
    const rec = await me(); if (dead) return;
    if (!rec) return say(noRecState(home));
    const r = await rpc('practice_outline'); if (dead) return;
    if (r.kind === 'offline') return say(netCard(home));
    if (r.kind !== 'ok') return oldHome();   // the function is not on the server yet
    legacy = false; outline = rows(r);
    if (!outline.length) return say(emptyState('এখনো অনুশীলনের প্রশ্ন নেই', 'শিক্ষক প্রশ্ন ব্যাংকে প্রশ্ন দিলে এখানে দেখা যাবে। আজ একটু কুইজ বা খেলা খেলে নাও।'));
    const subs = [...new Set(outline.map(x => x.subject))];
    say(h('p', { class: 'de-row__sub gx-note', text: 'কোন বই থেকে চর্চা করবে? বেছে নাও। তারপর অধ্যায় আর প্রশ্নের ধরনও ঠিক করতে পারবে।' }),
      section('তোমার ক্লাসের বই'), h('div', { class: 'de-card more-card' }, ...subs.map(s => {
        const mine = outline.filter(x => x.subject === s), n = mine.reduce((a, x) => a + Number(x.n), 0), chs = new Set(mine.map(x => x.chapter_name || OTHER)).size;
        return navRow({ ic: 'book', text: s, sub: `${bn(n)}টি প্রশ্ন · ${bn(chs)}টি অধ্যায়`, onclick: () => subject(s) });
      })));
  }
  async function oldHome() {
    legacy = true;
    const r = await rpc('practice_subjects'); if (dead) return;
    if (r.kind !== 'ok') return say(netCard(home));
    const list = rows(r);
    if (!list.length) return say(emptyState('এখনো অনুশীলনের প্রশ্ন নেই', 'শিক্ষক প্রশ্ন ব্যাংকে প্রশ্ন দিলে এখানে দেখা যাবে। আজ একটু কুইজ বা খেলা খেলে নাও।'));
    say(h('p', { class: 'de-row__sub gx-note', text: 'বিষয় বেছে নাও। প্রতিবার ১০টা প্রশ্ন আসবে। ভুল হলে ঠিক উত্তরটা দেখিয়ে দেব, নম্বর কাটা যাবে না।' }),
      section('তোমার ক্লাসের বিষয়'), h('div', { class: 'de-card more-card' }, ...list.map(s => navRow({ ic: 'book', text: s.subject, sub: `${bn(s.n)}টি প্রশ্ন`, onclick: () => start(s.subject, null, 'mcq') }))));
  }

  // a subject: type chips, how many, then the chapters
  function subject(sub) {
    const mine = outline.filter(x => x.subject === sub), types = TYPES.filter(([k]) => mine.some(x => x.qtype === k));
    if (!types.some(([k]) => k === qtype)) qtype = types[0]?.[0] || 'mcq';
    const countOf = k => mine.filter(x => x.qtype === k).reduce((a, x) => a + Number(x.n), 0);
    const chs = mine.filter(x => x.qtype === qtype && Number(x.n) > 0).map(x => ({ name: x.chapter_name || '', n: Number(x.n) })).sort((a, b) => a.name.localeCompare(b.name, 'bn'));
    const total = countOf(qtype);
    say(back('← সব বই', home), h('h2', { class: 'st-h', id: 'pr-title', tabindex: '-1', text: sub }),
      chipRow('কোন ধরনের প্রশ্ন', types.map(([k, l]) => chip(`${l} (${bn(countOf(k))})`, k === qtype, () => { qtype = k; subject(sub); }))),
      chipRow('কতটা প্রশ্ন', COUNTS.map(n => chip(bn(n) + 'টা', n === limit, () => { limit = n; subject(sub); }))),
      section('অধ্যায় বেছে নাও'),
      h('div', { class: 'de-card more-card' }, navRow({ ic: 'book', text: 'সব অধ্যায় মিলিয়ে', sub: `${bn(total)}টি ${TNAME[qtype]} প্রশ্ন`, onclick: () => start(sub, null, qtype) }),
        ...chs.map(c => navRow({ ic: 'book', text: c.name || OTHER, sub: `${bn(c.n)}টি প্রশ্ন`, onclick: () => start(sub, c.name, qtype) }))));
    root.querySelector('#pr-title')?.focus({ preventScroll: true });
  }

  async function start(sub, chapter, type) {
    say(loading(2));
    const args = { p_subject: sub, p_chapter: chapter, p_qtype: type, p_limit: limit };
    // chapter: null = all chapters, '' = the questions that have no chapter
    const r = legacy ? await rpc('practice_questions', { p_subject: sub, p_limit: 10 }) : await rpc('practice_pick', args); if (dead) return;
    if (r.kind !== 'ok') return say(netCard(() => start(sub, chapter, type)));
    const qs = rows(r).map(q => ({ ...q, qtype: q.qtype || 'mcq' }));
    const again = () => (legacy ? start(sub, null, 'mcq') : start(sub, chapter, type));
    const ctxo = { sub, chapter, again, list: legacy ? home : () => subject(sub) };
    if (!qs.length) return say(emptyState('এখানে এখন প্রশ্ন নেই', 'অন্য অধ্যায় বা অন্য ধরন বেছে নাও।', h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: ctxo.list, text: legacy ? 'বিষয়ের তালিকা' : 'অধ্যায়ের তালিকা' })));
    ask(ctxo, qs, 0, 0);
  }

  const advance = (c, qs, i, correct, ok) => (i + 1 < qs.length ? ask(c, qs, i + 1, correct + (ok ? 1 : 0)) : finish(c, qs.length, correct + (ok ? 1 : 0)));
  const head = (c, qs, i, q) => h('p', { class: 'de-row__sub', text: `${c.sub} · ${TNAME[q.qtype] || ''} · ${bn(`${i + 1}/${qs.length}`)}${q.chapter_name ? ' · ' + q.chapter_name : ''}` });

  function ask(c, qs, i, correct) {
    const q = qs[i];
    if (q.qtype === 'mcq') return askMcq(c, qs, i, correct); return askWritten(c, qs, i, correct);
  }

  function askMcq(c, qs, i, correct) {
    const q = qs[i]; let locked = false, ok = false;
    const next = h('button', { class: 'de-btn de-btn--primary', type: 'button', hidden: true, onclick: () => advance(c, qs, i, correct, ok), text: i + 1 < qs.length ? 'পরের প্রশ্ন' : 'ফল দেখি' });
    const note = h('p', { class: 'de-row__sub st-center', 'aria-live': 'polite' });
    const opts = (q.options || []).map(String);
    const btns = opts.map(o => h('button', { class: 'st-opt', type: 'button', onclick: async () => {
      if (locked) return; locked = true;
      const res = await rpc('practice_check', { p_id: q.id, p_choice: o }); if (dead) return;
      if (res.kind !== 'ok' || !res.data) { locked = false; return toast(res.kind === 'offline' ? 'নেট নেই। নেট এলে আবার চাপো।' : 'এখন যাচাই করা গেল না, আবার চাপো।'); }
      ok = !!res.data.right;
      btns.forEach((b, k) => { if (opts[k] === res.data.answer) b.classList.add('is-right'); else if (opts[k] === o) b.classList.add('is-wrong'); });
      note.textContent = ok ? 'ঠিক! চালিয়ে যাও।' : 'এবার না হলেও পরেরবার হবে। ঠিক উত্তরটা সবুজ দাগে দেখো।';
      next.hidden = false; next.focus({ preventScroll: true });
    } }, h('span', { text: o })));
    say(head(c, qs, i, q), h('section', { class: 'de-card st-q' }, h('p', { class: 'st-qtext', text: q.body }), h('div', { class: 'st-opts' }, ...btns), note, next), back('এখানেই থামি', c.list));
  }

  // short and creative: think and write on paper first, then look at the model answer and judge yourself
  function askWritten(c, qs, i, correct) {
    const q = qs[i];
    const box = h('div', { class: 'st-model', 'aria-live': 'polite' });
    const show = h('button', { class: 'de-btn de-btn--primary', type: 'button', text: 'উত্তর দেখি', onclick: async () => {
      show.disabled = true;
      const res = await rpc('practice_reveal', { p_id: q.id }); if (dead) return;
      if (res.kind !== 'ok' || !res.data) { show.disabled = false; return toast(res.kind === 'offline' ? 'নেট নেই। নেট এলে আবার চাপো।' : 'এখন উত্তর আনা গেল না, আবার চাপো।'); }
      const a = String(res.data.answer || '').trim();
      show.hidden = true;
      box.replaceChildren(h('p', { class: 'de-row__sub', text: 'নমুনা উত্তর' }),
        h('p', { class: 'st-qtext st-pre', text: a || 'এই প্রশ্নের নমুনা উত্তর এখনো যোগ হয়নি। খাতায় নিজে লিখে শিক্ষককে দেখিয়ে নাও।' }),
        h('p', { class: 'de-row__sub', text: 'নিজের লেখার সঙ্গে মিলিয়ে সৎভাবে বলো, কেমন হলো?' }),
        h('div', { class: 'st-actions' }, h('button', { class: 'de-btn de-btn--primary', type: 'button', text: 'ঠিক হয়েছিল', onclick: () => advance(c, qs, i, correct, true) }),
          h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: 'আবার দেখব', onclick: () => advance(c, qs, i, correct, false) })));
      box.querySelector('button')?.focus({ preventScroll: true });
    } });
    say(head(c, qs, i, q), h('section', { class: 'de-card st-q' }, h('p', { class: 'st-qtext st-pre', text: q.body }),
      q.marks ? h('p', { class: 'de-row__sub', text: `${bn(Number(q.marks))} নম্বরের প্রশ্ন` }) : null,
      h('p', { class: 'de-row__sub', text: 'আগে খাতায় নিজে লিখে ফেলো, তারপর উত্তর মিলিয়ে নাও।' }), show, box), back('এখানেই থামি', c.list));
  }

  function finish(c, total, correct) {
    say(h('section', { class: 'de-card st-result' }, window.Diffy ? window.Diffy.make(correct === total ? 'cheering' : 'happy', 'de-mascot--lg') : null,
      h('h2', { class: 'st-result__n', id: 'page-title', tabindex: '-1', text: `${bn(correct)}/${bn(total)} সঠিক!` }), h('p', { class: 'de-row__sub', text: correct === total ? 'সবগুলো ঠিক! দারুণ।' : correct * 2 >= total ? 'বেশ ভালো হয়েছে! যেগুলো আটকেছে সেগুলো আবার দেখে নিও।' : 'কোনো ব্যাপার না, অনুশীলনেই তো শেখা। আরেকবার চেষ্টা করো।' }),
      h('div', { class: 'st-actions' }, h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: c.again, text: 'আবার অনুশীলন' }), h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: c.list, text: legacy ? 'অন্য বিষয়' : 'অন্য অধ্যায়' }))));
    root.querySelector('#page-title')?.focus({ preventScroll: true });
  }

  home();
  return { node: root, destroy() { dead = true; } };
}

// "পড়া" tab and its pages: syllabus, homework, quizzes (take, result, stars), mistake notebook, online exam list, merit list (flag). Notes/videos, revision plan,
// exam marks and the report card reuse the pages already built for the guardian (features/study/pages.js, report.js): for a student the "child" is the student.
import { h } from '../../ui/dom.js';
import { navRow } from '../../ui/navrow.js';
import { emptyState, loading, stateCard, staleBanner } from '../../ui/states.js';
import { cache } from '../../core/cache.js';
import { openSheet } from '../../ui/sheet.js';
import { saveBar } from '../../ui/savebar.js';
import { sel, rpc, rows } from '../../core/api.js';
import { outbox } from '../../core/outbox-app.js';
import { session } from '../../core/session.js';
import { features } from '../../core/features.js';
import { flags } from '../../core/flags.js';
import { self } from '../../core/student-self.js';
import { bn, dhakaDay, shortDate } from '../../core/bn.js';
import { byId, visible } from '../search/registry.js';
import { loadHomework } from '../study/data.js';
import { addDays } from '../study/calc.js';
import { me, put, studentPage, wrap, progressCard, section, noRecState } from './common.js';
import { scoreQuiz, quizStars, quizCheer, mistakeRows, dueMistakes, reviewMistake, examWindow, attemptResult, LEITNER } from './logic.js';
import { player } from './player.js';

const out = (method, path, body, prefer, label) => outbox.submit({ uid: session.uid(), method, path, body, prefer, label });

// ---- the tab ----
export function learnTab(ctx) {
  const root = h('div', { class: 'st-page' });
  const dueChip = h('span', { class: 'de-chip de-chip--warn', hidden: true });
  const groups = [
    ['পড়ো', [['s_syllabus', '/learn/syllabus', 'book', 'সিলেবাস ও অধ্যায়', 'কোন অধ্যায় শেষ, কোনটা বাকি'], ['s_materials', '/learn/materials', 'file', 'নোট ও ভিডিও', 'শিক্ষকের দেওয়া উপকরণ'], ['s_homework', '/learn/homework', 'check', 'বাড়ির কাজ', 'কী কবে জমা দিতে হবে'], ['s_flash', '/learn/flash', 'file', 'ফ্ল্যাশকার্ড', 'ছোট ছোট কার্ডে মনে রাখো'], ['s_revision', '/learn/revision', 'clock', 'পড়ার পরিকল্পনা', 'পরীক্ষার আগের দিনগুলোর ভাগ করা পড়া']]],
    ['অনুশীলন', [['s_quiz', '/learn/quiz', 'trophy', 'কুইজ', 'খেলতে খেলতে শেখো, স্টার জমাও'], ['s_mistakes', '/learn/mistakes', 'check', 'ভুলের খাতা', 'আগের ভুলগুলো আবার দেখে নাও'], ['s_timer', '/learn/focus', 'clock', 'ফোকাস টাইমার', '২৫ মিনিট মন দিয়ে পড়ো, স্টার পাও'], ['s_askbox', '/learn/doubts', 'chat', 'প্রশ্ন বক্স', 'নাম ছাড়াই শিক্ষককে প্রশ্ন করো'], ['s_ai', '/learn/diffy', 'help', 'ডিফি', 'পড়ার সঙ্গী']]],
    ['পরীক্ষা', [['s_exams', '/learn/exams', 'exam', 'অনলাইন পরীক্ষা', 'অনুশীলন আর নির্দিষ্ট সময়ের পরীক্ষা'], ['s_results', '/learn/results', 'chart', 'পরীক্ষার ফল', 'প্রতিটা পরীক্ষার নম্বর ও গড়'], ['s_report', '/learn/report', 'file', 'রিপোর্ট কার্ড', 'সপ্তাহের ফল ও ক্লাসে অবস্থান']]],
  ];
  for (const [title, list] of groups) {
    const items = list.filter(([id]) => visible(byId[id], features));
    if (!items.length) continue;
    root.append(h('section', { class: 'more-group' }, h('h2', { class: 'inbox-group__h', text: title }), h('div', { class: 'de-card more-card' },
      ...items.map(([id, route, ic, text, sub]) => { const r = navRow({ ic, text, sub, onclick: () => ctx.go(route) }); if (id === 's_mistakes') r.querySelector('.de-row__main').after(dueChip); return r; }),
      title === 'পরীক্ষা' && flags.on('merit_list') ? navRow({ ic: 'trophy', text: 'মেধা তালিকা', sub: 'যাদের নাম দেখানোর অনুমতি আছে', onclick: () => ctx.go('/learn/merit') }) : null)));
  }
  let dead = false;
  me().then(async rec => {
    if (!rec || dead) return;
    const r = await sel('quiz_mistakes', `select=due&student_id=eq.${rec.id}`);
    if (dead) return;
    const n = dueMistakes(rows(r), dhakaDay()).length;
    if (r.kind === 'ok' && n) { dueChip.textContent = `আজ ${bn(n)}টা`; dueChip.hidden = false; }
  });
  return { node: root, destroy() { dead = true; } };
}

// ---- syllabus ----
const CH = { todo: ['বাকি', 'plain'], doing: ['চলছে', 'now'], done: ['শেষ', 'good'] };
export const syllabusPage = ctx => studentPage({
  key: 'ssyl', load: rec => sel('chapters', `select=id,class_level,subject,number,title,pages,status,done_on&class_level=eq.${rec.class_level}&order=subject,number`).then(r => wrap(r)), isEmpty: r => !r.length,
  empty: () => emptyState('সিলেবাস এখনো যোগ করা হয়নি', 'শিক্ষক অধ্যায় যোগ করলে এখানে দেখা যাবে।'),
  draw: list => {
    const by = {}; list.forEach(c => (by[c.subject] ||= []).push(c));
    return [...Object.entries(by).map(([subject, cs]) => {
      const done = cs.filter(c => c.status === 'done').length;
      return h('section', { class: 'de-card gx-card' }, h('div', { class: 'de-row' }, h('div', { class: 'de-row__main' }, h('h3', { class: 'gx-h3', text: subject }), h('span', { class: 'de-row__sub', text: `${bn(done)}/${bn(cs.length)} অধ্যায় শেষ` }))),
        h('span', { class: 'gx-bar', role: 'presentation' }, h('i', { class: 'gx-bar__fill', style: { width: Math.round(100 * done / cs.length) + '%' } })),
        ...cs.map(c => h('div', { class: 'de-row gx-line' }, h('span', { class: 'gx-slot', 'aria-hidden': 'true', text: bn(c.number) }), h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: c.title }), c.pages ? h('span', { class: 'de-row__sub', text: `পৃষ্ঠা ${bn(c.pages)}` }) : null),
          h('span', { class: 'de-chip de-chip--' + (CH[c.status] || CH.todo)[1], text: (CH[c.status] || CH.todo)[0] }))));
    }), h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: () => ctx.go('/learn/materials?kind=video'), text: 'এই ক্লাসের ভিডিও দেখো' })];
  },
});

// ---- homework (the child ticks their own; table homework_done, live student policy) ----
export const homeworkPage = () => studentPage({
  key: 'shw', load: rec => loadHomework(rec), isEmpty: r => !r.length,
  empty: () => emptyState('বাড়ির কাজ নেই', 'শিক্ষক বাড়ির কাজ দিলে এখানে দেখা যাবে। আজ একটু বিশ্রাম!'),
  draw: list => {
    const rec = self.get(), today = dhakaDay(), uid = session.uid(), box = h('div', { class: 'de-card more-card' });
    const when = x => (x.done ? 'জমা হয়েছে' : x.due_date === today ? 'আজ জমা' : x.due_date === addDays(today, 1) ? 'কাল জমা' : x.due_date < today ? 'জমার তারিখ পেরিয়ে গেছে' : `${shortDate(Date.parse(x.due_date + 'T06:00:00Z'))} জমা`);
    const draw = () => box.replaceChildren(...list.slice().sort((a, b) => a.done - b.done || a.due_date.localeCompare(b.due_date)).map(x => h('div', { class: 'de-row gx-line' },
      h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: `${x.subject?.name || ''}${x.subject ? ': ' : ''}${x.title}` }), h('span', { class: 'de-row__sub', text: when(x) })),
      h('button', { class: 'de-chip st-tick' + (x.done ? ' is-on' : ''), type: 'button', 'aria-pressed': String(x.done), 'aria-label': `${x.title}: ${x.done ? 'করা হয়েছে, চাপলে বাদ যাবে' : 'করেছি বলে চিহ্ন দাও'}`, text: x.done ? '✓ করেছি' : 'করেছি?', onclick: async () => {
        x.done = !x.done; draw();
        const r = x.done ? await out('POST', '/rest/v1/homework_done?on_conflict=student_id,homework_id', { coaching_id: session.me().coaching_id, student_id: rec.id, homework_id: x.id }, 'resolution=merge-duplicates,return=minimal', 'বাড়ির কাজ')
          : await out('DELETE', `/rest/v1/homework_done?student_id=eq.${rec.id}&homework_id=eq.${x.id}`, undefined, undefined, 'বাড়ির কাজ');
        saveBar.show(r.state === 'rejected' ? 'failed' : r.state);
        if (r.state === 'rejected' || r.state === 'failed') { x.done = !x.done; draw(); }
      } }))));
    draw();
    return box;
  },
});

// ---- quizzes ----
const loadQuizzes = rec => sel('quizzes', `select=id,title,class_level,questions,subject:subjects(name)&class_level=eq.${rec.class_level}`).then(r => wrap(r));
export const quizListPage = ctx => studentPage({
  key: 'sqz', load: loadQuizzes, isEmpty: r => !r.length,
  empty: () => emptyState('এই ক্লাসে এখনো কোনো কুইজ নেই', 'শিক্ষক কুইজ দিলে এখানে দেখা যাবে। আজ একটু বিশ্রাম।'),
  draw: list => [progressCard(self.get()), h('p', { class: 'de-row__sub gx-note', text: 'কুইজে সময়ের তাড়া নেই। ভুল হলে ভুলের খাতায় জমা থাকে, পরে আবার দেখে নিতে পারবে। প্রথমবার খেললে স্টার পাবে।' }),
    h('div', { class: 'de-card more-card' }, ...list.map(q => navRow({ ic: 'trophy', text: q.title, sub: `${q.subject?.name || ''} · ${bn((q.questions || []).length)}টি প্রশ্ন`, onclick: () => ctx.go('/learn/quiz/' + q.id) })))],
});

// One quiz: play, submit once (kept in the outbox if the net is down), result with stars, wrong answers go to the notebook.
export function quizPage(ctx, id) {
  const root = h('div', { class: 'st-page' });
  const say = (...k) => root.replaceChildren(...k);
  let dead = false;
  (async () => {
    say(loading(2));
    const rec = await me();
    let r = rec ? await loadQuizzes(rec) : { kind: 'ok', data: [] };
    if (dead) return;
    if (r.kind !== 'ok') { const old = cache.get(session.uid(), 'sqz'); if (old?.v?.some(x => x.id === id)) r = { kind: 'ok', data: old.v }; }
    const q = r.data?.find(x => x.id === id);
    if (r.kind !== 'ok' || !q) return say(stateCard({ kind: r.kind === 'ok' ? 'empty' : 'offline', title: r.kind === 'ok' ? 'এই কুইজটা পাওয়া গেল না' : 'ইশ, নেট হারিয়ে গেছে', text: r.kind === 'ok' ? 'কুইজের তালিকায় ফিরে আরেকটা বেছে নাও।' : 'নেট চালু করে আবার চেষ্টা করো।', action: 'কুইজের তালিকা', onAction: () => ctx.replace('/learn/quiz') }));
    if (!(q.questions || []).length) return say(emptyState('এই কুইজে এখনো প্রশ্ন নেই', 'শিক্ষক প্রশ্ন দিলে খেলতে পারবে।'));
    const play = () => say(player({ title: q.title, questions: q.questions, onDone: finish, onQuit: () => ctx.replace('/learn/quiz') }));
    async function finish(answers) {
      say(loading(1));
      const local = scoreQuiz(q.questions, answers);
      let res = await rpc('submit_quiz', { p_quiz_id: q.id, p_student_id: rec.id, p_answers: answers }), kept = false;
      if (res.kind !== 'ok') {   // net down or server busy: the answers wait on the phone and the stars arrive later
        const k = await outbox.add({ uid: session.uid(), method: 'POST', path: '/rest/v1/rpc/submit_quiz', body: { p_quiz_id: q.id, p_student_id: rec.id, p_answers: answers }, label: 'কুইজের ফল' });
        kept = !!k; if (!k) return say(stateCard({ kind: 'error', title: 'ফল জমা দেওয়া যায়নি', text: 'ইন্টারনেট দেখে আবার চেষ্টা করো। তোমার উত্তর আছে।', action: 'আবার পাঠাও', onAction: () => finish(answers) }));
      }
      const correct = res.kind === 'ok' ? res.data.correct : local.correct, total = res.kind === 'ok' ? res.data.total : local.total, stars = res.kind === 'ok' ? res.data.stars : null;
      if (stars) self.patch({ stars: (self.get()?.stars || 0) + stars });
      let kept2 = false;
      if (local.wrong.length) { const m = await out('POST', '/rest/v1/quiz_mistakes?on_conflict=student_id,q_key', mistakeRows({ quiz: q, questions: q.questions, wrong: local.wrong, coachingId: ctx.me.coaching_id, studentId: rec.id, today: dhakaDay() }), 'resolution=merge-duplicates,return=minimal', 'ভুলের খাতা'); kept2 = m.state === 'queued'; }
      if (dead) return;
      say(h('section', { class: 'de-card st-result', 'aria-live': 'polite' }, window.Diffy ? window.Diffy.make(correct / (total || 1) >= 0.8 ? 'cheering' : 'happy', 'de-mascot--lg') : null,
        h('h2', { class: 'st-result__n', id: 'page-title', tabindex: '-1', text: `${bn(correct)}/${bn(total)} সঠিক` }), h('p', { class: 'de-row__sub', text: quizCheer(correct, total) }),
        stars ? h('span', { class: 'de-sticker de-sticker--sunny' }, h('i', { class: 'de-star' }), bn(`${stars}টা স্টার পেলে!`)) : null,
        res.kind === 'ok' && !stars && correct > 0 ? h('p', { class: 'de-row__sub', text: 'এটা আগে খেলেছ, তাই এবার নতুন স্টার নেই। চেষ্টা চালিয়ে যাও!' }) : null,
        kept ? h('p', { class: 'de-banner de-banner--warn', role: 'status' }, 'নেট নেই। ফল ফোনে রাখা আছে, নেট এলে জমা হবে আর তখন স্টার যোগ হবে।') : null,
        local.wrong.length ? h('p', { class: 'de-row__sub', text: `${bn(local.wrong.length)}টা ভুল ভুলের খাতায় রাখা হয়েছে${kept2 ? ' (নেট এলে যাবে)' : ''}।` }) : null,
        h('div', { class: 'st-actions' }, h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: () => ctx.replace('/learn/quiz'), text: 'কুইজের তালিকা' }),
          local.wrong.length ? h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: () => ctx.go('/learn/mistakes'), text: 'ভুলের খাতা দেখো' }) : null,
          h('button', { class: 'de-btn de-btn--text', type: 'button', onclick: play, text: 'আবার খেলো' }))));
      root.querySelector('#page-title')?.focus({ preventScroll: true });
    }
    play();
  })();
  return { node: root, destroy() { dead = true; } };
}

// ---- mistake notebook ----
export function mistakesPage(ctx) {
  const root = h('div', { class: 'st-page' });
  let dead = false;
  const draw = async () => {
    root.replaceChildren(loading(2));
    const rec = await me();
    if (!rec) return root.replaceChildren(noRecState());
    const r = await sel('quiz_mistakes', `select=q_key,subject,question,box,due,wrong_count&student_id=eq.${rec.id}&order=due`);
    if (dead) return;
    const old = cache.get(session.uid(), 'smist');
    if (r.kind === 'ok') cache.set(session.uid(), 'smist', rows(r));
    else if (!old) return root.replaceChildren(stateCard({ kind: r.kind === 'offline' ? 'offline' : 'error', title: r.kind === 'offline' ? 'ইশ, নেট হারিয়ে গেছে' : 'ইশ, তথ্য আনা যায়নি', text: 'আবার চেষ্টা করো।', action: 'আবার চেষ্টা করো', onAction: draw }));
    const stale = r.kind !== 'ok', all = stale ? old.v : rows(r), today = dhakaDay(), due = dueMistakes(all, today), later = all.filter(m => m.due > today);
    const start = () => {
      const qs = due.map(m => m.question);
      root.replaceChildren(player({ title: 'ভুলের খাতা', questions: qs, onQuit: draw, onDone: async answers => {
        root.replaceChildren(loading(1));
        let right = 0, kept = false;
        for (const [i, m] of due.entries()) {
          const ok = answers[i] === m.question.answer_index; if (ok) right++;
          const f = `student_id=eq.${rec.id}&q_key=eq.${encodeURIComponent(m.q_key)}`, upd = reviewMistake(m, ok, today);
          const w = upd.remove ? await out('DELETE', `/rest/v1/quiz_mistakes?${f}`, undefined, undefined, 'ভুলের খাতা') : await out('PATCH', `/rest/v1/quiz_mistakes?${f}`, { box: upd.box, due: upd.due, wrong_count: upd.wrong_count }, 'return=minimal', 'ভুলের খাতা');
          if (w.state === 'queued') kept = true;
        }
        if (dead) return;
        root.replaceChildren(h('section', { class: 'de-card st-result' }, window.Diffy ? window.Diffy.make(right === due.length ? 'cheering' : 'happy', 'de-mascot--lg') : null,
          h('h2', { class: 'st-result__n', id: 'page-title', tabindex: '-1', text: `${bn(right)}/${bn(due.length)} ঠিক` }),
          h('p', { class: 'de-row__sub', text: right === due.length ? 'সবগুলো ঠিক হয়েছে, দারুণ! এই প্রশ্নগুলো আরও পরে আবার আসবে।' : 'যেগুলো ভুল হলো সেগুলো কাল আবার আসবে। একটু একটু করে সব ঠিক হয়ে যাবে।' }),
          kept ? h('p', { class: 'de-banner de-banner--warn', role: 'status' }, 'নেট নেই। হিসাব ফোনে রাখা আছে, নেট এলে জমা হবে।') : null,
          h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: draw, text: 'ভুলের খাতায় ফিরে যাও' })));
        root.querySelector('#page-title')?.focus({ preventScroll: true });
      } }));
    };
    put(root, stale ? staleBanner(r.kind === 'offline' ? 'offline' : 'error', old.at) : null,
      h('section', { class: 'de-card gx-card' }, h('div', { class: 'gx-stats' }, h('div', { class: 'gx-stat' + (due.length ? ' gx-stat--warn' : ' gx-stat--good') }, h('b', { text: bn(due.length) }), h('span', { text: 'আজ অনুশীলন' })), h('div', { class: 'gx-stat' }, h('b', { text: bn(all.length) }), h('span', { text: 'মোট' })), h('div', { class: 'gx-stat' }, h('b', { text: bn(later.length) }), h('span', { text: 'পরে আসবে' }))),
        due.length ? h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: start, text: 'অনুশীলন শুরু করো' }) : h('p', { class: 'de-row__sub', text: all.length ? 'আজকের অনুশীলন শেষ! পরে আবার এসো।' : 'কোনো ভুল জমা নেই। কুইজে ভুল হলে এখানে আসবে, তখন আবার দেখে নিতে পারবে।' })),
      later.length ? section('পরে আসবে') : null,
      later.length ? h('div', { class: 'de-card more-card' }, ...later.map(m => h('div', { class: 'de-row gx-line' }, h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: bn(m.question.text) }), h('span', { class: 'de-row__sub', text: `${m.subject || ''} · আবার দেখা হবে ${shortDate(Date.parse(m.due + 'T06:00:00Z'))}` }))))) : null,
      h('p', { class: 'de-row__sub gx-note', text: `প্রতিবার ঠিক হলে প্রশ্নটা আরও পরে আসে (${LEITNER.slice(1).map(n => bn(n)).join(', ')} দিন পরে)। পাঁচ ধাপ পার হলে খাতা থেকে বাদ যায়।` }));
  };
  draw();
  return { node: root, destroy() { dead = true; } };
}

// ---- online exams: what is open, what is coming, the results of the ones taken ----
export const examsPage = ctx => studentPage({
  key: 'sex', isEmpty: d => !d.exams.length && !d.attempts.length,
  empty: () => emptyState('এখন কোনো অনলাইন পরীক্ষা নেই', 'শিক্ষক পরীক্ষা দিলে এখানে দেখা যাবে।'),
  load: async () => {
    const [e, a] = await Promise.all([sel('online_exams', 'select=id,title,kind,starts_at,ends_at,duration_minutes&status=eq.published&order=starts_at.desc.nullslast'), sel('exam_attempts', 'select=id,exam_id,score,total,submitted_at,exam:online_exams(title,kind)&order=started_at.desc&limit=30')]);
    const bad = [e, a].find(x => x.kind !== 'ok');
    return bad ? { kind: bad.kind } : { kind: 'ok', data: { exams: rows(e), attempts: rows(a) } };
  },
  draw: ({ exams, attempts }) => {
    const taken = new Set(attempts.filter(a => a.submitted_at).map(a => a.exam_id)), now = Date.now();
    const state = x => (x.kind === 'live' && taken.has(x.id) ? 'taken' : examWindow(x, now));
    const open = exams.filter(x => state(x) === 'open'), soon = exams.filter(x => state(x) === 'soon');
    const intro = x => openSheet({ title: x.title, content: h('div', { class: 'sheet-col' },
      h('p', { class: 'sheet-text', text: `সময় ${bn(x.duration_minutes)} মিনিট। একবার জমা দিলে আর বদলানো যায় না।` }),
      h('p', { class: 'sheet-text', text: 'পরীক্ষার সময় অন্য অ্যাপ বা ট্যাবে গেলে সেটা শিক্ষকের কাছে লেখা থাকে। তাই শেষ না হওয়া পর্যন্ত এখানেই থেকো।' }),
      h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: () => { document.querySelector('.de-sheet')?.remove(); document.querySelector('.de-sheet-scrim')?.remove(); ctx.go('/exam/' + x.id); }, text: 'শুরু করো' })) });
    const when = x => (x.kind === 'practice' ? 'যেকোনো সময়' : `${shortDate(Date.parse(x.starts_at))} · ${bn(x.duration_minutes)} মিনিট`);
    const row = x => h('div', { class: 'de-row gx-line' }, h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: x.title }), h('span', { class: 'de-row__sub', text: `${x.kind === 'practice' ? 'অনুশীলন' : 'নির্দিষ্ট সময়ের পরীক্ষা'} · ${when(x)}` })),
      state(x) === 'open' ? h('button', { class: 'de-btn de-btn--primary st-go', type: 'button', onclick: () => intro(x), text: 'শুরু করো' }) : h('span', { class: 'de-chip de-chip--plain', text: state(x) === 'soon' ? 'শুরু হয়নি' : state(x) === 'taken' ? 'দেওয়া হয়েছে' : 'শেষ' }));
    return [open.length ? section('এখন দিতে পারো') : null, open.length ? h('div', { class: 'de-card more-card' }, ...open.map(row)) : emptyState('এখন দেওয়ার মতো পরীক্ষা নেই', 'নতুন পরীক্ষা এলে এখানে দেখা যাবে।'),
      soon.length ? section('আসছে') : null, soon.length ? h('div', { class: 'de-card more-card' }, ...soon.map(row)) : null,
      attempts.some(a => a.submitted_at) ? section('আমার ফল') : null,
      attempts.some(a => a.submitted_at) ? h('div', { class: 'de-card more-card' }, ...attempts.filter(a => a.submitted_at).map(a => { const r = attemptResult(a); return h('div', { class: 'de-row gx-line' }, h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: a.exam?.title || 'পরীক্ষা' }), h('span', { class: 'de-row__sub', text: shortDate(a.submitted_at) })), h('b', { class: 'gx-score', text: `${bn(r.score)}/${bn(r.total)}` })); })) : null];
  },
});

// ---- merit list: only when the flag is on; the server shows a child only if that child's merit_list consent is on, and always the child's own row ----
export function meritPage(ctx) {
  if (!flags.on('merit_list')) return { node: emptyState('এই পাতা এখন বন্ধ', 'মেধা তালিকা এখনো চালু হয়নি।', h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: () => ctx.replace('/study'), text: 'পড়ায় ফিরে যাও' })) };
  const box = h('div', { class: 'st-page' });
  const showExam = async examId => {
    box.replaceChildren(loading(2));
    const r = await rpc('merit_list', { p_exam: examId, p_top: 20 });
    if (r.kind !== 'ok') return box.replaceChildren(emptyState('তালিকা আনা যায়নি', 'একটু পরে আবার চেষ্টা করো।'));
    const list = r.data || [];
    box.replaceChildren(h('p', { class: 'de-row__sub gx-note', text: 'শুধু যাদের নাম দেখানোর অনুমতি আছে তাদের নাম এখানে আসে। তোমার নিজের নম্বর সবসময় তুমি দেখতে পাবে।' }),
      list.length ? h('div', { class: 'de-card more-card' }, ...list.map(x => h('div', { class: 'de-row gx-line' + (x.is_me ? ' st-me' : '') }, h('span', { class: 'gx-slot', 'aria-hidden': 'true', text: bn(x.rank) }), h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: x.is_me ? `${x.full_name} (তুমি)` : x.full_name })), h('b', { class: 'gx-score', text: bn(x.obtained) })))) : emptyState('এখনো কোনো নাম নেই', 'নম্বর দেওয়া হলে এখানে দেখা যাবে।'),
      h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: () => draw(), text: 'অন্য পরীক্ষা' }));
  };
  const page = studentPage({ key: 'smerit', load: rec => sel('marks', `select=exam:exams(id,title,exam_date,subject:subjects(name))&student_id=eq.${rec.id}`).then(r => wrap(r, l => l.filter(m => m.exam))), isEmpty: l => !l.length,
    empty: () => emptyState('এখনো কোনো পরীক্ষার ফল নেই', 'নম্বর দেওয়া হলে মেধা তালিকা দেখতে পারবে।'),
    draw: list => h('div', { class: 'de-card more-card' }, ...list.map(m => navRow({ ic: 'trophy', text: `${m.exam.subject?.name ? m.exam.subject.name + ': ' : ''}${m.exam.title}`, onclick: () => showExam(m.exam.id) }))) });
  const draw = () => box.replaceChildren(page.node);
  draw();
  return { node: box, destroy: () => page.destroy() };
}

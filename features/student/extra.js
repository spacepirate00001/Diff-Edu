// The smaller student features of the plan: ফ্ল্যাশকার্ড, প্রশ্ন বক্স (doubts), ফোকাস টাইমার, কুইজ ডুয়েল, ডিফি page. Live contracts only: table flashcards, table doubts
// (the class sees the question, never who asked), rpc log_focus (25 minutes = 1 star, at most 4 a day), quiz_duels + create_duel / submit_duel (own class, 5 a day).
import { h } from '../../ui/dom.js';
import { chip, chipRow } from '../../ui/chip.js';
import { emptyState, loading, stateCard } from '../../ui/states.js';
import { openSheet } from '../../ui/sheet.js';
import { toast } from '../../ui/toast.js';
import { saveBar } from '../../ui/savebar.js';
import { sel, rpc, rows } from '../../core/api.js';
import { outbox } from '../../core/outbox-app.js';
import { session } from '../../core/session.js';
import { self } from '../../core/student-self.js';
import { bn, uuid, shortDate } from '../../core/bn.js';
import { me, put, studentPage, wrap, section, progressCard, noRecState } from './common.js';
import { classAtLeast, TEAM_FROM } from './logic.js';
import { player } from './player.js';

// ---- flashcards ----
export const flashPage = () => studentPage({
  key: 'sflash', load: rec => sel('flashcards', `select=id,subject,chapter_name,front,back&class_level=eq.${rec.class_level}&order=created_at`).then(r => wrap(r)), isEmpty: l => !l.length,
  empty: () => emptyState('এই ক্লাসের ফ্ল্যাশকার্ড এখনো নেই', 'শিক্ষক কার্ড যোগ করলে এখানে দেখা যাবে।'),
  draw: cards => {
    const subjects = [...new Set(cards.map(c => c.subject))], box = h('div', { class: 'st-page' });
    let subj = subjects[0], i = 0, flip = false;
    const paint = () => {
      const list = cards.filter(c => c.subject === subj), c = list[i];
      put(box, subjects.length > 1 ? chipRow('বিষয়', subjects.map(s => chip(s, s === subj, () => { subj = s; i = 0; flip = false; paint(); }))) : null,
        h('p', { class: 'de-row__sub st-center', text: bn(`${i + 1}/${list.length}${c.chapter_name ? ' · ' + c.chapter_name : ''}`) }),
        h('button', { class: 'de-card st-flash' + (flip ? ' is-back' : ''), type: 'button', 'aria-label': flip ? `উত্তর: ${c.back}. চাপলে প্রশ্ন দেখাবে` : `প্রশ্ন: ${c.front}. চাপলে উত্তর দেখাবে`, onclick: () => { flip = !flip; paint(); } },
          h('span', { class: 'de-row__sub', text: (flip ? 'উত্তর' : 'প্রশ্ন') + ' · চাপলে উল্টাবে' }), h('b', { class: 'st-flash__t', text: flip ? c.back : c.front })),
        h('div', { class: 'st-actions' }, h('button', { class: 'de-btn de-btn--secondary', type: 'button', disabled: i === 0, onclick: () => { i--; flip = false; paint(); }, text: '‹ আগের' }),
          h('button', { class: 'de-btn de-btn--primary', type: 'button', disabled: i >= list.length - 1, onclick: () => { i++; flip = false; paint(); }, text: 'পরের ›' })));
    };
    paint();
    return box;
  },
});

// ---- doubt box ----
export const doubtsPage = ctx => studentPage({
  key: 'sdoubt', load: rec => sel('doubts', `select=id,class_level,subject,body,answer,created_at&class_level=eq.${rec.class_level}&hidden=is.false&order=created_at.desc&limit=60`).then(r => wrap(r)),
  isEmpty: () => false, empty: () => null,
  draw: (list, go) => {
    const rec = self.get(), subject = h('input', { class: 'de-field__input', maxlength: '40', 'aria-label': 'বিষয়', placeholder: 'বিষয় (যেমন: গণিত)' }), body = h('textarea', { class: 'de-field__input chat-box', rows: '3', maxlength: '500', 'aria-label': 'তোমার প্রশ্ন', placeholder: 'কী বুঝতে পারছ না?' });
    const send = h('button', { class: 'de-btn de-btn--primary', type: 'button', text: 'পাঠাও', onclick: async () => {
      if (!subject.value.trim() || !body.value.trim()) return toast('বিষয় আর প্রশ্ন দুটোই লেখো।');
      send.disabled = true;
      const r = await outbox.submit({ uid: session.uid(), method: 'POST', path: '/rest/v1/doubts', body: { id: uuid(), coaching_id: ctx.me.coaching_id, student_id: rec.id, class_level: rec.class_level, subject: subject.value.trim(), body: body.value.trim() }, prefer: 'return=minimal', label: 'প্রশ্ন বক্স' });
      send.disabled = false; saveBar.show(r.state === 'rejected' ? 'failed' : r.state);
      if (r.state === 'saved') { toast('পাঠানো হয়েছে। স্যার দেখবেন।'); go(); } else if (r.state === 'queued') { subject.value = body.value = ''; }
    } });
    return [h('section', { class: 'de-card gx-card' }, h('h3', { class: 'gx-h3', text: 'নতুন প্রশ্ন' }), subject, body, send, h('p', { class: 'de-row__sub', text: 'ক্লাসের অন্যরা প্রশ্নটা দেখবে, কিন্তু তোমার নাম কেউ দেখবে না।' })),
      list.length ? section('ক্লাসের প্রশ্ন') : emptyState('এখনো কোনো প্রশ্ন নেই', 'প্রথম প্রশ্নটা তুমিই করো, ভালো প্রশ্ন সবার কাজে লাগে।'),
      ...list.map(d => h('section', { class: 'de-card gx-card' }, h('span', { class: 'de-row__sub', text: `${d.subject} · ${shortDate(d.created_at)}` }), h('h3', { class: 'gx-h3', text: d.body }),
        d.answer ? h('p', { class: 'de-row__title' }, 'উত্তর: ', d.answer) : h('span', { class: 'de-chip de-chip--plain', text: 'স্যারের উত্তরের অপেক্ষা' })))];
  },
});

// ---- focus timer: 25 minutes, one star (the server counts at most 4 a day). The clock is the phone's own; leaving the page stops it. ----
export function focusPage() {
  const root = h('div', { class: 'st-page' }), MIN = 25;
  let dead = false, tick = null;
  const show = () => {
    clearInterval(tick);
    put(root, h('section', { class: 'de-card st-result' }, h('h2', { class: 'st-result__n', text: bn(`${MIN}:০০`) }), h('p', { class: 'de-row__sub', text: `${bn(MIN)} মিনিট ফোন সরিয়ে একটানা পড়ো। শেষ হলে ১টা স্টার পাবে (দিনে সর্বোচ্চ ৪টা)।` }),
      h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: start, text: 'শুরু করো' })));
  };
  const start = () => {
    const end = Date.now() + MIN * 60e3, left = h('h2', { class: 'st-result__n', 'aria-live': 'off' });
    const paint = () => { const s = Math.max(0, Math.round((end - Date.now()) / 1000)); left.textContent = bn(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`); if (!s) finish(); };
    put(root, h('section', { class: 'de-card st-result' }, left, h('p', { class: 'de-row__sub', text: 'মন দিয়ে পড়ো, আমি গুনছি।' }), h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: show, text: 'এখন থাক' })));
    tick = setInterval(paint, 1000); paint();
  };
  const finish = async () => {
    clearInterval(tick);
    const rec = await me();
    if (!rec || dead) return;
    const r = await rpc('log_focus', { p_student_id: rec.id, p_minutes: MIN });
    if (dead) return;
    put(root, h('section', { class: 'de-card st-result' }, window.Diffy ? window.Diffy.make('cheering', 'de-mascot--lg') : null, h('h2', { class: 'st-result__n', text: 'দারুণ, শেষ করেছ!' }),
      h('p', { class: r.kind === 'ok' ? 'de-row__sub' : 'de-banner de-banner--warn', role: 'status', text: r.kind === 'ok' ? (r.data?.star ? 'একটা স্টার পেলে!' : 'আজকের স্টার সীমা পূর্ণ, তবু অভ্যাসটা জমা হলো।') : 'নেট নেই, তাই স্টার জমা হয়নি। পড়াটা কিন্তু হয়ে গেছে!' }),
      h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: show, text: 'আবার' })));
  };
  show();
  return { node: root, destroy() { dead = true; clearInterval(tick); } };
}

// ---- quiz duel (class 5 and up, own class only) ----
export function duelPage() {
  const root = h('div', { class: 'st-page' });
  let dead = false;
  const draw = async () => {
    put(root, loading(2));
    const rec = await me();
    if (!rec) return put(root, noRecState());
    if (!classAtLeast(rec.class_level, TEAM_FROM)) return put(root, progressCard(rec), emptyState('কুইজ ডুয়েল ৫ম শ্রেণি থেকে', 'ততদিন কুইজ খেলে স্টার জমাও।'));
    const d = await sel('quiz_duels', `select=id,quiz_title,subject,questions,challenger_id,opponent_id,challenger_name,opponent_name,challenger_score,opponent_score,created_at&or=(challenger_id.eq.${rec.id},opponent_id.eq.${rec.id})&order=created_at.desc&limit=30`);
    if (dead) return;
    if (d.kind !== 'ok') return put(root, stateCard({ kind: d.kind === 'offline' ? 'offline' : 'error', title: d.kind === 'offline' ? 'ইশ, নেট হারিয়ে গেছে' : 'ইশ, তথ্য আনা যায়নি', text: 'আবার চেষ্টা করো।', action: 'আবার চেষ্টা করো', onAction: draw }));
    const list = rows(d);
    const play = x => put(root, player({ title: x.quiz_title, questions: x.questions, onQuit: draw, onDone: async answers => {
      put(root, loading(1));
      const r = await rpc('submit_duel', { p_duel_id: x.id, p_student_id: rec.id, p_answers: answers });
      toast(r.kind === 'ok' ? `${bn(r.data.score)}/${bn(r.data.total)} সঠিক` : r.kind === 'offline' ? 'নেট নেই, আবার চেষ্টা করো।' : 'জমা হয়নি, আবার চেষ্টা করো।'); draw();
    } }));
    const create = async () => {
      const [m, q] = await Promise.all([rpc('class_mates', { p_student_id: rec.id }), sel('quizzes', `select=id,title&class_level=eq.${rec.class_level}`)]);
      const mates = m.kind === 'ok' ? m.data || [] : [], qs = rows(q);
      if (!mates.length || !qs.length) return toast(!mates.length ? 'ক্লাসে এখন আর কেউ নেই।' : 'এখন কোনো কুইজ নেই।');
      let who = mates[0].student_id, quiz = qs[0].id;
      const pickList = (items, get, set) => h('div', { class: 'opt-list' }, ...items.map(it => h('button', { class: 'opt', type: 'button', 'aria-pressed': 'false', onclick: e => { set(it); [...e.currentTarget.parentNode.children].forEach(b => b.classList.toggle('is-on', b === e.currentTarget)); } }, h('span', { class: 'opt__t', text: get(it) }))));
      const sheet = openSheet({ title: 'নতুন ডুয়েল', content: h('div', { class: 'sheet-col' }, h('p', { class: 'sheet-text', text: 'বন্ধু বেছে নাও' }), pickList(mates, x => x.display_name, x => { who = x.student_id; }), h('p', { class: 'sheet-text', text: 'কুইজ বেছে নাও' }), pickList(qs, x => x.title, x => { quiz = x.id; }),
        h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: async () => { sheet.close(); const r = await rpc('create_duel', { p_student_id: rec.id, p_opponent_id: who, p_quiz_id: quiz }); toast(r.kind === 'ok' ? 'চ্যালেঞ্জ পাঠানো হয়েছে!' : /too many/.test(r.data?.message || '') ? 'আজ আর ডুয়েল হবে না, কাল আবার।' : 'এখন হলো না, আবার চেষ্টা করো।'); draw(); }, text: 'চ্যালেঞ্জ পাঠাও' })) });
    };
    put(root, progressCard(rec), h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: create, text: 'নতুন ডুয়েল' }),
      list.length ? list.map(x => { const iAmC = x.challenger_id === rec.id, mine = iAmC ? x.challenger_score : x.opponent_score, theirs = iAmC ? x.opponent_score : x.challenger_score, other = iAmC ? x.opponent_name : x.challenger_name;
        return h('section', { class: 'de-card gx-card' }, h('span', { class: 'de-row__sub', text: `${x.subject} · ${shortDate(x.created_at)}` }), h('h3', { class: 'gx-h3', text: `${x.quiz_title} · ${other}-এর সাথে` }),
          mine == null ? h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: () => play(x), text: 'এখন খেলো' }) : h('p', { class: 'de-row__title', text: theirs == null ? `তুমি ${bn(mine)} · ${other}-এর অপেক্ষা` : `তুমি ${bn(mine)} · ${other} ${bn(theirs)} — ${mine > theirs ? 'তুমি জিতেছ!' : mine < theirs ? 'পরের বার আরও ভালো হবে!' : 'সমান সমান!'}` })); })
        : emptyState('এখনো কোনো ডুয়েল নেই', 'একজন বন্ধুকে চ্যালেঞ্জ করো, একই পাঁচটা প্রশ্ন, যে যখন সময় পায় খেলবে।'),
      h('p', { class: 'de-row__sub gx-note', text: 'ডুয়েল শুধু নিজের ক্লাসের বন্ধুর সাথে, দিনে সর্বোচ্চ ৫টা।' }));
  };
  draw();
  return { node: root, destroy() { dead = true; } };
}

// ---- ডিফি page: the same sheet as on "আজ", behind the same flag (diffy_chat) ----
export function diffyPage(ctx) {
  const root = h('div', { class: 'st-page' });
  import('../diffy/diffy-chat.js').then(m => {
    const on = m.diffyAvailable();
    put(root, h('section', { class: 'de-card st-result' }, window.Diffy ? window.Diffy.make('happy', 'de-mascot--lg') : null, h('h2', { class: 'st-result__n', text: 'ডিফি' }),
      h('p', { class: 'de-row__sub', text: on ? 'পড়ার যেকোনো প্রশ্ন জিজ্ঞেস করো, ধাপে ধাপে বুঝিয়ে দেব। দিনে ২০টা প্রশ্ন করা যায়। বুঝতে না পারলে শিক্ষককে পাঠাতে পারবে।' : 'ডিফির সাথে কথা বলার সুবিধা এখনো চালু হয়নি। চালু হলে এখানে পড়ার প্রশ্ন করতে পারবে। ততদিন "প্রশ্ন বক্সে" শিক্ষককে জিজ্ঞেস করো।' }),
      on ? h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: () => m.openDiffy({ ctx, kid: self.get(), student: true }), text: 'ডিফিকে জিজ্ঞেস করো' }) : h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: () => ctx.go('/learn/doubts'), text: 'প্রশ্ন বক্সে যাও' })));
  });
  return { node: root };
}

// The student's rules, pure (tested in tests/student.test.mjs). Every rule here copies what the server or the live PWA already does:
// quiz stars (submit_quiz, all.sql), the mistake notebook boxes (play.js LEITNER), exam windows (52-online-exam.sql), tournament / team / chat class limits
// (42, 43, 46), game points and hours (44-games.sql). The server is the judge; this file only shows the same answer first and hides what the server would refuse.
import { bn } from '../../core/bn.js';

// ---- quizzes ----
// questions: [{ text, options, answer_index }], answers: [chosen index per question]. Same count as the server: a question is right when the index matches.
export function scoreQuiz(questions, answers) {
  const wrong = [];
  let correct = 0;
  questions.forEach((q, i) => { if (answers[i] === q.answer_index) correct++; else wrong.push(i); });
  return { correct, total: questions.length, wrong };
}
// submit_quiz: one star per right answer, at most 10, and only the FIRST time the quiz is played (a repeat cannot farm stars).
export const quizStars = (correct, firstTry) => (firstTry && correct > 0 ? Math.min(correct, 10) : 0);
// The kind line under the result: never a bad word, always a next step.
export function quizCheer(correct, total) {
  if (!total) return '';
  const r = correct / total;
  return r === 1 ? 'সবগুলো ঠিক! দারুণ!' : r >= 0.8 ? 'খুব ভালো করেছ!' : r >= 0.5 ? 'ভালো চেষ্টা! ভুলগুলো ভুল শুধরে নেওয়ার খাতায় রাখা আছে, পরে আবার দেখে নিও।' : 'চেষ্টা করেছ, এটাই আসল। ভুলগুলো শুধরে নেওয়ার খাতায় আছে, একটু একটু করে ঠিক করে নেব।';
}

// ---- mistake notebook (live rule, play.js: boxes 1..5, review after 1, 2, 4, 7, 14 days; a right answer in box 5 removes the question) ----
export const LEITNER = [0, 1, 2, 4, 7, 14];
export const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
// Rows to upsert (on student_id,q_key) for the wrong answers of one quiz.
export function mistakeRows({ quiz, questions, wrong, coachingId, studentId, today }) {
  return wrong.map(i => ({ coaching_id: coachingId, student_id: studentId, q_key: `${quiz.id}:${i}`, subject: quiz.subject?.name || '', question: questions[i], box: 1, due: today }));
}
export const dueMistakes = (all, today) => all.filter(m => m.due <= today);
// What happens to one mistake after an answer. -> { remove: true } | { box, due, wrong_count }
export function reviewMistake(m, right, today) {
  if (right && m.box >= 5) return { remove: true };
  const box = right ? m.box + 1 : 1;
  return { box, due: addDays(today, LEITNER[box]), wrong_count: m.wrong_count + (right ? 0 : 1) };
}

// ---- online exams (52-online-exam.sql) ----
// exam: { kind: 'live'|'practice', starts_at, ends_at }. -> 'open' | 'soon' | 'closed'
export function examWindow(exam, now = Date.now()) {
  if (exam.kind === 'practice') return 'open';
  const a = Date.parse(exam.starts_at), b = Date.parse(exam.ends_at);
  return now < a ? 'soon' : now > b ? 'closed' : 'open';
}
// The words for a refused start_exam (HTTP status from PostgREST). Kind, with a next step, never a code.
export function examStartMessage(status) {
  if (status === 409) return 'এই পরীক্ষা তুমি আগেই দিয়েছ। ফল দেখতে "পরীক্ষার ফল" খুলো।';
  if (status === 403) return 'এই পরীক্ষা এখন তোমার জন্য খোলা নেই।';
  if (status === 404) return 'পরীক্ষাটা এখন খোলা নেই। সময় দেখে আবার এসো।';
  if (status === 400) return 'আজকের বা এই মাসের পরীক্ষার সীমা শেষ। পরে আবার চেষ্টা করো, বা শিক্ষককে জানাও।';
  return 'পরীক্ষা এখন খোলা যাচ্ছে না। ইন্টারনেট দেখে আবার চেষ্টা করো।';
}
// An attempt row -> what the result card shows.
export function attemptResult(a) {
  if (!a || !a.submitted_at) return null;
  const total = a.total || 0, score = a.score || 0;
  return { score, total, pct: total ? Math.round(100 * score / total) : null };
}

// ---- weekly tournament (42-weekly-tournament.sql): class 5 and up, the board is the approved entries in the order they came ----
export const TOURNAMENT_FROM = 5, TEAM_FROM = 5, CHAT_FROM = 5, TEAM_MAX = 6;
export const classAtLeast = (level, from) => Number(level) >= from;
export const ENTRY_LABEL = { pending: ['স্যার দেখবেন', 'plain'], approved: ['স্টার পেয়েছ!', 'good'], rejected: ['আবার চেষ্টা করো', 'warn'] };

// ---- teams (43-battle-own-class.sql): only the child's own class, at most 6 in a team, a team name is picked from the list ----
export const teamIsFull = n => n >= TEAM_MAX;
// Everything the team screen needs to decide, from the three tables the child may read.
export function teamView({ me, teams, members, pending }) {
  const mine = members.find(m => m.student_id === me), team = mine ? teams.find(t => t.id === mine.team_id) : null;
  return {
    team, isLead: !!team && team.lead_id === me,
    mates: team ? members.filter(m => m.team_id === team.id) : [],
    invites: pending.filter(r => r.via === 'invite'),
    asked: new Set(pending.filter(r => r.via === 'request').map(r => r.team_id)),
    countOf: id => members.filter(m => m.team_id === id).length,
  };
}
// Words for a refused team call (the server's exception text).
export function teamError(text) {
  const t = String(text || '');
  if (/full/.test(t)) return 'দল ভর্তি (৬ জন)।';
  if (/already in a team|already/.test(t)) return 'তুমি বা বন্ধু আগেই একটা দলে আছে।';
  if (/class/.test(t)) return 'দল শুধু নিজের ক্লাসের বন্ধুদের নিয়ে।';
  return 'এখন হয়নি। একটু পরে আবার চেষ্টা করো।';
}

// ---- games (44-games.sql and pwa-dev/games.js): 10 points per right answer, +20 for a perfect round, 30 minutes a day, open from 6:00 to 22:00 Dhaka ----
export const DAILY_SECONDS = 1800, ROUND_SECONDS = 60, MAX_SECONDS = 300, OPEN_FROM = 6, CLOSE_HOUR = 22;
export const GAME_RULES = {
  math_race: ['ম্যাথ রেস', '৬০ সেকেন্ডে যত পারো যোগ-বিয়োগ করো।'],
  word_match: ['শব্দ মিলানো', 'বাংলা শব্দের ইংরেজি অর্থ বেছে নাও।'],
  spelling_b: ['বানান বি', 'বাংলা অর্থ দেখে ঠিক বানানটি বেছে নাও।'],
  memory_pairs: ['জোড়া কার্ড', 'দুটি করে কার্ড উল্টে একই ছবির জোড়া মেলাও।'],
  sequence: ['সঠিক ক্রমে সাজানো', 'কথাগুলো ঠিক ক্রমে একের পর এক ট্যাপ করো।'],
};
export const GameLogic = {
  points: (correct, total) => correct * 10 + (total > 0 && correct === total ? 20 : 0),
  isOpen: dhakaHour => dhakaHour >= OPEN_FROM && dhakaHour < CLOSE_HOUR,        // the server refuses before 6:00 as well (games_closed)
  secondsLeft: used => Math.max(0, DAILY_SECONDS - used),
  clampSeconds: ms => Math.min(MAX_SECONDS, Math.max(1, Math.round(ms / 1000))),
  mathQuestion(rnd) {
    let a = 2 + Math.floor(rnd() * 19), b = 2 + Math.floor(rnd() * 19);
    if (rnd() < 0.5) return { a, b, op: '+', ans: a + b };
    if (b > a) [a, b] = [b, a];
    return { a, b, op: '−', ans: a - b };
  },
  countRight: (expected, given) => expected.reduce((n, x, i) => n + (given[i] === x ? 1 : 0), 0),
  isPair: (deck, i, j) => i !== j && deck[i] === deck[j],
  shuffle(arr, rnd) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
};
export function gameError(text) {
  const t = String(text || '');
  if (/games_closed/.test(t)) return 'খেলা সকাল ৬টা থেকে রাত ১০টা পর্যন্ত। কাল আবার খেলো।';
  if (/daily_limit/.test(t)) return 'আজকের খেলার সময় (৩০ মিনিট) শেষ। কাল আবার খেলো।';
  return 'স্কোর জমা দেওয়া যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করো।';
}

// ---- profile decor (45-profile-decor.sql): at most 6 stickers, no repeats; only owned items can be placed ----
export const DECOR_KINDS = [['mascot', 'মাসকট'], ['frame', 'ফ্রেম'], ['backdrop', 'পেছনের রং']];
export const MAX_STICKERS = 6;
export function toggleSticker(placed, key) {
  if (placed.includes(key)) return { placed: placed.filter(k => k !== key) };
  if (placed.length >= MAX_STICKERS) return { placed, full: true };
  return { placed: [...placed, key] };
}
// The points shop of the live app (fun.sql shop_price): avatars and header colours paid in stars.
export const SHOP = [['av_cat', 'avatar', '🐱', 'বিড়াল', 10], ['av_tiger', 'avatar', '🐯', 'বাঘ', 15], ['av_owl', 'avatar', '🦉', 'পেঁচা', 20], ['av_rocket', 'avatar', '🚀', 'রকেট', 25],
  ['av_robot', 'avatar', '🤖', 'রোবট', 30], ['av_unicorn', 'avatar', '🦄', 'ইউনিকর্ন', 40], ['av_crown', 'avatar', '👑', 'মুকুট', 60]];
export const shopItem = k => SHOP.find(s => s[0] === k) || null;
export const canAfford = (stars, key) => !!shopItem(key) && stars >= shopItem(key)[4];

// ---- chat (40/41/46): ready phrases and stickers only, class 5 and up, own class; a report has a fixed reason ----
export const CHAT_REASONS = { rude: 'খারাপ কথা', unsafe: 'বিপজ্জনক', personal_info: 'ব্যক্তিগত তথ্য', other: 'অন্য কিছু' };
export const chatError = text => (/not allowed|closed|chat/.test(String(text || '')) ? 'এখন চ্যাট বন্ধ। ক্লাসের সময়ে আর রাত ১০টার পরে চ্যাট বন্ধ থাকে।' : 'পাঠানো যায়নি। একটু পরে আবার চেষ্টা করো।');

// ---- "আমার অগ্রগতি" (shown first on every competitive screen) ----
// Next star milestone and how far along the child is. A child with no stars gets a kind start line, never a rank.
export const STAR_STEPS = [10, 25, 50, 100, 200, 500];
export function starProgress(stars) {
  const next = STAR_STEPS.find(s => s > stars) ?? null, prev = [...STAR_STEPS].reverse().find(s => s <= stars) ?? 0;
  return { stars, next, ratio: next ? (stars - prev) / (next - prev) : 1, left: next ? next - stars : 0 };
}
export const progressLine = stars => {
  const p = starProgress(stars);
  return !stars ? 'প্রথম স্টার পেতে একটা কুইজ খেলো।' : p.next ? `আর ${bn(p.left)}টা স্টার পেলে ${bn(p.next)}টা হবে!` : 'অনেক স্টার জমিয়েছ, দারুণ!';
};
// Class board: only the top 10 are listed (first name + stars, exactly what class_leaderboard returns). The child's own place is shown privately as "how many stars
// to the next step", never as a rank among the last ones.
export function boardView(list, meId) {
  const i = list.findIndex(r => r.student_id === meId), mine = i >= 0 ? list[i] : null, above = i > 0 ? list[i - 1] : null;
  return { me: mine, inTop: i >= 0 && i < 10, gap: mine && above ? Math.max(1, above.stars - mine.stars + 1) : 0, rows: list.slice(0, 10).map((r, k) => ({ ...r, rank: k + 1, mine: r.student_id === meId })) };
}
// Sent by the "ডিফিকে জিজ্ঞেস" hand-off: one doubt row for the teacher (table doubts, student policy "student asks doubt"). Subject "ডিফি", at most 500 characters.
export function diffyDoubtRow({ coachingId, studentId, classLevel, question }) {
  return { coaching_id: coachingId, student_id: studentId, class_level: classLevel, subject: 'ডিফি', body: `ডিফির উত্তরটা বুঝিনি। প্রশ্ন: ${question}`.slice(0, 500) };
}

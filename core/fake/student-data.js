// Fake tables and calls for the student screens (fake mode only, ?fake=student). Shapes follow the real contracts:
// quizzes / submit_quiz / quiz_mistakes (all.sql, content.sql), class_leaderboard, weekly_tournament_board (42), teams (43), game_sessions (44),
// sticker_catalog / student_decor (45), chat (46, 41), online_exams / exam_attempts (52), merit_list (53), doubts (classroom.sql).
// table(t, q, method, body) / rpc(name, body) return { status, data } or null when the route is not one of these. State lives in mem (per page load).
import { dhakaDay } from '../bn.js';

const ok = (data, status = 200) => ({ status, data });
const bad = (message, status = 400) => ({ status, data: { message } });
const eqv = (q, k) => { const v = q.get(k); return v && v.startsWith('eq.') ? v.slice(3) : null; };
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const SELF = 'k1';

const Q = (text, options, answer_index) => ({ text, options, answer_index });
const QUIZZES = [
  { id: 'qz1', title: 'ভগ্নাংশের কুইজ', subject: { name: 'গণিত' }, questions: [
    Q('১/২ + ১/২ কত?', ['১', '২', '১/৪'], 0), Q('৩/৪ এর হর কত?', ['৩', '৪', '৭'], 1), Q('১/৪ আর ২/৮ কি সমান?', ['হ্যাঁ', 'না', 'বলা যায় না'], 0), Q('সবচেয়ে বড় ভগ্নাংশ কোনটি?', ['১/২', '১/৩', '১/৪'], 0), Q('১/৫ এর সমান ভগ্নাংশ কোনটি?', ['২/১০', '২/৫', '১/১০'], 0)] },
  { id: 'qz2', title: 'বিশেষ্য চেনো', subject: { name: 'বাংলা' }, questions: [
    Q('"কুষ্টিয়া" কোন ধরনের শব্দ?', ['বিশেষ্য', 'ক্রিয়া', 'বিশেষণ'], 0), Q('"সুন্দর" কোন ধরনের শব্দ?', ['বিশেষ্য', 'বিশেষণ', 'সর্বনাম'], 1), Q('নিচের কোনটি বিশেষ্য?', ['দৌড়ানো', 'রহিম', 'লাল'], 1)] },
  { id: 'qz3', title: 'Tense', subject: { name: 'ইংরেজি' }, questions: [
    Q('I ___ rice every day. (eat/ate)', ['eat', 'ate'], 0), Q('She ___ to school yesterday.', ['go', 'went', 'will go'], 1), Q('Future tense কোনটি?', ['I will play', 'I played', 'I play'], 0), Q('"He is reading" কোন tense?', ['Present continuous', 'Past', 'Future'], 0)] },
];
const CHAPTERS = [['গণিত', ['ভগ্নাংশ', 'দশমিক', 'অনুপাত', 'জ্যামিতি']], ['বাংলা', ['বিশেষ্য', 'সর্বনাম', 'রচনা']], ['ইংরেজি', ['Tense', 'Articles']], ['বিজ্ঞান', ['পদার্থের অবস্থা', 'উদ্ভিদ']]]
  .flatMap(([subject, list], si) => list.map((title, i) => ({ id: `c${si}${i}`, class_level: 6, subject, number: i + 1, title, pages: `${10 + i * 8}–${17 + i * 8}`, status: si === 0 && i < 2 ? 'done' : si === 0 && i === 2 ? 'doing' : 'todo', done_on: null })));
const NAMES = ['সুমাইয়া', 'রাহাত', 'নুসরাত', 'আরিফ', 'মীম', 'তানভীর', 'ইসরাত', 'সাদিয়া'];
const CATALOG = [['m_fox', 'mascot', 'শিয়াল', '🦊', 20], ['m_robot', 'mascot', 'রোবট', '🤖', 25], ['m_owl', 'mascot', 'পেঁচা', '🦉', 20], ['f_gold', 'frame', 'সোনালি ফ্রেম', '🖼️', 15], ['f_sky', 'frame', 'আকাশি ফ্রেম', '🟦', 15],
  ['b_sky', 'backdrop', 'আকাশ', '🌤️', 15], ['b_forest', 'backdrop', 'বন', '🌳', 15], ['s_star', 'sticker', 'তারা', '⭐', 10], ['s_rocket', 'sticker', 'রকেট', '🚀', 10], ['s_book', 'sticker', 'বই', '📚', 10]]
  .map(([key, kind, label, emoji, stars_price]) => ({ key, kind, label, emoji, stars_price }));
const PHRASES = [['p1', 'phrase', 'হ্যালো'], ['p2', 'phrase', 'ধন্যবাদ'], ['p3', 'phrase', 'দারুণ!'], ['p4', 'phrase', 'একটু সাহায্য করবে?'], ['p5', 'phrase', 'আমি পরে বলছি'], ['p6', 'sticker', '⭐ তারা'], ['p7', 'sticker', '😊 খুশি']]
  .map(([id, kind, label]) => ({ id, kind, label }));
const TEAM_NAMES = ['সূর্যতারা', 'নীল আকাশ', 'সবুজ পাতা', 'রামধনু', 'জোনাকি', 'বাঘের থাবা'];

const PRACTICE = [
  { id: 'pq1', subject: 'গণিত', chapter_name: 'ভগ্নাংশ', body: '১/২ + ১/৪ = কত?', options: ['৩/৪', '২/৬', '১/৬', '২/৪'], answer: '৩/৪' },
  { id: 'pq2', subject: 'গণিত', chapter_name: 'গুণ', body: '৭ × ৮ = কত?', options: ['৫৪', '৫৬', '৬৪', '৪৮'], answer: '৫৬' },
  { id: 'pq3', subject: 'ইংরেজি', chapter_name: null, body: 'Choose the right word: She ___ to school every day.', options: ['go', 'goes', 'going', 'gone'], answer: 'goes' },
];
export function createStudentData({ p, now, mem, gd }) {
  const today = () => dhakaDay(now());
  const st = mem.st = {
    stars: p('stars') != null ? Number(p('stars')) : 18, owned: ['av_cat'], avatar: null, theme: null, played: new Set(), done: new Set(['h3']),
    mistakes: [
      { q_key: 'qz1:1', subject: 'গণিত', question: QUIZZES[0].questions[1], box: 1, due: addDays(dhakaDay(now()), -1), wrong_count: 2 },
      { q_key: 'qz3:1', subject: 'ইংরেজি', question: QUIZZES[2].questions[1], box: 2, due: dhakaDay(now()), wrong_count: 1 },
      { q_key: 'qz2:2', subject: 'বাংলা', question: QUIZZES[1].questions[2], box: 3, due: addDays(dhakaDay(now()), 4), wrong_count: 1 },
    ],
    duels: null, entries: {}, secondsToday: p('games') === 'used' ? 1790 : 240, decor: { mascot: null, frame: null, backdrop: null, placed: [] }, stickers: ['m_fox', 'f_gold', 'b_sky', 's_star', 's_book'],
    teams: [{ id: 'tm1', name: 'সূর্যতারা', lead_id: 's4' }, { id: 'tm2', name: 'নীল আকাশ', lead_id: 's5' }], members: [{ student_id: 's4', team_id: 'tm1' }, { student_id: 's6', team_id: 'tm1' }, { student_id: 's5', team_id: 'tm2' }],
    pending: [], blocked: new Set(), thread: [{ message_id: 'cm1', mine: false, kind: 'phrase', label: 'হ্যালো', sent_at: new Date(now() - 3600e3).toISOString() }, { message_id: 'cm2', mine: true, kind: 'phrase', label: 'ধন্যবাদ', sent_at: new Date(now() - 3000e3).toISOString() }],
    attempts: [{ id: 'at0', exam_id: 'oe0', score: 7, total: 10, submitted_at: new Date(now() - 5 * 864e5).toISOString(), exam: { title: 'মডেল টেস্ট: ইংরেজি', kind: 'live' } }],
    doubts: [],
  };
  const level = () => (p('class') ? Number(p('class')) : 6);
  const self = () => ({ id: SELF, class_level: level(), roll: 5, batch: { shift: 'morning' }, profile: { full_name: 'তাসনিম আক্তার' } });
  const board = () => [...NAMES.map((n, i) => ({ student_id: 's' + i, display_name: n, stars: 52 - i * 6 })), { student_id: SELF, display_name: 'তাসনিম', stars: st.stars }].sort((a, b) => b.stars - a.stars);
  const exams = () => {
    const t = now();
    return [
      { id: 'oe1', title: 'অনুশীলন: গণিত (ভগ্নাংশ)', kind: 'practice', status: 'published', starts_at: null, ends_at: null, duration_minutes: 15 },
      { id: 'oe2', title: 'সাপ্তাহিক পরীক্ষা: বিজ্ঞান', kind: 'live', status: 'published', starts_at: new Date(t - 3600e3).toISOString(), ends_at: new Date(t + 6 * 3600e3).toISOString(), duration_minutes: 30 },
      { id: 'oe3', title: 'মাসিক পরীক্ষা: বাংলা', kind: 'live', status: 'published', starts_at: new Date(t + 2 * 864e5).toISOString(), ends_at: new Date(t + 2 * 864e5 + 7200e3).toISOString(), duration_minutes: 45 },
    ];
  };
  const empty = () => mem.state === 'empty';
  const teamsEmpty = () => p('teams') === 'none';
  const nameOf = id => (id === SELF ? 'তাসনিম' : ({ s4: 'রাহাত', s5: 'সুমাইয়া', s6: 'মেহেদী', s7: 'নুসরাত' })[id] || 'বন্ধু');

  return {
    table(t, q, method, body) {
      switch (t) {
        case 'students': return method === 'GET' && q.get('profile_id') ? ok([self()]) : null;
        case 'student_rewards': return ok([{ stars: st.stars, streak_days: 12, owned: st.owned, avatar: st.avatar, theme: st.theme }]);
        case 'quizzes': return ok(empty() ? [] : QUIZZES.map(z => ({ ...z, class_level: level() })));
        case 'quiz_mistakes': {
          if (method === 'POST') { for (const r of [].concat(body)) { st.mistakes = st.mistakes.filter(m => m.q_key !== r.q_key); st.mistakes.push({ ...r }); } return ok(null, 201); }
          const key = (q.get('q_key') || '').replace('eq.', '');
          if (method === 'DELETE') { st.mistakes = st.mistakes.filter(m => m.q_key !== decodeURIComponent(key)); return ok(null, 204); }
          if (method === 'PATCH') { const m = st.mistakes.find(x => x.q_key === decodeURIComponent(key)); if (m) Object.assign(m, body); return ok(null, 204); }
          return ok(empty() ? [] : st.mistakes.slice().sort((a, b) => a.due.localeCompare(b.due)));
        }
        case 'attendance': {   // the guardian fake has no row for today; the student's day starts with one (?att=absent|none changes it)
          const base = gd.table('attendance', q).data, a = p('att'), d = today();
          return ok(a === 'none' ? base : [{ date: d, check_in: a === 'absent' ? null : `${d}T08:14:00+06:00`, check_out: null, source: 'manual' }, ...base]);
        }
        case 'chapters': return ok(empty() ? [] : CHAPTERS.map(c => ({ ...c, class_level: level() })));
        case 'homework_done':
          if (method === 'POST') { st.done.add(body.homework_id); return ok(null, 201); }
          if (method === 'DELETE') { st.done.delete((q.get('homework_id') || '').replace('eq.', '')); return ok(null, 204); }
          return ok([...st.done].map(homework_id => ({ homework_id })));
        case 'online_exams': return ok(empty() ? [] : exams());
        case 'exam_attempts': return ok(empty() ? [] : st.attempts);
        case 'weekly_challenges': return ok(empty() ? [] : [
          { id: 'wc1', class_level: 6, week_start: addDays(today(), -2), title: 'এই সপ্তাহে ৩টা নতুন ইংরেজি শব্দ শেখো', body: 'শব্দগুলো খাতায় লিখে স্যারকে দেখাও।', stars: 3, tournament: level() >= 5 },
          { id: 'wc2', class_level: null, week_start: addDays(today(), -9), title: 'একটা ভালো কাজের গল্প লেখো', body: 'এই সপ্তাহে কারও উপকার করলে তার গল্প লেখো।', stars: 2, tournament: false }]);
        case 'challenge_entries':
          if (method === 'POST') { st.entries[body.challenge_id] = 'pending'; return ok(null, 201); }
          return ok(Object.entries(st.entries).map(([challenge_id, status]) => ({ challenge_id, status })).concat(p('entry') === 'approved' ? [{ challenge_id: 'wc2', status: 'approved' }] : []));
        case 'teams': return ok(empty() || teamsEmpty() ? [] : st.teams.map(x => ({ ...x, class_level: level() })));
        case 'team_members': return ok(empty() || teamsEmpty() ? [] : st.members);
        case 'team_join_requests': return ok(st.pending.filter(r => r.status === 'pending'));
        case 'team_name_options': return ok(TEAM_NAMES.map(name => ({ name })));
        case 'game_sessions': return ok([{ seconds: st.secondsToday }]);
        case 'sticker_catalog': return ok(CATALOG);
        case 'student_stickers': return ok(p('stickers') === 'none' ? [] : st.stickers.map(sticker_key => ({ sticker_key })));
        case 'student_decor': return ok([st.decor]);
        case 'flashcards': return ok(empty() ? [] : [['গণিত', 'ভগ্নাংশ', '১/২ কে দশমিকে লিখলে?', '০.৫'], ['গণিত', 'ভগ্নাংশ', 'হর কাকে বলে?', 'ভগ্নাংশের নিচের সংখ্যা'], ['ইংরেজি', 'Tense', 'Past of go?', 'went'], ['বাংলা', 'বিশেষ্য', 'বিশেষ্য কাকে বলে?', 'কোনো কিছুর নাম']].map(([subject, chapter_name, front, back], i) => ({ id: 'f' + i, subject, chapter_name, front, back })));
        case 'quiz_duels': return ok(level() < 5 || p('duels') === 'none' ? [] : st.duels ||= [{ id: 'd1', quiz_title: 'ভগ্নাংশের কুইজ', subject: 'গণিত', questions: QUIZZES[0].questions.slice(0, 3), challenger_id: 's4', opponent_id: SELF, challenger_name: 'রাহাত', opponent_name: 'তাসনিম', challenger_score: 2, opponent_score: null, created_at: new Date(now() - 3600e3).toISOString() },
          { id: 'd2', quiz_title: 'Tense', subject: 'ইংরেজি', questions: QUIZZES[2].questions.slice(0, 3), challenger_id: SELF, opponent_id: 's5', challenger_name: 'তাসনিম', opponent_name: 'সুমাইয়া', challenger_score: 3, opponent_score: 2, created_at: new Date(now() - 30 * 3600e3).toISOString() }]);
        case 'chat_phrases': return ok(PHRASES);
        case 'doubts':
          if (method === 'POST') { st.doubts.unshift({ ...body, answer: null, created_at: new Date(now()).toISOString() }); return ok(null, 201); }
          return ok(empty() ? [] : [...st.doubts, { id: 'dq1', class_level: level(), subject: 'গণিত', body: 'ভগ্নাংশের হর আর লব কীভাবে মনে রাখব?', answer: 'নিচের সংখ্যা হর। উপরের সংখ্যা লব।', created_at: new Date(now() - 2 * 864e5).toISOString() }, { id: 'dq2', class_level: level(), subject: 'ইংরেজি', body: 'Tense কীভাবে চিনব?', answer: null, created_at: new Date(now() - 864e5).toISOString() }]);
        default: return null;
      }
    },
    rpc(name, body) {
      switch (name) {
        case 'today_student': return ok({ day: today(), tasks: empty() ? [] : [{ id: 'h1', title: 'অনুশীলনী ৫.২', due_date: addDays(today(), 1) }, { id: 'h2', title: 'রচনা: আমার গ্রাম', due_date: addDays(today(), 3) }], next_exam: empty() ? null : { title: 'মাসিক পরীক্ষা', exam_date: addDays(today(), 9), days_left: 9 }, rewards: { stars: st.stars, streak_days: 12, last_active_date: today() },
          // not a real field yet: what a later server step may send (teacher note, next class). Fake mode only; the cards hide when it is missing (?preview=none)
          ...(p('preview') === 'none' ? {} : { preview: { teacher_note: { text: 'আজ ভগ্নাংশের অঙ্কে ভালো করেছ।', by: 'গণিতের শিক্ষক' }, next_class: { subject: 'ইংরেজি', teacher: 'রহিম স্যার', time_label: '৪:০০', period_label: 'বিকেল', room: '২ নম্বর রুম' } } }) });
        case 'practice_subjects': return ok(p('practice') === 'none' ? [] : [{ subject: 'গণিত', n: 24 }, { subject: 'ইংরেজি', n: 12 }]);
        case 'practice_questions': return ok(PRACTICE.filter(q => q.subject === body.p_subject).map(({ answer, ...q }) => q));
        case 'practice_check': { const q = PRACTICE.find(x => x.id === body.p_id); return q ? ok({ right: q.answer === body.p_choice, answer: q.answer }) : bad('not_allowed'); }
        case 'submit_quiz': {
          const z = QUIZZES.find(x => x.id === body.p_quiz_id); if (!z) return bad('quiz not found');
          let correct = 0; z.questions.forEach((q, i) => { if (body.p_answers[i] === q.answer_index) correct++; });
          const first = !st.played.has(z.id); st.played.add(z.id);
          const stars = first && correct > 0 ? Math.min(correct, 10) : 0; st.stars += stars;
          return ok({ correct, total: z.questions.length, stars });
        }
        case 'claim_daily_star': return ok(true);
        case 'log_focus': st.stars += 1; return ok({ star: true, streak: 13 });
        case 'create_duel': st.duels = (st.duels || []).concat([{ id: 'd' + Date.now(), quiz_title: 'নতুন ডুয়েল', subject: '', questions: QUIZZES[0].questions.slice(0, 3), challenger_id: SELF, opponent_id: body.p_opponent_id, challenger_name: 'তাসনিম', opponent_name: nameOf(body.p_opponent_id), challenger_score: null, opponent_score: null, created_at: new Date(now()).toISOString() }]); return ok('d');
        case 'submit_duel': { const d = (st.duels || []).find(x => x.id === body.p_duel_id); if (!d) return bad('not your duel'); const score = body.p_answers.filter((a, i) => a === d.questions[i].answer_index).length; if (d.challenger_id === SELF) d.challenger_score = score; else d.opponent_score = score; return ok({ score, total: d.questions.length, stars: 0 }); }
        case 'class_leaderboard': return empty() ? ok([]) : ok(board());
        case 'weekly_tournament_board': return ok([{ rank: 1, student_id: 's2', display_name: 'নুসরাত', submitted_at: new Date(now() - 20 * 3600e3).toISOString() }, { rank: 2, student_id: 's4', display_name: 'রাহাত', submitted_at: new Date(now() - 9 * 3600e3).toISOString() }]);
        case 'merit_list': return ok([{ rank: 1, student_id: 's2', full_name: 'নুসরাত আক্তার', obtained: 19, is_me: false }, { rank: 3, student_id: SELF, full_name: 'তাসনিম আক্তার', obtained: 17, is_me: true }]);
        case 'class_mates': return ok([['s4', 'রাহাত'], ['s5', 'সুমাইয়া'], ['s6', 'মেহেদী'], ['s7', 'নুসরাত']].map(([student_id, display_name]) => ({ student_id, display_name })));
        case 'create_team': {
          if (!TEAM_NAMES.includes(body.p_name)) return bad('team name must be picked from the list');
          const id = 'tm' + (st.teams.length + 1); st.teams.push({ id, name: body.p_name, lead_id: SELF }); st.members.push({ student_id: SELF, team_id: id }); return ok(id);
        }
        case 'request_team_join': st.pending.push({ id: 'rq' + st.pending.length, team_id: body.p_team_id, student_id: SELF, via: 'request', status: 'pending' }); return ok('rq');
        case 'respond_team_join': {
          const r = st.pending.find(x => x.id === body.p_request_id); if (!r) return bad('not pending');
          r.status = body.p_accept ? 'accepted' : 'declined';
          if (body.p_accept) { if (st.members.filter(m => m.team_id === r.team_id).length >= 6) return bad('team is full (6 members)'); st.members.push({ student_id: r.student_id, team_id: r.team_id }); }
          return ok(null, 204);
        }
        case 'invite_to_team': st.pending.push({ id: 'iv' + st.pending.length, team_id: st.members.find(m => m.student_id === SELF)?.team_id, student_id: body.p_student_id, via: 'invite', status: 'pending' }); return ok('iv');
        case 'leave_team': st.members = st.members.filter(m => m.student_id !== SELF); return ok(null, 204);
        case 'submit_game_session': {
          if (st.secondsToday + body.p_seconds > 1800) return bad('daily_limit');
          st.secondsToday += body.p_seconds; return ok(1800 - st.secondsToday);
        }
        case 'buy_item': {
          const price = ({ av_cat: 10, av_tiger: 15, av_owl: 20, av_rocket: 25, av_robot: 30, av_unicorn: 40, av_crown: 60 })[body.p_item];
          if (!price) return bad('unknown item'); if (st.stars < price) return bad('not enough stars');
          if (!st.owned.includes(body.p_item)) { st.stars -= price; st.owned.push(body.p_item); } return ok(st.stars);
        }
        case 'equip_item': if (body.p_item && !st.owned.includes(body.p_item)) return bad('not owned'); st[body.p_slot] = body.p_item; return ok(null, 204);
        case 'set_decor': {
          const need = [body.p_mascot, body.p_frame, body.p_backdrop, ...(body.p_stickers || [])].filter(Boolean);
          if (need.some(k => !st.stickers.includes(k)) || (body.p_stickers || []).length > 6) return bad('not_owned');
          st.decor = { mascot: body.p_mascot, frame: body.p_frame, backdrop: body.p_backdrop, placed: body.p_stickers || [] }; return ok(null, 204);
        }
        case 'chat_classmates': return level() < 5 ? ok([]) : ok([{ peer_id: 's4', full_name: 'রাহাত', blocked: st.blocked.has('s4') }, { peer_id: 's5', full_name: 'সুমাইয়া', blocked: st.blocked.has('s5') }, { peer_id: 's7', full_name: 'নুসরাত', blocked: st.blocked.has('s7') }]);
        case 'chat_thread': return body.p_peer === 's4' ? ok(st.thread) : ok([]);
        case 'open_chat_thread': return ok('th1');
        case 'send_chat_phrase': { if (Number(p('hour') ?? 15) >= 22) return bad('chat closed'); const ph = PHRASES.find(x => x.id === body.p_phrase); st.thread.push({ message_id: 'cm' + (st.thread.length + 1), mine: true, kind: ph.kind, label: ph.label, sent_at: new Date(now()).toISOString() }); return ok('m'); }
        case 'block_chat': st.blocked.add(body.p_other); return ok(null, 204);
        case 'unblock_chat': st.blocked.delete(body.p_other); return ok(null, 204);
        default: return null;
      }
    },
    nameOf, CATALOG, QUIZZES,
  };
}

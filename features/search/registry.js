// Every feature the app will have: name, words people use for it, who sees it, which tab it lives in and which step builds it.
// Search, the "আরও" lists and the "coming soon" cards all read this one list. live:true = a real screen exists now.
import { tabIds } from '../../roles/tabs.js';

// [id, name, synonyms, roles, home tab, step, feature flag (my_features key) or null]
const R = [
  // guardian
  ['g_report', 'রিপোর্ট কার্ড', 'রেজাল্ট ফল সাপ্তাহিক report card', 'guardian', 'study', 2, 'reports'],
  ['g_results', 'পরীক্ষার ফল', 'রেজাল্ট নম্বর marks result', 'guardian', 'study', 2, 'reports'],
  ['g_ratings', 'রেটিং', 'মূল্যায়ন তারা rating', 'guardian', 'study', 2, 'ratings'],
  ['g_goals', 'লক্ষ্য', 'টার্গেট goal', 'guardian', 'more', 2, null],
  ['g_certs', 'সার্টিফিকেট', 'সনদ certificate', 'guardian', 'more', 2, null],
  ['g_videos', 'ভিডিও', 'ক্লাসের ভিডিও video', 'guardian', 'more', 2, null],
  ['g_materials', 'উপকরণ', 'নোট বই পিডিএফ material', 'guardian', 'more', 2, null],
  ['g_fees', 'ফি ও রসিদ', 'বকেয়া বেতন টাকা ফি fee রসিদ', 'guardian', 'more', 2, 'fees'],
  ['g_director', 'পরিচালকের বার্তা', 'বার্তা পরিচালক director', 'guardian', 'more', 2, null],
  // student
  ['s_classes', 'আজকের ক্লাস', 'রুটিন ক্লাস', 'student', 'today', 3, null],
  ['s_homework', 'বাড়ির কাজ', 'হোমওয়ার্ক homework', 'student', 'today', 3, null],
  ['s_syllabus', 'সিলেবাস', 'পাঠ্যসূচি syllabus', 'student', 'study', 3, null],
  ['s_videos', 'ভিডিও', 'video', 'student', 'study', 3, null],
  ['s_materials', 'উপকরণ', 'নোট বই material', 'student', 'study', 3, null],
  ['s_flash', 'ফ্ল্যাশকার্ড', 'flashcard', 'student', 'study', 3, null],
  ['s_mistakes', 'ভুল শুধরে নেওয়ার খাতা', 'ভুল mistake', 'student', 'study', 3, null],
  ['s_practice', 'প্রশ্ন ব্যাংকে অনুশীলন', 'প্রশ্ন ব্যাংক অনুশীলন practice mcq', 'student', 'study', 3, null],
  ['s_askbox', 'প্রশ্ন বক্স', 'প্রশ্ন করো question', 'student', 'study', 3, null],
  ['s_ai', 'AI সহায়ক', 'ডিফি এআই ai tutor', 'student', 'study', 3, 'ai_tutor'],
  ['s_timer', 'ফোকাস টাইমার', 'টাইমার মনোযোগ timer', 'student', 'study', 3, null],
  ['s_quiz', 'কুইজ ও লিডারবোর্ড', 'কুইজ quiz leaderboard', 'student', 'play', 3, 'games'],
  ['s_duel', 'ডুয়েল', 'লড়াই battle duel', 'student', 'play', 3, 'battles'],
  ['s_challenge', 'চ্যালেঞ্জ', 'challenge tournament', 'student', 'play', 3, 'tournament'],
  ['s_spell', 'বানান', 'spelling', 'student', 'play', 3, 'games'],
  ['s_shop', 'পয়েন্টের দোকান', 'পয়েন্ট দোকান shop decor', 'student', 'play', 3, 'decor'],
  ['s_exams', 'অনলাইন পরীক্ষা', 'পরীক্ষা exam অনলাইন', 'student', 'study', 3, null],
  ['s_results', 'পরীক্ষার ফল', 'রেজাল্ট নম্বর marks result', 'student', 'study', 3, 'reports'],
  ['s_revision', 'পড়ার পরিকল্পনা', 'রিভিশন প্ল্যান revision', 'student', 'study', 3, null],
  ['s_teams', 'দল ও লড়াই', 'দল টিম battle team', 'student', 'play', 3, 'battles'],
  ['s_board', 'ক্লাসের তালিকা', 'লিডারবোর্ড স্টার board', 'student', 'play', 3, 'games'],
  ['s_games', 'শেখার খেলা', 'খেলা game গণিত', 'student', 'play', 3, 'games'],
  ['s_decor', 'সাজঘর', 'মাসকট স্টিকার সাজানো decor', 'student', 'play', 3, 'decor'],
  ['s_chat', 'বন্ধুদের সাথে চ্যাট', 'চ্যাট chat বন্ধু', 'student', 'play', 3, 'chat'],
  ['s_profile', 'আমার প্রোফাইল', 'প্রোফাইল অবতার profile', 'student', 'more', 3, null],
  ['s_report', 'রিপোর্ট', 'রিপোর্ট কার্ড রেজাল্ট report', 'student', 'more', 3, 'reports'],
  ['s_ratings', 'রেটিং', 'rating', 'student', 'more', 3, 'ratings'],
  ['s_goals', 'লক্ষ্য', 'goal', 'student', 'more', 3, null],
  ['s_certs', 'সার্টিফিকেট', 'সনদ certificate', 'student', 'more', 3, null],
  ['s_notices', 'নোটিশ', 'notice খবর', 'student', 'more', 1, 'notices'],
  // teacher + admin share the class tab
  ['t_attend', 'হাজিরা', 'উপস্থিতি attendance', 'teacher,admin', 'class', 6, 'attendance'],
  ['t_today_att', 'আজ কার হাজিরা', 'আজকের উপস্থিতি', 'teacher,admin', 'class', 6, 'attendance'],
  ['t_rate', 'রেটিং', 'মূল্যায়ন rating', 'teacher,admin', 'class', 6, 'ratings'],
  ['t_signals', 'শিক্ষার্থীদের সংকেত', 'সংকেত মন mood', 'teacher,admin', 'class', 5, null],
  ['t_askbox', 'প্রশ্ন বক্স', 'প্রশ্ন question', 'admin', 'class', 6, null],
  ['t_voice', 'ভয়েস', 'রেকর্ড voice', 'teacher,admin', 'class', 5, null],
  ['t_cctv', 'CCTV যাচাই', 'ক্যামেরা সিসিটিভি cctv', 'teacher,admin', 'class', 7, 'classroom_face'],
  ['t_marks', 'নম্বর এন্ট্রি', 'নম্বর marks', 'teacher', 'more', 5, 'reports'],
  ['t_cards', 'রিপোর্ট কার্ড', 'রেজাল্ট report card', 'teacher', 'more', 5, 'reports'],
  ['t_routine', 'রুটিন', 'সময়সূচি routine', 'teacher', 'more', 5, null],
  ['t_plans', 'পরিকল্পনা', 'প্ল্যান plan', 'teacher', 'more', 5, null],
  ['t_qupload', 'প্রশ্ন জমা', 'আপলোড বইয়ের পাতা পিডিএফ ছবি upload source', 'teacher', 'more', 5, null],
  ['t_qapprove', 'প্রশ্ন অনুমোদন', 'এআই প্রশ্ন দেখুন হ্যাঁ না approve', 'teacher', 'more', 5, null],
  ['t_qbank', 'প্রশ্ন ব্যাংক', 'প্রশ্ন question bank', 'teacher', 'more', 5, null],
  ['t_aipaper', 'AI প্রশ্নপত্র ও খাতা দেখা', 'এআই প্রশ্নপত্র ai grading', 'teacher', 'more', 5, null],
  ['t_seat', 'সিট প্ল্যান', 'আসন seat plan', 'teacher', 'more', 5, null],
  ['t_find', 'শিক্ষার্থী খোঁজা', 'ছাত্র খুঁজুন student search ফোন', 'teacher', 'more', 5, null],
  ['t_risk', 'ঝুঁকিতে থাকা শিক্ষার্থী', 'পিছিয়ে risk', 'teacher', 'more', 5, null],
  ['t_batch', 'ব্যাচ তুলনা', 'ব্যাচ batch compare', 'teacher', 'more', 5, null],
  ['t_chat', 'অভিভাবকের সাথে চ্যাট', 'চ্যাট chat বার্তা', 'teacher', 'inbox', 4, 'chat'],
  ['t_doubts', 'শিক্ষার্থীদের প্রশ্ন', 'প্রশ্ন বক্স doubt question উত্তর', 'teacher', 'inbox', 4, null],
  ['t_notice', 'নোটিশ পাঠান', 'নোটিশ notice ঘোষণা', 'teacher', 'inbox', 4, 'notices'],
  ['t_homework', 'বাড়ির কাজ', 'হোমওয়ার্ক homework', 'teacher', 'class', 4, null],
  ['t_auto', 'অটোমেশনের নিয়ম', 'স্বয়ংক্রিয় খবর চুপ মোড silent এসএমএস automation', 'teacher', 'more', 5, null],
  ['t_me', 'আমার প্রোফাইল ও সময়সূচি', 'প্রোফাইল সময়সূচি রুটিন schedule', 'teacher', 'more', 5, null],
  ['t_meet', 'মিটিং', 'সাক্ষাৎ meeting', 'teacher', 'more', 5, null],
  ['t_honor', 'ক্লাস সম্মানী', 'বেতন honorarium', 'teacher', 'more', 6, null],
  ['t_leave', 'ছুটি', 'leave', 'teacher', 'more', 5, null],
  ['t_requests', 'অনুরোধ', 'request', 'teacher', 'more', 5, null],
  // admin
  ['a_fees', 'ফি', 'বকেয়া বেতন টাকা fee', 'admin', 'office', 6, 'fees'],
  ['a_feedback', 'মতামত', 'মতামত ফিডব্যাক সমস্যা পরামর্শ feedback', 'admin', 'office', 6, null],
  ['a_accounts', 'নতুন ছাত্র যোগ', 'নতুন ভর্তি পরিবার অ্যাকাউন্ট আইডি পিন টেস্ট account', 'admin', 'office', 6, null],
  ['a_profiles', 'মানুষ ও পিন', 'প্রোফাইল বদলান নাম ফোন পিন রিসেট profile pin', 'admin', 'office', 6, null],
  ['a_routine', 'রুটিন', 'সময়সূচি routine', 'admin', 'office', 6, null],
  ['a_corr', 'নম্বর সংশোধন', 'অনুরোধ সংশোধন ভুল নম্বর ফোন correction', 'admin', 'office', 6, null],
  ['a_honor', 'সম্মানী', 'বেতন honorarium', 'admin', 'office', 6, null],
  ['a_admissions', 'ভর্তির খোঁজ', 'ভর্তি admission আবেদন ফোন', 'admin', 'office', 6, null],
  ['a_notices', 'নোটিশ', 'নোটিশ notice ঘোষণা আর্কাইভ', 'admin', 'office', 6, 'notices'],
  ['a_exams', 'পরীক্ষা', 'পরীক্ষা exam', 'admin', 'more', 6, null],
  ['a_reports', 'রিপোর্ট কার্ড', 'রেজাল্ট report card', 'admin', 'more', 6, 'reports'],
  ['a_people', 'শিক্ষার্থী ও মানুষ', 'ছাত্র শিক্ষক people', 'admin', 'more', 6, null],
  ['a_control', 'নিয়ন্ত্রণ', 'সেটিং control নিয়ম', 'admin', 'more', 6, null],
  ['a_strings', 'লেখা বদলান', 'লেখা strings', 'admin', 'more', 6, null],
  ['a_history', 'পরিবর্তনের ইতিহাস', 'ইতিহাস history audit', 'admin', 'more', 6, null],
];
export const FEATURES = R.map(([id, name, syn, roles, home, step, flag]) => ({ id, name, syn: syn.split(' '), roles: roles.split(','), home, step, flag }));
export const byId = Object.fromEntries(FEATURES.map(f => [f.id, f]));
// Real screens that exist now (found by search too). route is where it goes.
export const LIVE = [
  { id: 'inbox', name: 'ইনবক্স', syn: ['নোটিশ', 'বার্তা', 'খবর', 'notice', 'message', 'inbox'], roles: ['guardian', 'student', 'teacher', 'admin'], route: '/inbox' },
  { id: 'push', name: 'অ্যাপ নোটিফিকেশন', syn: ['নোটিফিকেশন', 'পুশ', 'push', 'খবর', 'অনুমতি'], roles: ['guardian', 'student', 'teacher', 'admin'], route: '/more/push', flag: 'web_push' },
  { id: 'display', name: 'থিম ও লেখার সাইজ', syn: ['লেখা', 'বড়', 'গাঢ়', 'রং', 'dark', 'size'], roles: ['guardian', 'student', 'teacher', 'admin'], route: '/more/display' },
  { id: 'pin', name: 'পিন বদলান', syn: ['পাসওয়ার্ড', 'পিন', 'pin', 'password'], roles: ['guardian', 'student', 'teacher', 'admin'], route: '/more/pin' },
  { id: 'privacy', name: 'গোপনীয়তা', syn: ['সম্মতি', 'তথ্য', 'মুছুন', 'privacy', 'consent'], roles: ['guardian'], route: '/more/privacy' },
  { id: 'pending', name: 'অফলাইন পেন্ডিং কাজ', syn: ['আউটবক্স', 'জমা', 'pending'], roles: ['guardian', 'student', 'teacher', 'admin'], route: '/more/pending' },
  { id: 'help', name: 'সাহায্য', syn: ['ফোন', 'অফিস', 'help'], roles: ['guardian', 'student', 'teacher', 'admin'], route: '/more/help' },
];
// Features that have a real screen now (step 2: the guardian's). id -> [route, icon]. Everything not listed still says "ধাপ N-এ আসছে".
export const LIVE_ROUTES = {
  g_report: ['/study/report', 'file'], g_results: ['/study/results', 'chart'], g_ratings: ['/study/ratings', 'user'], g_goals: ['/study/goals', 'check'], g_certs: ['/study/certs', 'file'],
  g_videos: ['/study/materials?kind=video', 'play'], g_materials: ['/study/materials', 'book'], g_fees: ['/more/fees', 'coin'], g_director: ['/inbox?kind=notice', 'user'],
  s_notices: ['/inbox', 'bell'],
  // the teacher's (step 4)
  t_attend: ['/class/attend', 'check'], t_today_att: ['/class', 'clock'], t_rate: ['/class/rate', 'star'], t_homework: ['/class/homework', 'book'], t_find: ['/class/students', 'search'],
  t_chat: ['/contact/guardians', 'chat'], t_doubts: ['/contact/doubts', 'help'], t_notice: ['/contact/notice', 'bell'], t_auto: ['/more/automation', 'info'], t_me: ['/more/me', 'user'],
  // the teacher's exam work (step 5)
  t_marks: ['/more/marks', 'exam'], t_cards: ['/more/cards', 'file'], t_qupload: ['/more/upload', 'up'], t_qapprove: ['/more/approve', 'check'], t_qbank: ['/more/qbank', 'book'],
  // step 6: the admin's office and the teacher's honorarium
  a_fees: ['/office/fees', 'coin'], a_honor: ['/office/honorarium', 'coin'], a_admissions: ['/office/admissions', 'people'], a_accounts: ['/office/family', 'people'], a_feedback: ['/office/feedback', 'chat'], a_profiles: ['/office/people', 'people'], a_routine: ['/office/routine', 'clock'], a_corr: ['/office/corrections', 'phone'], a_notices: ['/office/notices', 'bell'], t_honor: ['/more/honorarium', 'coin'],
  // the student's (step 3)
  s_homework: ['/learn/homework', 'book'], s_syllabus: ['/learn/syllabus', 'book'], s_videos: ['/learn/materials?kind=video', 'play'], s_materials: ['/learn/materials', 'file'],
  s_mistakes: ['/learn/mistakes', 'check'], s_quiz: ['/learn/quiz', 'trophy'], s_practice: ['/learn/practice', 'book'], s_exams: ['/learn/exams', 'exam'], s_results: ['/learn/results', 'chart'], s_revision: ['/learn/revision', 'clock'],
  s_report: ['/learn/report', 'file'], s_ratings: ['/learn/ratings', 'user'], s_goals: ['/learn/goals', 'check'], s_certs: ['/learn/certs', 'file'],
  s_flash: ['/learn/flash', 'file'], s_askbox: ['/learn/doubts', 'chat'], s_timer: ['/learn/focus', 'clock'], s_ai: ['/learn/diffy', 'help'], s_duel: ['/play/duel', 'people'],
  s_challenge: ['/play/tournament', 'trophy'], s_teams: ['/play/teams', 'people'], s_board: ['/play/board', 'chart'], s_games: ['/play/games', 'gamepad'], s_spell: ['/play/games', 'gamepad'],
  s_shop: ['/play/shop', 'gift'], s_decor: ['/play/decor', 'star'], s_chat: ['/play/chat', 'chat'], s_profile: ['/me/profile', 'user'],
};
// The teacher's screens are for teachers only: the same feature listed for the admin keeps saying "ধাপ N-এ আসছে" until the admin step.
const TEACHER_ONLY = new Set(['t_attend', 't_today_att', 't_rate']);
export const routeOf = (f, role) => (role === 'admin' && TEACHER_ONLY.has(f.id) ? null : LIVE_ROUTES[f.id]?.[0] || null);
export const featuresFor = (role, home) => FEATURES.filter(f => f.roles.includes(role) && (!home || f.home === home));
export const featureRoute = id => `/f/${id}`;
// Consistency check used by tests: every feature lives in a real tab of every role it is listed for.
export const orphans = () => FEATURES.filter(f => f.roles.some(r => !tabIds(r).includes(f.home)));
// Feature flag off (my_features answered without this key) hides it; unknown (call failed) shows everything.
export const visible = (f, features) => !f.flag || features.has(f.flag);

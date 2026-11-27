// Made-up data for the fake mode (names are invented; no real child appears here). The shapes follow the real tables / RPC contracts.
export const FAKE_PIN = '7391';
const H = 3600e3, D = 24 * H;

export const ACCOUNTS = {
  guardian: { uid: 'u-guardian', login_id: 'guardian', role: 'guardian', full_name: 'রুবিনা বেগম', phone: '01711000001', kids: ['k1', 'k2'] },
  guardian2: { uid: 'u-guardian2', login_id: 'guardian2', role: 'guardian', full_name: 'আনোয়ার হোসেন', phone: '01711000002', kids: ['k3'] },
  student: { uid: 'u-student', login_id: 'student', role: 'student', full_name: 'তাসনিম আক্তার', phone: null, kids: [] },
  teacher: { uid: 'u-teacher', login_id: 'teacher', role: 'teacher', full_name: 'রহিম উদ্দিন', phone: '01711000003', kids: [] },
  admin: { uid: 'u-admin', login_id: 'admin', role: 'admin', full_name: 'ফারহানা ইয়াসমিন', phone: '01711000004', kids: [] },
};
export const KIDS = {
  k1: { student_id: 'k1', name: 'তাসনিম', class_level: 6, shift: 'সকাল', roll: 5, login_id: 'tasnim6' },
  k2: { student_id: 'k2', name: 'রাফি', class_level: 5, shift: 'বিকেল', roll: 12, login_id: 'rafi5' },
  k3: { student_id: 'k3', name: 'মীম', class_level: 8, shift: 'সকাল', roll: 3, login_id: 'mim8' },
};
// What a step-2 server will add to "today" (score, week, trend...). Real servers do not send this; the fake does, so the approved screen can be shown in full.
const WEEK = (marks) => ['শনি', 'রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র'].map((day, i) => ({ day, state: marks[i], is_today: i === 2 }));
export const PREVIEW = {
  k1: {
    score: 8, score_max: 10, teacher_note: { text: 'আজ ভগ্নাংশের অঙ্কে ভালো করেছে।', by: 'গণিতের শিক্ষক' }, streak_days: 12,
    week: WEEK(['present', 'present', 'present', 'none', 'none', 'none', 'none']),
    trend: ['শনি', 'রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র'].map((day, i) => ({ day, score: [6, 7, 8, null, null, null, null][i], score_max: 10, is_today: i === 2 })),
    next_class: { subject: 'ইংরেজি', teacher: 'রহিম স্যার', time_label: '৪:০০', period_label: 'বিকাল', room: '২ নম্বর রুম' },
    homework: [{ subject: 'গণিত', title: 'অনুশীলনী ৫.২', due_label: 'কাল জমা' }],
    nudges: [{ kind: 'homework', text: 'গণিতের অনুশীলনী ৫.২ কাল জমা দিতে হবে।' }, { kind: 'streak', text: 'আর ২ দিন এলেই টানা ১৪ দিন হবে!' }],
  },
  k2: {
    score: null, score_max: 10, streak_days: 0,
    week: WEEK(['present', 'absent', 'absent', 'none', 'none', 'none', 'none']),
    trend: ['শনি', 'রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র'].map((day, i) => ({ day, score: [4, null, null, null, null, null, null][i], score_max: 10, is_today: i === 2 })),
    next_class: { subject: 'বাংলা', teacher: 'করিম স্যার', time_label: '৩:০০', period_label: 'বিকাল', room: '১ নম্বর রুম' },
    homework: [],
  },
  k3: { score: 9, score_max: 10, streak_days: 7, week: WEEK(['present', 'present', 'present', 'none', 'none', 'none', 'none']), homework: [] },
};
export const ATTENDANCE = { k1: 'present', k2: 'absent', k3: 'not_marked' };

export function notices(now, n = 8) {
  const T = [
    ['শুক্রবার মডেল টেস্ট', 'শুক্রবার সকাল ৯টায় মডেল টেস্ট হবে। সময়মতো আসবে।', 'all', null, 2],
    ['নভেম্বরের ফি ২০ তারিখের মধ্যে', 'নভেম্বর মাসের ফি ২০ তারিখের মধ্যে অফিসে জমা দিন।', 'guardians', null, 20],
    ['ষষ্ঠ শ্রেণির বিজ্ঞান ক্লাস বদল', 'এই সপ্তাহে বিজ্ঞান ক্লাস বিকেল ৪টায়।', 'all', 6, 30],
    ['বৃহস্পতিবার ক্লাস বন্ধ', 'জাতীয় কর্মসূচির কারণে বৃহস্পতিবার ক্লাস বন্ধ থাকবে।', 'all', null, 50],
    ['পঞ্চম শ্রেণির অভিভাবক সভা', 'শনিবার সকাল ১০টায় অভিভাবক সভা।', 'guardians', 5, 74],
    ['শিক্ষকদের সভা', 'রবিবার বিকেল ৫টায় শিক্ষকদের সভা।', 'teachers', null, 100],
    ['শীতের ছুটির তালিকা', 'শীতের ছুটি ২৪ ডিসেম্বর থেকে শুরু।', 'all', null, 200],
    ['নতুন ব্যাচে ভর্তি চলছে', 'ষষ্ঠ থেকে দশম শ্রেণির নতুন ব্যাচে ভর্তি চলছে।', 'all', null, 300],
  ];
  return Array.from({ length: n }, (_, i) => { const t = T[i % T.length]; return { id: 'n' + i, title: i >= T.length ? t[0] + ' (' + i + ')' : t[0], body: t[1], audience: t[2], class_level: t[3], created_at: new Date(now - t[4] * H - i * 7 * 60e3).toISOString() }; });
}
export const STAFF = [{ id: 'u-teacher', full_name: 'রহিম উদ্দিন', role: 'teacher' }, { id: 'u-teacher2', full_name: 'করিম হোসেন', role: 'teacher' }];
export const messages = now => [
  { id: 'm1', body: 'আপনার সন্তান আজ ক্লাসে খুব ভালো করেছে। এভাবেই চলুক।', created_at: new Date(now - 3 * H).toISOString(), sender_id: 'u-teacher', thread_student_id: 'k1' },
  { id: 'm2', body: 'রাফি দুদিন আসেনি। সব ঠিক আছে তো?', created_at: new Date(now - 26 * H).toISOString(), sender_id: 'u-teacher2', thread_student_id: 'k2' },
];
export const guardianNotes = now => [
  { id: 'gn1', student_id: 'k1', day: '2026-11-22', title: 'আজকের দিন', body: 'আজ তাসনিম সময়মতো এসেছে, গণিতে ৮/১০ পেয়েছে।', read_at: null, updated_at: new Date(now - 1 * H).toISOString() },
  { id: 'gn2', student_id: 'k2', day: '2026-11-21', title: 'গতকালের দিন', body: 'রাফি অনুপস্থিত ছিল।', read_at: new Date(now - 20 * H).toISOString(), updated_at: new Date(now - 30 * H).toISOString() },
];
export const directorMessages = now => [{ id: 'd1', title: 'নতুন বছরের শুভেচ্ছা', body: 'প্রিয় অভিভাবক, আপনাদের সহযোগিতায় ডিফ এডু এগিয়ে চলেছে।', video_url: null, published_on: new Date(now - 6 * D).toISOString().slice(0, 10) }];
export const staffNotes = now => [
  { id: 'sn1', day: '2026-11-22', title: 'নম্বর দেওয়া বাকি', body: 'ষষ্ঠ শ্রেণির মডেল টেস্টের নম্বর আজ দিন।', read_at: null, created_at: new Date(now - 2 * H).toISOString() },
  { id: 'sn2', day: '2026-11-21', title: 'রিপোর্ট কার্ড তৈরি', body: 'পঞ্চম শ্রেণির রিপোর্ট কার্ড তৈরি আছে।', read_at: new Date(now - 10 * H).toISOString(), created_at: new Date(now - 28 * H).toISOString() },
];
export const STUDENTS = [
  ['s1', 6, 5, 'তাসনিম আক্তার', 'tasnim6', '01811000001'], ['s2', 5, 12, 'রাফি হাসান', 'rafi5', '01811000002'], ['s3', 8, 3, 'মীম খাতুন', 'mim8', '01811000003'],
  ['s4', 6, 7, 'রাহাত ইসলাম', 'rahat6', '01811000004'], ['s5', 7, 1, 'সুমাইয়া আক্তার', 'sumaiya7', '01811000005'], ['s6', 9, 9, 'মেহেদী হাসান', 'mehedi9', '01811000006'],
  ['s7', 10, 2, 'নুসরাত জাহান', 'nusrat10', '01811000007'], ['s8', 4, 4, 'আরিফ হোসেন', 'arif4', '01811000008'],
].map(([id, class_level, roll, full_name, login_id, phone]) => ({ id, class_level, roll, active: true, profile: { full_name, login_id, phone } }));
export const EXAM = {
  attempt_id: 'att1', title: 'মডেল টেস্ট: গণিত', questions: [
    { id: 'q1', text: '১২ এর ২৫% কত?', options: [{ id: 'a', text: '২' }, { id: 'b', text: '৩' }, { id: 'c', text: '৪' }] },
    { id: 'q2', text: 'বাংলাদেশের রাজধানী কোনটি?', options: [{ id: 'a', text: 'ঢাকা' }, { id: 'b', text: 'কুষ্টিয়া' }] },
    { id: 'q3', text: '০.৫ কে ভগ্নাংশে লিখলে কত হয়?', options: [{ id: 'a', text: '১/২' }, { id: 'b', text: '১/৫' }, { id: 'c', text: '৫/১' }] },
    { id: 'q4', text: 'একটি ত্রিভুজের তিন কোণের যোগফল কত?', options: [{ id: 'a', text: '৯০°' }, { id: 'b', text: '১৮০°' }, { id: 'c', text: '৩৬০°' }] },
  ],
};

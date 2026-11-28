// The only place that says which tabs each role has (spec 4.2). Exactly 4 per role, the last one always "আরও".
// Everything else (shell, router role guard, search, "আরও" lists, tests) reads this file.
export const TABS = {
  guardian: [
    { id: 'today', name: 'আজ', icon: 'home', blurb: 'সন্তানের আজকের খবর এক নজরে।' },
    { id: 'study', name: 'পড়ালেখা', icon: 'book', blurb: 'রিপোর্ট কার্ড, ফল, লক্ষ্য ও পড়ার জিনিস।' },
    { id: 'inbox', name: 'যোগাযোগ', icon: 'chat', blurb: 'নোটিশ ও বার্তা এক জায়গায়।' },
    { id: 'more', name: 'আরও', icon: 'more', blurb: 'ফি, সেটিং, সাহায্য।' },
  ],
  student: [
    { id: 'today', name: 'আজ', icon: 'home', blurb: 'আজকের ক্লাস ও বাড়ির কাজ।' },
    { id: 'study', name: 'পড়া', icon: 'book', blurb: 'সিলেবাস, ভিডিও ও পড়ার সঙ্গী।' },
    { id: 'play', name: 'খেলা', icon: 'play', blurb: 'কুইজ ও খেলার ছলে শেখা।' },
    { id: 'more', name: 'আরও', icon: 'more', blurb: 'অগ্রগতি, নোটিশ, সেটিং।' },
  ],
  teacher: [
    { id: 'today', name: 'আজ', icon: 'home', blurb: 'আজকের কাজ ও এখনকার শিফট।' },
    { id: 'class', name: 'ক্লাস', icon: 'people', blurb: 'হাজিরা, রেটিং ও ক্লাসের কাজ।' },
    { id: 'inbox', name: 'যোগাযোগ', icon: 'chat', blurb: 'অভিভাবকের বার্তা, শিক্ষার্থীর প্রশ্ন ও নোটিশ।' },
    { id: 'more', name: 'আরও', icon: 'more', blurb: 'অটোমেশনের নিয়ম, পরীক্ষা, সেটিং।' },
  ],
  admin: [
    { id: 'today', name: 'আজ', icon: 'home', blurb: 'আজ কী দেখা দরকার।' },
    { id: 'class', name: 'ক্লাস', icon: 'people', blurb: 'হাজিরা, রেটিং ও ক্লাসের কাজ।' },
    { id: 'office', name: 'অফিস', icon: 'office', blurb: 'ফি, হিসাব, মানুষ ও নিয়ম।' },
    { id: 'more', name: 'আরও', icon: 'more', blurb: 'পরীক্ষা, রিপোর্ট, সেটিং।' },
  ],
};
export const ROLES = Object.keys(TABS);
export const tabsFor = role => TABS[role] || null;
export const tabIds = role => (TABS[role] || []).map(t => t.id);
export const hasTab = (role, id) => tabIds(role).includes(id);
export const tabById = (role, id) => (TABS[role] || []).find(t => t.id === id) || null;
export const HOME_TAB = 'today';
export const ROLE_BN = { guardian: 'অভিভাবক', student: 'শিক্ষার্থী', teacher: 'শিক্ষক', admin: 'অ্যাডমিন' };

// What "আরও" shows, grouped (feature ids from features/search/registry.js). The "আমার" group is the same for everyone and built in more.js.
export const MORE_GROUPS = {
  guardian: [{ title: 'ফি ও বার্তা', ids: ['g_fees', 'g_director'] }, { title: 'পড়ালেখার আরও', ids: ['g_goals', 'g_certs', 'g_videos', 'g_materials'] }],
  student: [{ title: 'অগ্রগতি', ids: ['s_report', 's_ratings', 's_goals', 's_certs'] }, { title: 'খবর ও প্রোফাইল', ids: ['s_notices', 's_profile'] }],
  teacher: [{ title: 'শিক্ষার্থী', ids: ['t_everyone', 't_find', 't_risk', 't_batch', 't_meet'] }, { title: 'অটোমেশন', ids: ['t_auto'] }, { title: 'পরীক্ষা ও রিপোর্ট', ids: ['t_marks', 't_cards', 't_routine', 't_plans', 't_qupload', 't_qapprove', 't_qbank', 't_paper', 't_aipaper', 't_memes', 't_seat'] }, { title: 'আমার কাজ', ids: ['t_me', 't_honor', 't_leave', 't_requests'] }],
  admin: [{ title: 'পরীক্ষা ও রিপোর্ট', ids: ['a_exams', 'a_reports', 't_memes'] }, { title: 'মানুষ ও নিয়ম', ids: ['a_people', 'a_control', 'a_strings', 'a_history'] }],
};

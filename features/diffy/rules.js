// ডিফি chat rules, pure (tested). Mirrors the edge function `ai` (mode "tutor"): 20 questions per day, only study questions, no names or numbers sent.
import { store } from '../../core/store.js';
import { dhakaDay } from '../../core/bn.js';

export const DAILY = 20, MAX_Q = 300;
const OFF = /খেলা|ক্রিকেট|ফুটবল|সিনেমা|গান|গেম|ফ্রি ?ফায়ার|নাটক|মোবাইল|প্রেম|রাজনীতি|ভোট/;
export const isOffTopic = text => OFF.test(text);
// What may leave the phone: trimmed, cut to length, phone numbers and long digit runs removed (the server strips names and roll numbers again).
export const cleanQuestion = text => String(text || '').replace(/(\+?88)?0?1[3-9][\d\s-]{8,}/g, '').replace(/\d{6,}/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_Q);
export const OFF_REPLY = 'এটা পড়ার প্রশ্ন নয়, তাই এখানে উত্তর দিতে পারছি না। চলো পড়ার কিছু জিজ্ঞেস করো, যেমন ভগ্নাংশ বা Tense।';
export const PRIVACY_LINE = 'ডিফি তোমার নাম বা ছবি কাউকে পাঠায় না।';

// questions asked today, kept per person on the phone (the server is the real limit: it answers 429 daily_limit)
const key = (uid, now) => `de.next.dq.${uid}.${dhakaDay(now)}`;
export const counter = {
  used: (uid, now = Date.now()) => Number(store.get(key(uid, now)) || 0),
  left: (uid, now = Date.now()) => Math.max(0, DAILY - counter.used(uid, now)),
  add: (uid, now = Date.now()) => store.set(key(uid, now), String(counter.used(uid, now) + 1)),
  setUsed: (uid, n, now = Date.now()) => store.set(key(uid, now), String(n)),
};
// Canned answers for fake mode (no AI). Every one is short, kind, step by step.
export const CANNED = {
  frac: 'ভগ্নাংশ মানে কোনো জিনিসের ভাগ।\n১) একটা পিঠাকে ৪ ভাগ করলাম।\n২) তার ১ ভাগ নিলে হয় ১/৪ (এক-চতুর্থাংশ)।\n৩) নিচের সংখ্যা (হর) বলে মোট কত ভাগ। ওপরের সংখ্যা (লব) বলে কত ভাগ নিলাম।',
  tense: 'Tense মানে ক্রিয়ার সময়।\n১) Present: এখন ঘটছে বা অভ্যাস। I eat rice.\n২) Past: আগে ঘটেছে। I ate rice.\n৩) Future: পরে ঘটবে। I will eat rice.',
  noun: 'বিশেষ্য হলো কোনো কিছুর নাম।\n১) মানুষের নাম: রহিম, শিক্ষক।\n২) জায়গার নাম: কুষ্টিয়া, স্কুল।\n৩) জিনিসের নাম: বই, কলম।',
  other: 'ভালো প্রশ্ন! চলো ধাপে ধাপে ভাবি।\n১) প্রশ্নে কী চাওয়া হয়েছে, একবার পড়ো।\n২) যা জানা আছে আলাদা করে লেখো।\n৩) বইয়ের কাছাকাছি উদাহরণটা দেখো।\nকঠিন লাগলে শিক্ষককে পাঠাও।',
};
export const cannedFor = text => (/ভগ্নাংশ/.test(text) ? CANNED.frac : /tense/i.test(text) ? CANNED.tense : /বিশেষ্য/.test(text) ? CANNED.noun : CANNED.other);

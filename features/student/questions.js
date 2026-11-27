// Question makers for the learning games. Pure (no DOM), so they can be tested in node. Content is small and checked by hand: add lines to grow a game.
// Every maker returns { kind, hint, big, options: [text], right: text }, or for math / words { prompt, right, wrongs }. cls = the student's class (1..10), ramp = right answers so far.
import { bn } from '../../core/bn.js';
import { GameLogic } from './logic.js';

const pick = (list, rnd) => list[Math.floor(rnd() * list.length)];
const int = (rnd, a, b) => a + Math.floor(rnd() * (b - a + 1));
const clsOf = c => Math.min(10, Math.max(1, Number(c) || 5));

// ---- words ----
export const EASY_WORDS = [['বই', 'book'], ['জল', 'water'], ['আকাশ', 'sky'], ['গাছ', 'tree'], ['মাছ', 'fish'], ['ফুল', 'flower'], ['বাড়ি', 'house'], ['সূর্য', 'sun'], ['চাঁদ', 'moon'], ['পাখি', 'bird'],
  ['নদী', 'river'], ['বন্ধু', 'friend'], ['আম', 'mango'], ['কলম', 'pen'], ['দুধ', 'milk'], ['ভাত', 'rice'], ['দরজা', 'door'], ['টেবিল', 'table'], ['চেয়ার', 'chair'], ['মা', 'mother'], ['বাবা', 'father'],
  ['ভাই', 'brother'], ['বোন', 'sister'], ['হাত', 'hand'], ['চোখ', 'eye'], ['নাক', 'nose'], ['কান', 'ear'], ['লাল', 'red'], ['নীল', 'blue'], ['সবুজ', 'green'], ['হলুদ', 'yellow'], ['কালো', 'black'], ['সাদা', 'white'],
  ['রাত', 'night'], ['দিন', 'day'], ['সকাল', 'morning'], ['ঘোড়া', 'horse'], ['কুকুর', 'dog'], ['বিড়াল', 'cat'], ['গরু', 'cow'], ['হাতি', 'elephant'], ['বাঘ', 'tiger'], ['ভালো', 'good'], ['বড়', 'big'], ['ছোট', 'small'],
  ['গরম', 'hot'], ['ঠান্ডা', 'cold'], ['রাস্তা', 'road'], ['গ্রাম', 'village'], ['শহর', 'city'], ['মেঘ', 'cloud'], ['বৃষ্টি', 'rain'], ['বাতাস', 'wind'], ['আগুন', 'fire'], ['সমুদ্র', 'sea'], ['ঘড়ি', 'clock'], ['চাবি', 'key'], ['ছাতা', 'umbrella'], ['জুতা', 'shoe']];
export const HARD_WORDS = [['অভিজ্ঞতা', 'experience'], ['সাহসী', 'brave'], ['স্বাধীনতা', 'freedom'], ['নিরাপদ', 'safe'], ['পরিবেশ', 'environment'], ['বিজ্ঞান', 'science'], ['গ্রন্থাগার', 'library'], ['অতিথি', 'guest'],
  ['সম্মান', 'respect'], ['পরিশ্রম', 'hard work'], ['ঐক্য', 'unity'], ['সফল', 'successful'], ['চেষ্টা', 'effort'], ['কৃষক', 'farmer'], ['চিকিৎসক', 'doctor'], ['প্রকৃতি', 'nature'], ['দায়িত্ব', 'responsibility'], ['সুযোগ', 'opportunity']];
const wordsFor = cls => (cls >= 5 ? [...EASY_WORDS, ...HARD_WORDS] : EASY_WORDS);
export function wordQ(rnd, cls = 5) {
  const pool = wordsFor(clsOf(cls)), [bnw, en] = pick(cls >= 5 && rnd() < 0.5 ? HARD_WORDS : pool, rnd);
  return { prompt: `${bnw} = ?`, right: en, wrongs: GameLogic.shuffle(pool.map(p => p[1]).filter(x => x !== en), rnd).slice(0, 3) };
}

// ---- maths, harder with the class and with the streak ----
const near = (ans, rnd) => {
  const c = GameLogic.shuffle([ans + 1, ans - 1, ans + 2, ans - 2, ans + 10, ans - 10, ans + 3, ans + 5], rnd).filter(x => x >= 0 && x !== ans);
  for (let k = 4; new Set(c).size < 3; k++) if (ans + k !== ans) c.push(ans + k);
  return [...new Set(c)].slice(0, 3);
};
export function mathQ(rnd, cls = 5, ramp = 0) {
  const c = clsOf(cls), band = c <= 2 ? 0 : c <= 4 ? 1 : c <= 6 ? 2 : 3, tier = Math.min(3, band + (ramp >= 8 ? 1 : 0));
  let prompt, ans;
  if (tier === 0) { const a = int(rnd, 1, 12), b = int(rnd, 1, 9); if (rnd() < 0.55) [prompt, ans] = [`${a} + ${b}`, a + b]; else { const x = a + b; [prompt, ans] = [`${x} − ${b}`, a]; } }
  else if (tier === 1) { const k = rnd(); if (k < 0.35) { const a = int(rnd, 12, 90), b = int(rnd, 3, 9); [prompt, ans] = [`${a} + ${b * 3}`, a + b * 3]; } else if (k < 0.55) { const a = int(rnd, 30, 99), b = int(rnd, 11, 29); [prompt, ans] = [`${a} − ${b}`, a - b]; } else { const a = int(rnd, 2, 9), b = int(rnd, 2, 9); [prompt, ans] = [`${a} × ${b}`, a * b]; } }
  else if (tier === 2) { const k = rnd(); if (k < 0.35) { const a = int(rnd, 3, 12), b = int(rnd, 3, 12); [prompt, ans] = [`${a} × ${b}`, a * b]; } else if (k < 0.6) { const b = int(rnd, 2, 12), q = int(rnd, 2, 12); [prompt, ans] = [`${b * q} ÷ ${b}`, q]; } else if (k < 0.8) { const a = int(rnd, 120, 480), b = int(rnd, 40, 190); [prompt, ans] = [`${a} + ${b}`, a + b]; } else { const a = int(rnd, 12, 29), b = int(rnd, 3, 9); [prompt, ans] = [`${a} × ${b}`, a * b]; } }
  else { const k = rnd(); if (k < 0.25) { const p = pick([10, 25, 50], rnd), base = pick(p === 25 ? [40, 80, 120, 200] : p === 10 ? [30, 70, 120, 250] : [18, 44, 90, 160], rnd); [prompt, ans] = [`${base}-এর ${p}%`, base * p / 100]; } else if (k < 0.5) { const a = int(rnd, 2, 9), b = int(rnd, 2, 9), c2 = int(rnd, 2, 9); [prompt, ans] = [`(${a} + ${b}) × ${c2}`, (a + b) * c2]; } else if (k < 0.75) { const a = int(rnd, 6, 15); [prompt, ans] = [`${a}²`, a * a]; } else { const a = int(rnd, 3, 9), b = int(rnd, 3, 9), c2 = int(rnd, 1, Math.min(20, a * b - 1)); [prompt, ans] = [`${a} × ${b} − ${c2}`, a * b - c2]; } }
  return { prompt: bn(`${prompt} = ?`), right: bn(ans), wrongs: near(ans, rnd).map(bn), ans };
}

// ---- quiz content (used by the "চটজলদি" game) ----
export const TRUE_FALSE = [
  ['বাংলাদেশের রাজধানী ঢাকা।', true], ['সূর্য ওঠে পশ্চিম দিকে।', false], ['এক সপ্তাহে সাত দিন।', true], ['মাছ ফুসফুস দিয়ে শ্বাস নেয়।', false],
  ['পানি ফোটে ১০০ ডিগ্রি সেলসিয়াসে।', true], ['আমাদের জাতীয় ফুল শাপলা।', true], ['রয়েল বেঙ্গল টাইগার আমাদের জাতীয় পশু।', true], ['১২-এর অর্ধেক ৮।', false],
  ['পৃথিবী সূর্যের চারদিকে ঘোরে।', true], ['হৃৎপিণ্ড শরীরে রক্ত পাঠায়।', true], ['মাকড়সার ছয়টা পা।', false], ['আমাদের স্বাধীনতা দিবস ২৬ মার্চ।', true],
  ['শহীদ দিবস ও আন্তর্জাতিক মাতৃভাষা দিবস ২১ ফেব্রুয়ারি।', true], ['বিজয় দিবস ১৬ ডিসেম্বর।', true], ['গাছ দিনের বেলা কার্বন ডাই-অক্সাইড নেয়।', true],
  ['৯ × ৬ = ৫৬।', false], ['৭ × ৮ = ৫৬।', true], ['চাঁদ নিজের আলোয় জ্বলে।', false], ['তিমি একটা মাছ।', false], ['ত্রিভুজের তিনটা বাহু।', true],
  ['আমাদের জাতীয় পাখি দোয়েল।', true], ['আমাদের জাতীয় মাছ ইলিশ।', true], ['শিলাইদহের কুঠিবাড়ি কুষ্টিয়া জেলায়।', true], ['পদ্মা, মেঘনা আর যমুনা আমাদের নদী।', true],
  ['১০০ সেন্টিমিটারে ১ মিটার।', true], ['এক ঘণ্টায় ১০০ মিনিট।', false], ['বাদুড় একটা পাখি।', false], ['সুন্দরবন আমাদের দেশে।', true],
  ['ঢাকা বুড়িগঙ্গা নদীর তীরে।', true], ['বাংলাদেশের মুদ্রার নাম টাকা।', true], ['বাংলাদেশে ঋতু ছয়টা।', true], ['সূর্য একটা তারা।', true], ['পৃথিবীর চাঁদ একটাই।', true],
  ['ত্রিভুজের তিন কোণের যোগফল ১৮০ ডিগ্রি।', true], ['বাংলা বর্ণমালায় স্বরবর্ণ ১১টা।', true], ['কক্সবাজার সমুদ্রসৈকতের জন্য বিখ্যাত।', true], ['বড়দের শরীরে ২০৬টা হাড়।', true],
  ['শীতকালে আমাদের দেশে সবচেয়ে বেশি বৃষ্টি হয়।', false], ['আলো শব্দের চেয়ে ধীরে চলে।', false], ['বিদ্যুতের ঝলক আগে দেখা যায়, বজ্রের শব্দ শোনা যায় পরে।', true],
  ['লবণ পানিতে গুলে যায়।', true], ['০ একটা জোড় সংখ্যা।', true], ['১৫ একটা মৌলিক সংখ্যা।', false], ['২ একমাত্র জোড় মৌলিক সংখ্যা।', true], ['চতুর্ভুজের চারটা বাহু।', true],
  ['লেবুতে ভিটামিন সি আছে।', true], ['ধান থেকে চাল পাওয়া যায়।', true], ['পাটকে বলা হয় সোনালি আঁশ।', true], ['পদ্মা সেতু পদ্মা নদীর ওপর।', true], ['যমুনা সেতু যমুনা নদীর ওপর।', true],
  ['জগদীশচন্দ্র বসু দেখিয়েছিলেন গাছেরও প্রাণ আছে।', true], ['ব্যাঙ উভচর প্রাণী।', true], ['সাপের চারটা পা।', false], ['১ কিলোগ্রামে ১০০ গ্রাম।', false], ['১ কিলোগ্রামে ১০০০ গ্রাম।', true],
];
// The first word is the odd one out; the rest are the group (three are picked each round).
export const ODD = [
  ['গাজর', 'আম', 'জাম', 'কাঁঠাল', 'লিচু'], ['রুই', 'দোয়েল', 'কাক', 'চড়ুই', 'ময়না'], ['কলকাতা', 'ঢাকা', 'খুলনা', 'রাজশাহী', 'সিলেট'],
  ['৭', '২', '৪', '১০', '১২'], ['বাঘ', 'গরু', 'ছাগল', 'ভেড়া', 'হাঁস'], ['বৃত্ত', 'লাল', 'নীল', 'সবুজ', 'হলুদ'], ['চেয়ার', 'কলম', 'পেন্সিল', 'রাবার', 'স্কেল'],
  ['হিমালয়', 'পদ্মা', 'মেঘনা', 'যমুনা', 'কর্ণফুলী'], ['কিলোমিটার', 'ত্রিভুজ', 'বর্গ', 'আয়তক্ষেত্র', 'বৃত্ত'], ['ক্রিকেট', 'ইংরেজি', 'বাংলা', 'গণিত', 'বিজ্ঞান'],
  ['বই', 'কাঁচি', 'ছুরি', 'কুঠার', 'করাত'], ['সোমবার', 'শীত', 'গ্রীষ্ম', 'বর্ষা', 'বসন্ত'], ['সাবান', 'ডিম', 'দুধ', 'ভাত', 'রুটি'], ['কাক', 'রুই', 'ইলিশ', 'কই', 'শোল'],
  ['৯', '৬', '৮', '১২', '১৪'], ['কুমির', 'দোয়েল', 'শালিক', 'ময়না', 'টিয়া'], ['বাস', 'গাছ', 'ট্রেন', 'নৌকা', 'সাইকেল'], ['লাল', 'আপেল', 'কলা', 'আম', 'পেয়ারা'],
  ['ঢাকা', 'বাংলাদেশ', 'ভারত', 'নেপাল', 'ভুটান'], ['প্রজাপতি', 'মৌমাছি', 'মাছি', 'পিঁপড়া', 'হাতি'],
];
// Bangla proverbs: [text with ____, the missing word, wrong words].
export const PROVERBS = [
  ['অতি লোভে ____ নষ্ট।', 'তাঁতি', ['চাষি', 'মাঝি', 'ধোপা']], ['ঠেলার নাম ____।', 'বাবাজি', ['ভাইজান', 'মিয়াজি', 'দাদাজি']], ['যত গর্জে তত ____ না।', 'বর্ষে', ['হাসে', 'চলে', 'ভাসে']],
  ['দশের লাঠি ____ বোঝা।', 'একের', ['দুইয়ের', 'সবার', 'নিজের']], ['নাচতে না জানলে ____ বাঁকা।', 'উঠান', ['মঞ্চ', 'পা', 'ঘর']], ['সবুরে ____ ফলে।', 'মেওয়া', ['আম', 'ধান', 'কলা']],
  ['যেমন কর্ম তেমন ____।', 'ফল', ['ভাত', 'বই', 'মাছ']], ['স্বভাব যায় না ____।', 'মলে', ['চলে', 'বলে', 'ঢলে']], ['আপনি বাঁচলে ____ নাম।', 'বাপের', ['মায়ের', 'দাদার', 'গ্রামের']],
  ['চোরের মার বড় ____।', 'গলা', ['হাত', 'পেট', 'পা']], ['গাছে কাঁঠাল ____ তেল।', 'গোঁফে', ['হাতে', 'মাথায়', 'পায়ে']], ['এক হাতে ____ বাজে না।', 'তালি', ['ঢোল', 'বাঁশি', 'ঘণ্টা']],
  ['ইচ্ছা থাকলে ____ হয়।', 'উপায়', ['টাকা', 'সময়', 'বন্ধু']], ['লেখাপড়া করে যে, ____ চড়ে সে।', 'গাড়িঘোড়া', ['নৌকা', 'গাছে', 'পাহাড়ে']], ['উঠন্ত মূলো ____ চেনা যায়।', 'পত্তনেই', ['রাতেই', 'দামেই', 'হাটেই']],
  ['রোজ ____ হয় না।', 'ঈদ', ['বৃষ্টি', 'খেলা', 'পরীক্ষা']], ['কয়লা ধুলেও ময়লা ____ না।', 'যায়', ['থাকে', 'আসে', 'হয়']], ['শাক দিয়ে ____ ঢাকা।', 'মাছ', ['ভাত', 'ডাল', 'বই']],
];
export const SPELL = [['বই', 'book', ['buk', 'bok']], ['জল', 'water', ['wator', 'watar']], ['স্কুল', 'school', ['scool', 'skool']], ['বন্ধু', 'friend', ['frend', 'freind']], ['আম', 'mango', ['mengo', 'manggo']], ['আপেল', 'apple', ['aple', 'appel']],
  ['শিক্ষক', 'teacher', ['techer', 'teachar']], ['পরিবার', 'family', ['famely', 'familly']], ['জানালা', 'window', ['windo', 'windaw']], ['বাগান', 'garden', ['gardan', 'gardin']], ['খরগোশ', 'rabbit', ['rabit', 'rabbet']],
  ['ডাক্তার', 'doctor', ['doctar', 'docter']], ['সুন্দর', 'beautiful', ['beutiful', 'beautifull']], ['স্বাধীনতা', 'freedom', ['fredom', 'freedoom']], ['পাখি', 'bird', ['burd', 'bured']], ['রাত', 'night', ['nite', 'nigt']]];
export const PICS = [['🐘', 'হাতি'], ['🐅', 'বাঘ'], ['🐟', 'মাছ'], ['🌳', 'গাছ'], ['🍌', 'কলা'], ['🚲', 'সাইকেল'], ['🏠', 'বাড়ি'], ['⭐', 'তারা'], ['🌙', 'চাঁদ'], ['☀️', 'সূর্য'], ['🐓', 'মুরগি'], ['🐄', 'গরু'], ['🚌', 'বাস'], ['🐦', 'পাখি'], ['🍎', 'আপেল'], ['📖', 'বই'],
  ['🐍', 'সাপ'], ['🦆', 'হাঁস'], ['🐒', 'বানর'], ['🥭', 'আম'], ['🍉', 'তরমুজ'], ['✈️', 'উড়োজাহাজ'], ['🚂', 'ট্রেন'], ['⛵', 'নৌকা'], ['🌧️', 'বৃষ্টি'], ['🔑', 'চাবি'], ['⏰', 'ঘড়ি'], ['☂️', 'ছাতা'], ['🐢', 'কচ্ছপ'], ['🦋', 'প্রজাপতি']];
export const SCRAMBLE = [...EASY_WORDS.filter(([, en]) => en.length >= 3 && en.length <= 6 && !en.includes(' ')), ...HARD_WORDS.filter(([, en]) => en.length <= 10 && !en.includes(' '))];

const four = (right, pool, rnd) => GameLogic.shuffle([right, ...GameLogic.shuffle(pool.filter(x => x !== right), rnd).slice(0, 3)], rnd);
// kind -> maker. Each returns { kind, hint, big, options, right }.
const MAKERS = {
  math: (rnd, cls, ramp) => { const q = mathQ(rnd, cls, ramp); return { hint: 'হিসাব করো', big: q.prompt, options: GameLogic.shuffle([q.right, ...q.wrongs], rnd), right: q.right }; },
  word: (rnd, cls) => { const q = wordQ(rnd, cls); return { hint: 'ইংরেজিতে কী?', big: q.prompt.replace(' = ?', ''), options: GameLogic.shuffle([q.right, ...q.wrongs], rnd), right: q.right }; },
  tf: rnd => { const [big, right] = pick(TRUE_FALSE, rnd); return { hint: 'সত্যি না মিথ্যা?', big, options: ['সত্যি', 'মিথ্যা'], right: right ? 'সত্যি' : 'মিথ্যা' }; },
  odd: rnd => { const [odd, ...group] = pick(ODD, rnd); return { hint: 'কোনটা দলে মেলে না?', big: '🤔', options: GameLogic.shuffle([odd, ...GameLogic.shuffle(group, rnd).slice(0, 3)], rnd), right: odd }; },
  pattern: rnd => { const q = GameLogic.patternQuestion(rnd); return { hint: 'পরের সংখ্যাটা কত?', big: bn(q.shown.join(', ') + ', ?'), options: q.options.map(bn), right: bn(q.ans) }; },
  proverb: rnd => { const [big, right, bad] = pick(PROVERBS, rnd); return { hint: 'ফাঁকা জায়গায় কী বসবে?', big, options: GameLogic.shuffle([right, ...bad], rnd), right }; },
  emoji: rnd => { const [big, right] = pick(PICS, rnd); return { hint: 'এটা কী?', big, options: four(right, PICS.map(p => p[1]), rnd), right }; },
  spell: rnd => { const [clue, good, bad] = pick(SPELL, rnd); return { hint: `"${clue}"-এর ঠিক বানান কোনটা?`, big: clue, options: GameLogic.shuffle([good, ...bad], rnd), right: good }; },
};
// [kind, weight, from class, to class]
const MIX = [['math', 30, 1, 10], ['word', 14, 2, 10], ['tf', 10, 2, 10], ['odd', 10, 1, 10], ['pattern', 10, 3, 10], ['proverb', 8, 4, 10], ['emoji', 10, 1, 4], ['spell', 9, 3, 10]];
export function quickQ(rnd, cls = 5, ramp = 0, seen = new Set()) {
  const c = clsOf(cls), pool = MIX.filter(m => c >= m[2] && c <= m[3]), total = pool.reduce((n, m) => n + m[1], 0);
  let q;
  for (let tries = 0; tries < 8; tries++) {
    let r = rnd() * total, kind = pool[0][0];
    for (const m of pool) { if (r < m[1]) { kind = m[0]; break; } r -= m[1]; }
    q = { kind, ...MAKERS[kind](rnd, c, ramp) };
    if (!seen.has(q.big + '|' + q.hint)) break;
  }
  seen.add(q.big + '|' + q.hint); if (seen.size > 40) seen.delete(seen.values().next().value);
  return q;
}
// For the games that draw their own answers (balloons, rings): { prompt, right, wrongs }.
export function targetQ(rnd, cls = 5, ramp = 0) { return rnd() < 0.6 ? mathQ(rnd, cls, ramp) : wordQ(rnd, cls); }

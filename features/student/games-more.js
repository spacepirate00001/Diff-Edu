// More learning games (70-more-games.sql). Every game here is a short round of questions with big tap targets, in Bangla.
// Content is small and checked by hand; add lines to the lists below to grow a game. Loaded only with games.js.
import { h } from '../../ui/dom.js';
import { bn } from '../../core/bn.js';
import { GameLogic } from './logic.js';

const TRUE_FALSE = [
  ['বাংলাদেশের রাজধানী ঢাকা।', true], ['সূর্য ওঠে পশ্চিম দিকে।', false], ['এক সপ্তাহে সাত দিন।', true], ['মাছ ফুসফুস দিয়ে শ্বাস নেয়।', false],
  ['পানি ফোটে ১০০ ডিগ্রি সেলসিয়াসে।', true], ['আমাদের জাতীয় ফুল শাপলা।', true], ['রয়েল বেঙ্গল টাইগার আমাদের জাতীয় পশু।', true], ['১২-এর অর্ধেক ৮।', false],
  ['পৃথিবী সূর্যের চারদিকে ঘোরে।', true], ['হৃৎপিণ্ড শরীরে রক্ত পাঠায়।', true], ['মাকড়সার ছয়টা পা।', false], ['আমাদের স্বাধীনতা দিবস ২৬ মার্চ।', true],
  ['শহীদ দিবস ও আন্তর্জাতিক মাতৃভাষা দিবস ২১ ফেব্রুয়ারি।', true], ['বিজয় দিবস ১৬ ডিসেম্বর।', true], ['গাছ দিনের বেলা কার্বন ডাই-অক্সাইড নেয়।', true],
  ['৯ × ৬ = ৫৬।', false], ['৭ × ৮ = ৫৬।', true], ['চাঁদ নিজের আলোয় জ্বলে।', false], ['তিমি একটা মাছ।', false], ['ত্রিভুজের তিনটা বাহু।', true],
  ['আমাদের জাতীয় পাখি দোয়েল।', true], ['আমাদের জাতীয় মাছ ইলিশ।', true], ['শিলাইদহের কুঠিবাড়ি কুষ্টিয়া জেলায়।', true], ['পদ্মা, মেঘনা আর যমুনা আমাদের নদী।', true],
  ['১০০ সেন্টিমিটারে ১ মিটার।', true], ['এক ঘণ্টায় ১০০ মিনিট।', false], ['বাদুড় একটা পাখি।', false], ['সুন্দরবন আমাদের দেশে।', true],
];
// The first word is the odd one out; the rest are the group (three are picked each round).
const ODD = [
  ['গাজর', 'আম', 'জাম', 'কাঁঠাল', 'লিচু'], ['রুই', 'দোয়েল', 'কাক', 'চড়ুই', 'ময়না'], ['কলকাতা', 'ঢাকা', 'খুলনা', 'রাজশাহী', 'সিলেট'],
  ['৭', '২', '৪', '১০', '১২'], ['বাঘ', 'গরু', 'ছাগল', 'ভেড়া', 'হাঁস'], ['বৃত্ত', 'লাল', 'নীল', 'সবুজ', 'হলুদ'], ['চেয়ার', 'কলম', 'পেন্সিল', 'রাবার', 'স্কেল'],
  ['হিমালয়', 'পদ্মা', 'মেঘনা', 'যমুনা', 'কর্ণফুলী'], ['কিলোমিটার', 'ত্রিভুজ', 'বর্গ', 'আয়তক্ষেত্র', 'বৃত্ত'], ['ক্রিকেট', 'ইংরেজি', 'বাংলা', 'গণিত', 'বিজ্ঞান'],
  ['বই', 'কাঁচি', 'ছুরি', 'কুঠার', 'করাত'], ['সোমবার', 'শীত', 'গ্রীষ্ম', 'বর্ষা', 'বসন্ত'], ['সাবান', 'ডিম', 'দুধ', 'ভাত', 'রুটি'], ['কাক', 'রুই', 'ইলিশ', 'কই', 'শোল'],
  ['৯', '৬', '৮', '১২', '১৪'], ['কুমির', 'দোয়েল', 'শালিক', 'ময়না', 'টিয়া'],
];
// Bangla proverbs: [text with ____, the missing word, wrong words].
const PROVERBS = [
  ['অতি লোভে ____ নষ্ট।', 'তাঁতি', ['চাষি', 'মাঝি', 'ধোপা']], ['ঠেলার নাম ____।', 'বাবাজি', ['ভাইজান', 'মিয়াজি', 'দাদাজি']], ['যত গর্জে তত ____ না।', 'বর্ষে', ['হাসে', 'চলে', 'ভাসে']],
  ['দশের লাঠি ____ বোঝা।', 'একের', ['দুইয়ের', 'সবার', 'নিজের']], ['নাচতে না জানলে ____ বাঁকা।', 'উঠান', ['মঞ্চ', 'পা', 'ঘর']], ['সবুরে ____ ফলে।', 'মেওয়া', ['আম', 'ধান', 'কলা']],
  ['যেমন কর্ম তেমন ____।', 'ফল', ['ভাত', 'বই', 'মাছ']], ['স্বভাব যায় না ____।', 'মলে', ['চলে', 'বলে', 'ঢলে']], ['আপনি বাঁচলে ____ নাম।', 'বাপের', ['মায়ের', 'দাদার', 'গ্রামের']],
  ['চোরের মার বড় ____।', 'গলা', ['হাত', 'পেট', 'পা']], ['গাছে কাঁঠাল ____ তেল।', 'গোঁফে', ['হাতে', 'মাথায়', 'পায়ে']], ['এক হাতে ____ বাজে না।', 'তালি', ['ঢোল', 'বাঁশি', 'ঘণ্টা']],
  ['ইচ্ছা থাকলে ____ হয়।', 'উপায়', ['টাকা', 'সময়', 'বন্ধু']], ['লেখাপড়া করে যে, ____ চড়ে সে।', 'গাড়িঘোড়া', ['নৌকা', 'গাছে', 'পাহাড়ে']], ['উঠন্ত মূলো ____ চেনা যায়।', 'পত্তনেই', ['রাতেই', 'দামেই', 'হাটেই']],
];
const SCRAMBLE = [['বিদ্যালয়', 'school'], ['বন্ধু', 'friend'], ['আপেল', 'apple'], ['জল', 'water'], ['আম', 'mango'], ['ফুল', 'flower'], ['শিক্ষক', 'teacher'], ['বাগান', 'garden'], ['জানালা', 'window'], ['খরগোশ', 'rabbit'], ['কলম', 'pencil'], ['মেঘ', 'cloud']];
const PICS = [['🐘', 'হাতি'], ['🐅', 'বাঘ'], ['🐟', 'মাছ'], ['🌳', 'গাছ'], ['🍌', 'কলা'], ['🚲', 'সাইকেল'], ['🏠', 'বাড়ি'], ['⭐', 'তারা'], ['🌙', 'চাঁদ'], ['☀️', 'সূর্য'], ['🐓', 'মুরগি'], ['🐄', 'গরু'], ['🚌', 'বাস'], ['🐦', 'পাখি'], ['🍎', 'আপেল'], ['📖', 'বই']];

const sub = text => h('p', { class: 'de-row__sub', text });
// One round of multiple-choice questions. make(rnd) -> { head, big, hint, options: [text], right: text }. The right answer lights up for a moment after each tap.
function quiz(rounds, make, label) {
  return (root, done, rnd = Math.random) => {
    const t0 = Date.now(); let i = 0, correct = 0, timer;
    const qs = Array.from({ length: rounds }, () => make(rnd));
    const step = () => {
      const q = qs[i]; let locked = false;
      const buttons = q.options.map(o => h('button', { class: 'st-opt', type: 'button', onclick: () => {
        if (locked) return; locked = true;
        const ok = o === q.right; if (ok) correct++;
        buttons.forEach(b => { if (b.dataset.v === q.right) b.classList.add('is-right'); else if (b === buttons[q.options.indexOf(o)]) b.classList.add('is-wrong'); });
        timer = setTimeout(() => { i++; if (i < rounds) step(); else done({ correct, total: rounds, seconds: GameLogic.clampSeconds(Date.now() - t0) }); }, 650);
      } }, h('span', { text: q.label ? q.label(o) : o })));
      buttons.forEach((b, k) => { b.dataset.v = q.options[k]; });
      root.replaceChildren(sub(bn(`${i + 1}/${rounds}`)), h('section', { class: 'de-card st-q', 'aria-label': label }, q.hint ? sub(q.hint) : null, h('div', { class: 'st-big', text: q.big }), h('div', { class: 'st-opts' }, ...buttons)));
    };
    step();
    return () => clearTimeout(timer);
  };
}
const pick = (list, rnd) => list[Math.floor(rnd() * list.length)];

export const MORE_GAMES = {
  true_false: quiz(10, rnd => { const [big, right] = pick(TRUE_FALSE, rnd); return { hint: 'সত্যি না মিথ্যা?', big, options: ['সত্যি', 'মিথ্যা'], right: right ? 'সত্যি' : 'মিথ্যা' }; }, 'সত্যি না মিথ্যা'),
  odd_one_out: quiz(6, rnd => { const [odd, ...group] = pick(ODD, rnd); return { hint: 'কোনটা দলে মেলে না?', big: '🤔', options: GameLogic.shuffle([odd, ...GameLogic.shuffle(group, rnd).slice(0, 3)], rnd), right: odd }; }, 'বেমানান কোনটা'),
  number_pattern: quiz(6, rnd => { const q = GameLogic.patternQuestion(rnd); return { hint: 'পরের সংখ্যাটা কত?', big: bn(q.shown.join(', ') + ', ?'), options: q.options, right: q.ans, label: bn }; }, 'সংখ্যার ধাঁধা'),
  proverb_fill: quiz(6, rnd => { const [text, right, bad] = pick(PROVERBS, rnd); return { hint: 'ফাঁকা জায়গায় কী বসবে?', big: text, options: GameLogic.shuffle([right, ...bad], rnd), right }; }, 'প্রবাদ পূরণ'),
  emoji_guess: quiz(8, rnd => { const [e, right] = pick(PICS, rnd); return { hint: 'এটা কী?', big: e, options: GameLogic.shuffle([right, ...GameLogic.shuffle(PICS.map(p => p[1]).filter(x => x !== right), rnd).slice(0, 3)], rnd), right }; }, 'ছবি দেখে বলো'),
  // Tap the letters in the right order. Wrong tries are free; the word counts as right only if the first try was right.
  letter_scramble(root, done, rnd = Math.random) {
    const words = GameLogic.shuffle(SCRAMBLE, rnd).slice(0, 5), t0 = Date.now(); let i = 0, correct = 0, tapped = [], tries = 0, tiles = [];
    const load = () => { const w = words[i][1]; tiles = GameLogic.shuffle([...w], rnd); if (tiles.join('') === w) tiles.reverse(); tapped = []; tries = 0; };
    const next = () => { i++; if (i < words.length) { load(); draw(); } else done({ correct, total: words.length, seconds: GameLogic.clampSeconds(Date.now() - t0) }); };
    const draw = () => {
      const [clue, w] = words[i], built = tapped.map(k => tiles[k]).join(''), full = tapped.length === w.length, right = full && built === w;
      root.replaceChildren(sub(bn(`${i + 1}/${words.length}`)), h('section', { class: 'de-card st-q' }, sub('বাংলা অর্থ দেখে ইংরেজি শব্দটা বানাও'), h('div', { class: 'st-big', text: clue }),
        h('div', { class: 'st-big', 'aria-live': 'polite', text: built || '…' }),
        h('div', { class: 'st-opts' }, ...tiles.map((t, k) => h('button', { class: 'st-opt' + (tapped.includes(k) ? ' is-right' : ''), type: 'button', 'aria-disabled': tapped.includes(k) ? 'true' : null, onclick: () => {
          if (tapped.includes(k) || tapped.length >= w.length) return;
          tapped.push(k);
          if (tapped.length < w.length) return draw();
          draw();
          if (tapped.map(x => tiles[x]).join('') === w) { if (tries === 0) correct++; setTimeout(next, 600); } else { tries++; setTimeout(() => { tapped = []; draw(); }, 700); }
        } }, h('span', { text: t })))),
        right ? sub('বাহ, ঠিক হয়েছে!') : full ? sub('আরেকটু ভেবে দেখো, আবার সাজাও।') : null,
        h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: () => { tapped = []; draw(); }, text: 'মুছে আবার সাজাই' })));
    };
    load(); draw();
  },
};

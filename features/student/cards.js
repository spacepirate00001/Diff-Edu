// Cards of the student's "আজ" (same classes and look as the approved guardian screen, features/today/v7.js; student voice: "তুমি").
// Every function takes plain data and returns a node. Nothing here talks to the server.
import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { bn } from '../../core/bn.js';

const card = (cls, ...k) => h('section', { class: 'v6-card' + (cls ? ' ' + cls : '') }, ...k);
export const starsRow = (score, max) => {
  const on = Math.max(0, Math.min(5, Math.round(score / (max || 10) * 5)));
  return h('span', { class: 'de-stars', role: 'img', 'aria-label': bn(`৫টির মধ্যে ${on}টি তারা`) }, ...Array.from({ length: 5 }, (_, i) => h('i', { class: 'de-star' + (i < on ? ' de-star--on' : ''), style: { '--k': String(i) } })));
};
export const sticker = (text, color, star) => h('span', { class: 'de-sticker' + (color ? ' de-sticker--' + color : '') }, h('i', { class: star ? 'de-star' : 'de-diamond' }), bn(text));
const scoreWords = ratio => (ratio >= 0.8 ? 'আজ তো আগুন! স্কোর দারুণ হয়েছে।' : ratio >= 0.5 ? 'ভালোই যাচ্ছে, আরেকটু জোশ লাগাও!' : 'আরেকটু চেষ্টায় আরও ভালো হবে।');
const MOOD_LINE = { cheering: 'আজ তো তুমি দারুণ!', happy: 'আজ নতুন কিছু শেখা হোক!', encouraging: 'ধীরে ধীরে, তুমি পারবে!', sleepy: 'কাল আবার দেখা হবে, ঠিক আছে?' };

// today: { status: 'present'|'absent'|'none', arrived_at, score, score_max, note: { text, by } }
export function heroCard(today, streak, { onAsk, quote } = {}) {
  const max = today.score_max ?? 10, has = today.status === 'present' && today.score != null, ratio = has ? today.score / max : null;
  const mood = today.status === 'absent' ? 'sleepy' : today.status !== 'present' ? 'happy' : ratio == null ? 'happy' : ratio >= 0.8 ? 'cheering' : ratio < 0.5 ? 'encouraging' : 'happy';
  const chip = today.status === 'present' ? ['de-chip--now', 'আজ তুমি উপস্থিত'] : today.status === 'absent' ? ['de-chip--bad', 'আজ তুমি আসোনি'] : ['de-chip--plain', 'এখনো হাজিরা হয়নি'];
  const cap = today.status === 'present' ? (today.arrived_at ? `${bn(today.arrived_at)}-এ পৌঁছেছ` : null) : today.status === 'absent' ? 'সব ঠিক আছে তো? কাল আবার এসো, আমরা অপেক্ষায় আছি।' : 'ক্লাস শুরু হলে এখানে দেখা যাবে';
  const info = h('div', { class: 'tg-col v7-info' }, h('span', { class: 'de-chip ' + chip[0], text: chip[1] }), cap ? h('span', { class: 'de-today__cap', text: cap }) : null, has ? starsRow(today.score, max) : null,
    today.status === 'present' ? h('span', { class: 'de-today__cap', text: has ? 'আজকের স্কোর · ' + scoreWords(ratio) : 'স্কোর এখনো আসেনি' }) : null);
  const row = h('div', { class: 'v7-row' });
  if (today.status === 'present') {
    const ring = h('div', { class: 'v7-ring', role: 'img', 'aria-label': has ? bn(`আজকের স্কোর ${max}-এর মধ্যে ${today.score}`) : 'স্কোর এখনো আসেনি', style: { '--v7-p': String(has ? Math.round(ratio * 100) : 0) } },
      h('span', { class: 'v7-big', 'aria-hidden': 'true', text: has ? bn(today.score) : '—' }), has ? h('span', { class: 'v7-of', 'aria-hidden': 'true', text: bn('/' + max) }) : null);
    row.append(ring);
  }
  row.append(info);
  const face = window.Diffy ? window.Diffy.make(mood) : null;
  const bubble = h(onAsk ? 'button' : 'p', { class: 'de-bubble', type: onAsk ? 'button' : null, 'aria-haspopup': onAsk ? 'dialog' : null, onclick: onAsk, text: onAsk ? 'ডিফিকে কিছু জিজ্ঞেস করবে?' : MOOD_LINE[mood] });
  const perch = h('button', { class: 'de-mascot-btn v7-dfy', type: 'button', 'aria-label': 'ডিফি, চাপ দিলে নতুন কথা বলবে' }, face);
  if (face && window.Diffy) window.Diffy.attachTap(perch, bubble, face);
  const hero = h('div', { class: 'v7-hero v7-hero--a v7-glow', 'data-hero': 'a' }, row, h('div', { class: 'v7-say' }, perch, bubble));
  if (today.status === 'present' && today.note?.text) hero.append(h('div', { class: 'v7-ribbon' }, h('p', { class: 'de-today__quote tg-quote' }, bn(`“${today.note.text}”`), today.note.by ? h('span', { class: 'de-today__cap tg-quote-by', text: bn(today.note.by) }) : null)));
  return hero;
}
export function nextClassCard(n) {
  return card('', h('div', { class: 'de-next' }, h('span', { class: 'de-next__time' }, bn(n.time_label), n.period_label ? h('span', { class: 'de-row__sub', text: n.period_label }) : null),
    h('div', { class: 'de-next__main' }, h('span', { class: 'de-row__sub', text: 'পরের ক্লাস' }), h('span', { class: 'de-row__title', text: bn(n.subject) }), h('span', { class: 'de-row__sub', text: bn([n.teacher, n.room].filter(Boolean).join(' · ')) }))));
}
// tasks: [{ title, due_label }]; onOpen opens the full homework page
export function homeworkCard(tasks, onOpen) {
  if (!tasks.length) return card('', h('span', { class: 'de-row__sub', text: 'বাড়ির কাজ' }), h('span', { class: 'de-row__title', text: 'আজ বাড়ির কাজ নেই। একটু বিশ্রাম!' }));
  return card('', h('div', { class: 'de-row' }, h('div', { class: 'de-row__main' }, h('span', { class: 'de-row__sub', text: 'বাড়ির কাজ' }), h('span', { class: 'de-row__title', text: `${bn(tasks.length)}টা কাজ বাকি` })), h('span', { class: 'de-chip de-chip--warn', text: 'বাকি' })),
    h('ul', { class: 'st-list' }, ...tasks.map(t => h('li', {}, h('i', { class: 'de-diamond', 'aria-hidden': 'true' }), h('span', {}, bn(t.title), h('span', { class: 'de-row__sub', text: ` · ${t.due_label}` }))))),
    h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: onOpen, text: 'বাড়ির কাজ খোলো' }));
}
export function examCard(e, onOpen) {
  const when = e.days_left === 0 ? 'আজ' : e.days_left === 1 ? 'কাল' : `${bn(e.days_left)} দিন পরে`;
  return card('', h('div', { class: 'de-row' }, h('div', { class: 'de-row__main' }, h('span', { class: 'de-row__sub', text: 'পরের পরীক্ষা' }), h('span', { class: 'de-row__title', text: e.title })), h('span', { class: 'de-chip de-chip--now', text: when })),
    h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: onOpen, text: 'পড়ার পরিকল্পনা দেখো' }));
}
export function weekCard(week, streak) {
  const present = week.filter(d => d.state === 'present').length;
  const dots = h('div', { class: 'de-week' }, ...week.map(d => h('span', { class: 'de-week__day' }, h('i', { class: 'de-week__dot' + (d.state === 'present' ? (d.is_today ? ' de-week__dot--today' : '') : d.state === 'absent' ? ' de-week__dot--absent' : ' de-week__dot--none'), role: 'img', 'aria-label': `${d.day}: ${d.state === 'present' ? 'উপস্থিত' : d.state === 'absent' ? 'অনুপস্থিত' : 'এখনো হয়নি'}` }), d.day)));
  const line = streak >= 2 ? h('div', { class: 'de-streak de-streak--fun' }, sticker(`টানা ${streak} দিন হাজির!`, 'sunny'), h('span', { text: 'একদিনও কামাই নেই। 🔥' })) : h('div', { class: 'de-streak' }, h('i', { class: 'de-diamond' }), h('span', { text: 'নিয়মিত আসা বড় অভ্যাস। আজই শুরু হোক।' }));
  return card('', h('div', { class: 'de-row' }, h('div', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: 'এই সপ্তাহ' })), h('span', { class: 'de-row__sub tg-caption-end', text: `${bn(present)} দিন উপস্থিত` })), dots, line);
}
export function trendCard(trend) {
  const scored = trend.filter(d => d.score != null);
  const grid = h('div', { class: 'de-trend', role: 'img', 'aria-label': 'গত ৭ দিনের স্কোর: ' + bn(trend.map(d => `${d.day} ${d.score == null ? 'নেই' : d.score}`).join(', ')) },
    ...trend.map(d => h('span', { class: 'de-trend__col' }, h('span', { class: 'de-trend__val' + (d.is_today ? ' de-trend__val--hi' : ''), text: d.score == null ? '—' : bn(d.score) }),
      h('span', { class: 'de-trend__track' }, h('i', { class: 'de-trend__bar' + (d.is_today ? ' de-trend__bar--hi' : '') + (d.score == null ? ' de-trend__bar--none' : ''), style: d.score == null ? null : { '--v': String(Math.round(d.score / (d.score_max || 10) * 100)) } })), d.day)));
  return card('', h('span', { class: 'de-row__title', text: 'গত ৭ দিনের স্কোর' }), grid, scored.length < 2 ? h('span', { class: 'de-row__sub', text: 'আরও কয়েক দিনে ছবিটা পরিষ্কার হবে।' }) : null);
}
// stars: the child's own stars; onOpen goes to "খেলা"
export function starsCard(stars, line, onOpen) {
  return card('', h('div', { class: 'de-row' }, h('div', { class: 'de-row__main' }, h('span', { class: 'de-row__sub', text: 'তোমার স্টার' }), h('span', { class: 'de-row__title st-stars__n' }, icon('star'), bn(stars))), h('span', { class: 'de-chip de-chip--plain', text: 'কুইজ খেললে বাড়ে' })),
    h('span', { class: 'de-row__sub', text: line }), h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: onOpen, text: 'কুইজ খেলো, স্টার জমাও' }));
}
export function nudgeCard(list) {
  return card('de-nudge', h('div', { class: 'de-nudge__head' }, window.Diffy ? window.Diffy.make('happy', 'de-mascot--sm') : null, h('span', { class: 'de-row__title', text: 'ডিফি কানে কানে বলছে:' })),
    h('ul', { class: 'de-nudge__list' }, ...list.map(n => h('li', {}, h('i', { class: 'de-diamond' }), h('span', { text: bn(n.text) })))),
    h('span', { class: 'de-nudge__who', text: 'নিয়ম মেনে বানানো রিমাইন্ডার, কোনো জাদু বা AI না!' }));
}
export const askButton = onAsk => h('button', { class: 'de-btn de-btn--secondary de-btn--ask v6-ask', type: 'button', 'aria-haspopup': 'dialog', onclick: onAsk }, window.Diffy ? window.Diffy.make('happy', 'de-mascot--sm') : null, 'ডিফিকে জিজ্ঞেস করো');

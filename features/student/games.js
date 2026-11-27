// শেখার খেলা (44-games.sql, 70-more-games.sql, 73-new-games.sql): six games. The server recomputes the score and caps play at 30 minutes a day (no opening hours any more).
// This file is loaded only when a student opens "খেলা -> শেখার খেলা".
import { h } from '../../ui/dom.js';
import { confetti, fx, stats, MISSION } from './fx.js';
import { emptyState, loading, stateCard } from '../../ui/states.js';
import { sel, rpc, rows } from '../../core/api.js';
import { bn, dhakaDay } from '../../core/bn.js';
import { me, progressCard, noRecState } from './common.js';
import { GameLogic, GAME_RULES, gameError } from './logic.js';
import { MORE_GAMES } from './games-more.js';
import { ACTION_GAMES } from './games-action.js';
import { NEW_GAMES } from './games-new.js';

const EMOJI = { fpv_drone: '🚁', quick_fire: '⚡', math_race: '🔢', shoot_math: '🎈', memory_pairs: '🃏', letter_scramble: '🔤', haat_shop: '🛒', monster_battle: '⚔️', number_merge: '🎯', word_detective: '🕵️' };

// Each game: run(root, done, rnd, { cls }). done({ correct, total, seconds }) when the round ends. rnd is injectable.
export const GAMES = { ...MORE_GAMES, ...ACTION_GAMES, ...NEW_GAMES };

// ---- list of games, with the time left today ----
async function usedToday(rec) { const r = await sel('game_sessions', `select=seconds&student_id=eq.${rec.id}&played_on=eq.${dhakaDay()}`); return r.kind === 'ok' ? rows(r).reduce((n, x) => n + (x.seconds || 0), 0) : null; }
export function gamesPage(ctx) {
  const root = h('div', { class: 'st-page' });
  let dead = false;
  (async () => {
    root.append(loading(2));
    const rec = await me();
    if (!rec) return root.replaceChildren(noRecState());
    const used = await usedToday(rec);
    if (dead) return;
    if (used == null) return root.replaceChildren(stateCard({ kind: 'offline', title: 'ইশ, নেট হারিয়ে গেছে', text: 'নেট চালু করে আবার চেষ্টা করো।', action: 'আবার চেষ্টা করো', onAction: () => ctx.replace('/play/games') }));
    const left = GameLogic.secondsLeft(used);
    if (left <= 0) return root.replaceChildren(progressCard(rec), stateCard({ kind: 'empty', title: 'আজকের খেলার সময় শেষ', text: 'দিনে ৩০ মিনিট খেলা যায়। কাল আবার খেলো। এখন চাইলে কুইজ দিতে পারো।', action: 'কুইজে যাও', onAction: () => ctx.go('/learn/quiz') }));
    const v = stats.view(rec.id), done = v.today.length;
    root.replaceChildren(progressCard(rec), h('section', { class: 'de-card' }, h('span', { class: 'de-row__sub', text: 'আজ আরও খেলা যাবে' }), h('span', { class: 'gx-big', text: bn(Math.floor(left / 60)) + ' মিনিট' })),
      h('section', { class: 'de-card gm-mission' }, h('div', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: done >= MISSION ? '🎉 আজকের মিশন শেষ!' : `🎯 আজকের মিশন: ${bn(MISSION)}টা আলাদা খেলা খেলো` }), h('span', { class: 'de-row__sub', text: `${bn(Math.min(done, MISSION))}/${bn(MISSION)} হয়েছে${v.streak ? ` · 🔥 টানা ${bn(v.streak)} দিন` : ''}` })),
        h('div', { class: 'gm-dots', 'aria-hidden': 'true' }, ...Array.from({ length: MISSION }, (_, i) => h('i', { class: i < done ? 'is-on' : '' })))),
      h('div', { class: 'st-tiles' }, ...Object.entries(GAME_RULES).map(([k, [name, rule]]) => h('button', { class: 'st-tile', type: 'button', onclick: () => ctx.go('/play/games/' + k) }, h('span', { class: 'st-tile__e', 'aria-hidden': 'true', text: EMOJI[k] || '🎮' }), h('span', { class: 'st-tile__t', text: name }), h('span', { class: 'st-tile__s', text: bn(rule) }),
        v.best[k] ? h('span', { class: 'st-tile__s gm-best', text: `সেরা: ${bn(v.best[k])} পয়েন্ট` }) : h('span', { class: 'st-tile__s gm-best', text: 'নতুন! খেলে দেখো' })))),
      h('p', { class: 'de-row__sub gx-note', text: 'প্রতিটা ঠিক উত্তরে ১০ পয়েন্ট, সব ঠিক হলে আরও ২০। হারার কিছু নেই, শুধু শেখা।' }));
  })();
  return { node: root, destroy() { dead = true; } };
}

// ---- one game ----
export function gamePage(ctx, game) {
  const root = h('div', { class: 'st-page' });
  let stop = null, dead = false;
  if (!GAMES[game]) return { node: emptyState('এই খেলাটা পাওয়া গেল না', 'খেলার তালিকা থেকে আরেকটা বেছে নাও।', h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: () => ctx.replace('/play/games'), text: 'খেলার তালিকা' })) };
  const start = async () => {
    const rec = await me();
    if (!rec || dead) return;
    stop = GAMES[game](root, async r => {
      stop?.(); root.replaceChildren(loading(1));
      const send = async () => {
        const res = await rpc('submit_game_session', { p_student_id: rec.id, p_game: game, p_correct: r.correct, p_total: r.total, p_seconds: r.seconds });
        if (dead) return;
        if (res.kind === 'ok') {
          const pts = GameLogic.points(r.correct, r.total), st = stats.record(rec.id, game, pts), great = r.correct === r.total || r.correct / r.total >= 0.7;
          if (great || st.isBest) { fx.win(); confetti(); } else fx.end();
          root.replaceChildren(h('section', { class: 'de-card st-result' }, window.Diffy ? window.Diffy.make(r.correct === r.total ? 'cheering' : 'happy', 'de-mascot--lg') : null, h('h2', { class: 'st-result__n', id: 'page-title', tabindex: '-1', text: `${bn(r.correct)}/${bn(r.total)} সঠিক!` }),
            h('p', { class: 'gx-big', text: `+${bn(pts)} পয়েন্ট` }),
            st.isBest ? h('span', { class: 'de-chip de-chip--good', text: `🏅 নতুন সেরা! আগে ছিল ${bn(st.prev)}` }) : st.prev ? h('span', { class: 'de-chip de-chip--plain', text: `তোমার সেরা: ${bn(Math.max(st.prev, pts))} পয়েন্ট` }) : null,
            st.missionJust ? h('span', { class: 'de-chip de-chip--good', text: '🎉 আজকের মিশন শেষ!' }) : h('span', { class: 'de-row__sub', text: `আজ ${bn(st.today)}টা আলাদা খেলা খেলেছ${st.streak > 1 ? ` · 🔥 টানা ${bn(st.streak)} দিন` : ''}` }),
            ...(r.extra || []).map(t => h('span', { class: 'de-chip de-chip--good', text: t })),
            h('p', { class: 'de-row__sub', text: `আজ আরও ${bn(Math.floor((+res.data || 0) / 60))} মিনিট খেলা যাবে।` }),
            h('div', { class: 'st-actions' }, h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: () => { root.replaceChildren(); start(); }, text: 'আবার খেলো' }), h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: () => ctx.replace('/play/games'), text: 'অন্য খেলা' }))));
          root.querySelector('#page-title')?.focus({ preventScroll: true });
        } else root.replaceChildren(stateCard({ kind: res.kind === 'offline' ? 'offline' : 'error', title: res.kind === 'offline' ? 'ইশ, নেট হারিয়ে গেছে' : 'স্কোর জমা হয়নি', text: res.kind === 'offline' || res.kind === 'server' ? 'নেট চালু করে আবার পাঠাও। তোমার ফল আছে।' : gameError(res.data?.message), action: res.kind === 'offline' || res.kind === 'server' ? 'আবার পাঠাও' : 'খেলার তালিকা', onAction: res.kind === 'offline' || res.kind === 'server' ? send : () => ctx.replace('/play/games') }));
      };
      send();
    }, Math.random, { cls: rec.class_level, id: rec.id });
  };
  start();
  return { node: root, destroy() { dead = true; stop?.(); } };
}

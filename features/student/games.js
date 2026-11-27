// শেখার খেলা (44-games.sql): five short games. The server recomputes the score, caps play at 30 minutes a day and refuses play outside 6:00-22:00 (Dhaka).
// This file is loaded only when a student opens "খেলা -> শেখার খেলা".
import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { emptyState, loading, stateCard } from '../../ui/states.js';
import { sel, rpc, rows } from '../../core/api.js';
import { sky } from '../../core/sky.js';
import { bn, ascii, dhakaDay } from '../../core/bn.js';
import { me, progressCard, noRecState } from './common.js';
import { GameLogic, GAME_RULES, ROUND_SECONDS, gameError } from './logic.js';
import { MORE_GAMES } from './games-more.js';
import { ACTION_GAMES } from './games-action.js';

const WORDS = [['বই', 'book'], ['জল', 'water'], ['আকাশ', 'sky'], ['গাছ', 'tree'], ['মাছ', 'fish'], ['ফুল', 'flower']];
const SPELL = [['বই', 'book', ['buk', 'bok']], ['জল', 'water', ['wator', 'watar']], ['স্কুল', 'school', ['scool', 'skool']], ['বন্ধু', 'friend', ['frend', 'freind']], ['আম', 'mango', ['mengo', 'manggo']], ['আপেল', 'apple', ['aple', 'appel']]];
const SEQUENCES = [['সকাল', 'দুপুর', 'বিকেল', 'রাত'], ['বীজ', 'চারা', 'গাছ', 'ফল'], ['ডিম', 'বাচ্চা', 'বড় মুরগি', 'ডিম পাড়া']];
const EMOJI = ['🐶', '🐱', '🐼', '🦊'];
const dhakaHour = () => Math.floor(sky.minutes() / 60) % 24;
const options = (rnd, right, pool) => GameLogic.shuffle([right, ...GameLogic.shuffle(pool.filter(x => x !== right), rnd).slice(0, 3)], rnd);
const opt = (text, onclick) => h('button', { class: 'st-opt', type: 'button', onclick }, h('span', { text }));

const timedRace = gen => (root, done, rnd = Math.random) => {
  const t0 = Date.now(); let correct = 0, total = 0, q, over = false, tick;
  const end = () => { if (over) return; over = true; clearInterval(tick); done({ correct, total, seconds: GameLogic.clampSeconds(Date.now() - t0) }); };
  const left = h('p', { class: 'de-row__sub st-center', 'aria-live': 'off' }), input = h('input', { class: 'de-field__input st-answer', inputmode: 'numeric', autocomplete: 'off', 'aria-label': 'তোমার উত্তর' });
  const show = () => { left.textContent = bn(`${Math.max(0, ROUND_SECONDS - Math.floor((Date.now() - t0) / 1000))} সেকেন্ড · ${correct} সঠিক`); };
  const ask = () => { q = gen(rnd); qEl.textContent = bn(`${q.a} ${q.op} ${q.b} = ?`); input.value = ''; input.focus(); };
  const qEl = h('div', { class: 'st-big', 'aria-live': 'polite' });
  const go = () => { if (over || input.value.trim() === '') return; total++; if (+ascii(input.value) === q.ans) correct++; show(); ask(); };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  root.replaceChildren(left, h('section', { class: 'de-card st-q' }, qEl, input, h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: go, text: 'উত্তর দাও' })), h('button', { class: 'de-btn de-btn--text', type: 'button', onclick: end, text: 'এখানেই শেষ করি' }));
  tick = setInterval(() => { show(); if (Date.now() - t0 >= ROUND_SECONDS * 1000) end(); }, 1000);
  show(); ask();
  return () => { over = true; clearInterval(tick); };
};

// Each game: run(root, done). done({ correct, total, seconds }) when the round ends. rnd is injectable.
export const GAMES = {
  math_race: timedRace(GameLogic.mathQuestion),
  times_table: timedRace(GameLogic.tableQuestion),
  word_match(root, done, rnd = Math.random) {
    const qs = GameLogic.shuffle(WORDS, rnd).slice(0, 5), given = [], t0 = Date.now(); let i = 0;
    const step = () => {
      const [b, en] = qs[i];
      root.replaceChildren(h('p', { class: 'de-row__sub', text: bn(`${i + 1}/${qs.length}`) }), h('section', { class: 'de-card st-q' }, h('div', { class: 'st-big', text: b }), h('div', { class: 'st-opts' }, ...options(rnd, en, WORDS.map(w => w[1])).map(o => opt(o, () => {
        given.push(o); i++; if (i < qs.length) step(); else done({ correct: GameLogic.countRight(qs.map(q => q[1]), given), total: qs.length, seconds: GameLogic.clampSeconds(Date.now() - t0) });
      })))));
    };
    step();
  },
  spelling_b(root, done, rnd = Math.random) {
    const qs = GameLogic.shuffle(SPELL, rnd), t0 = Date.now(); let correct = 0, i = 0;
    const step = () => {
      const [clue, good, bad] = qs[i];
      root.replaceChildren(h('p', { class: 'de-row__sub', text: bn(`${i + 1}/${qs.length}`) }), h('section', { class: 'de-card st-q' }, h('div', { class: 'st-big', text: clue }), h('p', { class: 'de-row__sub st-center', text: 'ঠিক বানানটি কোনটি?' }), h('div', { class: 'st-opts' }, ...GameLogic.shuffle([good, ...bad], rnd).map(o => opt(o, () => {
        correct += GameLogic.countRight([good], [o]); i++; if (i < qs.length) step(); else done({ correct, total: qs.length, seconds: GameLogic.clampSeconds(Date.now() - t0) });
      })))));
    };
    step();
  },
  memory_pairs(root, done, rnd = Math.random) {
    const deck = GameLogic.shuffle([...EMOJI, ...EMOJI], rnd), t0 = Date.now(); let open = [], gone = new Set(), busy = false, correct = 0, timer;
    const draw = () => {
      root.replaceChildren(h('p', { class: 'de-row__sub st-center', text: bn(`${correct}/${EMOJI.length} জোড়া`) }), h('div', { class: 'st-cards' }, ...deck.map((e, i) => h('button', { class: 'st-card' + (gone.has(i) ? ' is-gone' : ''), type: 'button', 'aria-label': open.includes(i) || gone.has(i) ? e : `কার্ড ${bn(i + 1)}`, 'aria-disabled': gone.has(i) ? 'true' : null, text: open.includes(i) || gone.has(i) ? e : '?', onclick: () => {
        if (busy || gone.has(i) || open.includes(i)) return;
        open.push(i); draw();
        if (open.length < 2) return;
        busy = true; const [a, c] = open;
        if (GameLogic.isPair(deck, a, c)) { gone.add(a); gone.add(c); correct++; open = []; busy = false; if (correct === EMOJI.length) return done({ correct, total: EMOJI.length, seconds: GameLogic.clampSeconds(Date.now() - t0) }); draw(); }
        else timer = setTimeout(() => { open = []; busy = false; draw(); }, 800);
      } }))));
    };
    draw();
    return () => clearTimeout(timer);
  },
  sequence(root, done, rnd = Math.random) {
    const ordered = SEQUENCES[Math.floor(rnd() * SEQUENCES.length)], tiles = GameLogic.shuffle(ordered, rnd), t0 = Date.now(); let tapped = [];
    const draw = () => {
      root.replaceChildren(h('p', { class: 'de-row__sub st-center', text: bn(`${tapped.length}/${ordered.length} · ঠিক ক্রমে একের পর এক ট্যাপ করো`) }), h('div', { class: 'st-opts' }, ...tiles.map((t, i) => h('button', { class: 'st-opt' + (tapped.includes(i) ? ' is-right' : ''), type: 'button', 'aria-disabled': tapped.includes(i) ? 'true' : null, onclick: () => {
        if (tapped.includes(i)) return;
        tapped.push(i);
        if (tapped.length < ordered.length) return draw();
        done({ correct: GameLogic.countRight(ordered, tapped.map(k => tiles[k])), total: ordered.length, seconds: GameLogic.clampSeconds(Date.now() - t0) });
      } }, h('span', { text: tapped.includes(i) ? `${bn(tapped.indexOf(i) + 1)}. ${t}` : t })))), h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: () => { tapped = []; draw(); }, text: 'আবার সাজাই' }));
    };
    draw();
  },
  ...MORE_GAMES,
  ...ACTION_GAMES,
};

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
    if (!GameLogic.isOpen(dhakaHour())) return root.replaceChildren(progressCard(rec), stateCard({ kind: 'empty', title: 'এখন খেলার সময় নয়', text: 'খেলা সকাল ৬টা থেকে রাত ১০টা পর্যন্ত খোলা। একটু ঘুমিয়ে নাও, কাল আবার খেলো।' }));
    if (used == null) return root.replaceChildren(stateCard({ kind: 'offline', title: 'ইশ, নেট হারিয়ে গেছে', text: 'নেট চালু করে আবার চেষ্টা করো।', action: 'আবার চেষ্টা করো', onAction: () => ctx.replace('/play/games') }));
    const left = GameLogic.secondsLeft(used);
    if (left <= 0) return root.replaceChildren(progressCard(rec), stateCard({ kind: 'empty', title: 'আজকের খেলার সময় শেষ', text: 'দিনে ৩০ মিনিট খেলা যায়। কাল আবার খেলো। এখন চাইলে কুইজ দিতে পারো।', action: 'কুইজে যাও', onAction: () => ctx.go('/learn/quiz') }));
    root.replaceChildren(progressCard(rec), h('section', { class: 'de-card' }, h('span', { class: 'de-row__sub', text: 'আজ আরও খেলা যাবে' }), h('span', { class: 'gx-big', text: bn(Math.floor(left / 60)) + ' মিনিট' })),
      h('div', { class: 'st-tiles' }, ...Object.entries(GAME_RULES).map(([k, [name, rule]]) => h('button', { class: 'st-tile', type: 'button', onclick: () => ctx.go('/play/games/' + k) }, h('span', { class: 'st-tile__e', 'aria-hidden': 'true' }, icon('gamepad')), h('span', { class: 'st-tile__t', text: name }), h('span', { class: 'st-tile__s', text: bn(rule) })))),
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
    if (!GameLogic.isOpen(dhakaHour())) return root.replaceChildren(stateCard({ kind: 'empty', title: 'এখন খেলার সময় নয়', text: 'খেলা সকাল ৬টা থেকে রাত ১০টা পর্যন্ত।', action: 'ফিরে যাও', onAction: () => ctx.replace('/play/games') }));
    stop = GAMES[game](root, async r => {
      stop?.(); root.replaceChildren(loading(1));
      const send = async () => {
        const res = await rpc('submit_game_session', { p_student_id: rec.id, p_game: game, p_correct: r.correct, p_total: r.total, p_seconds: r.seconds });
        if (dead) return;
        if (res.kind === 'ok') {
          root.replaceChildren(h('section', { class: 'de-card st-result' }, window.Diffy ? window.Diffy.make(r.correct === r.total ? 'cheering' : 'happy', 'de-mascot--lg') : null, h('h2', { class: 'st-result__n', id: 'page-title', tabindex: '-1', text: `${bn(r.correct)}/${bn(r.total)} সঠিক!` }),
            h('p', { class: 'de-row__sub', text: `${bn(GameLogic.points(r.correct, r.total))} পয়েন্ট। আজ আরও ${bn(Math.floor((+res.data || 0) / 60))} মিনিট খেলা যাবে।` }),
            h('div', { class: 'st-actions' }, h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: () => { root.replaceChildren(); start(); }, text: 'আবার খেলো' }), h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: () => ctx.replace('/play/games'), text: 'অন্য খেলা' }))));
          root.querySelector('#page-title')?.focus({ preventScroll: true });
        } else root.replaceChildren(stateCard({ kind: res.kind === 'offline' ? 'offline' : 'error', title: res.kind === 'offline' ? 'ইশ, নেট হারিয়ে গেছে' : 'স্কোর জমা হয়নি', text: res.kind === 'offline' || res.kind === 'server' ? 'নেট চালু করে আবার পাঠাও। তোমার ফল আছে।' : gameError(res.data?.message), action: res.kind === 'offline' || res.kind === 'server' ? 'আবার পাঠাও' : 'খেলার তালিকা', onAction: res.kind === 'offline' || res.kind === 'server' ? send : () => ctx.replace('/play/games') }));
      };
      send();
    });
  };
  start();
  return { node: root, destroy() { dead = true; stop?.(); } };
}

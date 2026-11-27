// The tap-and-think games: চটজলদি (all the quick questions in one race), ম্যাথ রেস (on-screen number pad), জোড়া কার্ড, অক্ষর সাজাও.
// Each game: run(root, done, rnd, { cls }) and done({ correct, total, seconds }) when the round ends. The server only sees correct / total / seconds,
// so combos and hearts here are for the feel; points stay 10 per right answer (+20 when everything is right). Loaded only with games.js.
import { h } from '../../ui/dom.js';
import { bn } from '../../core/bn.js';
import { GameLogic } from './logic.js';
import { fx, makeHud } from './fx.js';
import { quickQ, mathQ, EASY_WORDS, HARD_WORDS, PICS, SCRAMBLE } from './questions.js';

const sub = text => h('p', { class: 'de-row__sub st-center', text });
const secs = t0 => GameLogic.clampSeconds(Date.now() - t0);

// ---- চটজলদি: every kind of quick question, mixed. Time runs down; right answers add time, wrong ones cost time and a heart ----
const QUICK_START = 60, QUICK_CAP = 90, HEARTS = 3;
function quickFire(root, done, rnd = Math.random, { cls = 5 } = {}) {
  const t0 = Date.now(), seen = new Set(), hud = makeHud({ hearts: HEARTS, maxTime: QUICK_CAP }), box = h('div', { class: 'gm-box' });
  let left = QUICK_START, hearts = HEARTS, right = 0, wrong = 0, combo = 0, locked = false, over = false, next, last = Date.now();
  const show = () => hud.set({ time: left, text: bn(`${Math.ceil(left)} সেকেন্ড · ${right} সঠিক`), hearts, combo });
  const end = () => { if (over) return; over = true; clearInterval(tick); clearTimeout(next); fx.end(); done({ correct: right, total: Math.max(1, right + wrong), seconds: secs(t0) }); };
  const ask = () => {
    const q = quickQ(rnd, cls, right, seen); locked = false;
    const buttons = q.options.map(o => { const b = h('button', { class: 'st-opt', type: 'button' }, h('span', { text: o })); b.dataset.v = o; return b; });
    buttons.forEach(b => b.addEventListener('click', () => {
      if (locked || over) return; locked = true;
      const ok = b.dataset.v === q.right;
      buttons.forEach(x => { if (x.dataset.v === q.right) x.classList.add('is-right'); else if (x === b) x.classList.add('is-wrong'); });
      if (ok) { right++; combo++; left = Math.min(QUICK_CAP, left + (combo >= 3 ? 4 : 3)); fx.ok(combo); }
      else { wrong++; combo = 0; hearts--; left = Math.max(0, left - 5); fx.bad(); box.classList.remove('gm-shake'); void box.offsetWidth; box.classList.add('gm-shake'); }
      show();
      next = setTimeout(() => { if (hearts <= 0 || left <= 0) end(); else ask(); }, ok ? 420 : 950);
    }));
    box.replaceChildren(h('section', { class: 'de-card st-q' }, sub(q.hint), h('div', { class: 'st-big', text: q.big }), h('div', { class: 'st-opts' }, ...buttons)));
  };
  const tick = setInterval(() => { const now = Date.now(); if (!locked) left -= (now - last) / 1000; last = now; if (left <= 0 && !locked) end(); else show(); }, 100);
  root.replaceChildren(hud.el, box, h('button', { class: 'de-btn de-btn--text', type: 'button', onclick: end, text: 'এখানেই শেষ করি' }));
  ask(); show();
  return () => { over = true; clearInterval(tick); clearTimeout(next); };
}

// ---- ম্যাথ রেস: 60 seconds, a big number pad (no phone keyboard covering the screen), the answer goes in by itself when it has enough digits ----
function mathRace(root, done, rnd = Math.random, { cls = 5 } = {}) {
  const t0 = Date.now(), hud = makeHud({ maxTime: 60 }), qEl = h('div', { class: 'st-big', 'aria-live': 'polite' }), ansEl = h('div', { class: 'gm-ans', 'aria-live': 'off' }), card = h('section', { class: 'de-card st-q' }, qEl, ansEl);
  let left = 60, right = 0, wrong = 0, combo = 0, q, buf = '', over = false, last = Date.now();
  const show = () => hud.set({ time: left, text: bn(`${Math.ceil(left)} সেকেন্ড · ${right} সঠিক`), combo });
  const end = () => { if (over) return; over = true; clearInterval(tick); document.removeEventListener('keydown', onKey); fx.end(); done({ correct: right, total: Math.max(1, right + wrong), seconds: secs(t0) }); };
  const ask = () => { q = mathQ(rnd, cls, right); buf = ''; qEl.textContent = q.prompt; ansEl.textContent = '…'; };
  const submit = () => {
    if (over || !buf) return;
    if (+buf === q.ans) { right++; combo++; fx.ok(combo); } else { wrong++; combo = 0; fx.bad(); card.classList.remove('gm-shake'); void card.offsetWidth; card.classList.add('gm-shake'); }
    show(); ask();
  };
  const press = d => { if (over) return; buf += d; ansEl.textContent = bn(buf); if (buf.length >= String(q.ans).length) submit(); };
  const back = () => { buf = buf.slice(0, -1); ansEl.textContent = buf ? bn(buf) : '…'; };
  const onKey = e => { if (/^[0-9]$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') back(); else if (e.key === 'Enter') submit(); };
  const key = (label, fn, aria) => h('button', { class: 'gm-key', type: 'button', 'aria-label': aria || null, onclick: fn, text: label });
  const pad = h('div', { class: 'gm-pad' }, ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => key(bn(d), () => press(String(d)))), key('⌫', back, 'মোছো'), key(bn(0), () => press('0')), key('✓', submit, 'উত্তর দাও'));
  document.addEventListener('keydown', onKey);
  const tick = setInterval(() => { const now = Date.now(); left -= (now - last) / 1000; last = now; if (left <= 0) end(); else show(); }, 100);
  root.replaceChildren(hud.el, card, pad, h('button', { class: 'de-btn de-btn--text', type: 'button', onclick: end, text: 'এখানেই শেষ করি' }));
  ask(); show();
  return () => { over = true; clearInterval(tick); document.removeEventListener('keydown', onKey); };
}

// ---- জোড়া কার্ড: more pairs in higher classes. Little ones match a picture with its Bangla name; older ones match a Bangla word with its English ----
function memoryPairs(root, done, rnd = Math.random, { cls = 5 } = {}) {
  const n = cls <= 3 ? 4 : cls <= 6 ? 6 : 8, t0 = Date.now(), hud = makeHud();
  const pool = cls <= 3 ? PICS : cls <= 6 ? EASY_WORDS : [...EASY_WORDS, ...HARD_WORDS];
  const chosen = GameLogic.shuffle(pool, rnd).slice(0, n);
  const deck = GameLogic.shuffle(chosen.flatMap(([a, b], id) => [{ id, text: a }, { id, text: b }]), rnd);
  let open = [], gone = new Set(), busy = false, misses = 0, timer;
  const info = () => hud.set({ text: bn(`${gone.size / 2}/${n} জোড়া · ${misses} ভুল`) });
  const cards = deck.map((c, i) => h('button', { class: 'st-card' + (c.text.length > 2 ? ' st-card--w' : ''), type: 'button', 'aria-label': `কার্ড ${bn(i + 1)}`, text: '?', onclick: () => flip(i) }));
  const refresh = () => cards.forEach((b, i) => { const up = open.includes(i) || gone.has(i); b.textContent = up ? deck[i].text : '?'; b.classList.toggle('is-gone', gone.has(i)); b.setAttribute('aria-disabled', gone.has(i) ? 'true' : 'false'); });
  function flip(i) {
    if (busy || gone.has(i) || open.includes(i)) return;
    open.push(i); fx.tick(); refresh();
    if (open.length < 2) return;
    const [a, b] = open;
    if (deck[a].id === deck[b].id) {
      gone.add(a); gone.add(b); open = []; fx.ok(gone.size / 2); refresh(); info();
      if (gone.size === deck.length) { const allowed = Math.ceil(n / 2); done({ correct: Math.max(1, n - Math.max(0, Math.floor((misses - allowed + 1) / 2))), total: n, seconds: secs(t0) }); }
    } else { misses++; busy = true; fx.bad(); info(); timer = setTimeout(() => { open = []; busy = false; refresh(); }, 900); }
  }
  root.replaceChildren(hud.el, sub('দুটো করে কার্ড উল্টে একই জোড়া মেলাও। কম ভুল করলে পুরো পয়েন্ট!'), h('div', { class: 'st-cards' }, ...cards));
  info();
  return () => clearTimeout(timer);
}

// ---- অক্ষর সাজাও: six words, a hint button. The word counts as right only if it was built without a hint and right the first time ----
function letterScramble(root, done, rnd = Math.random, { cls = 5 } = {}) {
  const pool = cls <= 4 ? SCRAMBLE.filter(([, en]) => en.length <= 5) : SCRAMBLE, words = GameLogic.shuffle(pool, rnd).slice(0, 6), t0 = Date.now(), hud = makeHud();
  let i = 0, correct = 0, combo = 0, tapped = [], tries = 0, tiles = [], timer;
  const load = () => { const w = words[i][1]; tiles = GameLogic.shuffle([...w], rnd); if (tiles.join('') === w) tiles.reverse(); tapped = []; tries = 0; };
  const next = () => { i++; if (i < words.length) { load(); draw(); } else done({ correct, total: words.length, seconds: secs(t0) }); };
  const draw = () => {
    const [clue, w] = words[i], built = tapped.map(k => tiles[k]).join(''), full = tapped.length === w.length;
    hud.set({ text: bn(`${i + 1}/${words.length} · ${correct} সঠিক`), combo });
    const hint = () => { tries++; tapped = []; for (const ch of w) { const k = tiles.findIndex((t, x) => t === ch && !tapped.includes(x)); if (k >= 0) { tapped.push(k); break; } } draw(); };
    root.replaceChildren(hud.el, h('section', { class: 'de-card st-q' }, sub('বাংলা অর্থ দেখে ইংরেজি শব্দটা বানাও'), h('div', { class: 'st-big', text: clue }), h('div', { class: 'st-big gm-built', 'aria-live': 'polite', text: built || '…' }),
      h('div', { class: 'st-cards' }, ...tiles.map((t, k) => h('button', { class: 'st-card' + (tapped.includes(k) ? ' is-gone' : ''), type: 'button', 'aria-disabled': tapped.includes(k) ? 'true' : 'false', text: t, onclick: () => {
        if (tapped.includes(k) || tapped.length >= w.length) return;
        tapped.push(k); fx.tick(); draw();
        if (tapped.length < w.length) return;
        if (tapped.map(x => tiles[x]).join('') === w) { if (tries === 0) { correct++; combo++; } else combo = 0; fx.ok(combo); timer = setTimeout(next, 700); } else { tries++; combo = 0; fx.bad(); timer = setTimeout(() => { tapped = []; draw(); }, 800); }
      } }))),
      full ? sub(built === w ? 'বাহ, ঠিক হয়েছে!' : 'আরেকটু ভেবে দেখো, আবার সাজাও।') : null,
      h('div', { class: 'st-actions' }, h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: () => { tapped = []; draw(); }, text: 'মুছে আবার সাজাই' }), h('button', { class: 'de-btn de-btn--text', type: 'button', onclick: hint, text: '💡 ইঙ্গিত (প্রথম অক্ষর)' }))));
  };
  load(); draw();
  return () => clearTimeout(timer);
}

export const MORE_GAMES = { quick_fire: quickFire, math_race: mathRace, memory_pairs: memoryPairs, letter_scramble: letterScramble };

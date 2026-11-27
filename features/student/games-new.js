// Four more games: হাটের দোকান (give the right change), দানব লড়াই (beat monsters with right answers), সংখ্যা জোড়া (reach the target number), শব্দ গোয়েন্দা (guess the English word).
// Each game: run(root, done, rnd, { cls, id }) and done({ correct, total, seconds, extra? }). The server only sees correct / total / seconds, so points stay 10 per right answer (+20 when all are right). Loaded only with games.js.
import { h } from '../../ui/dom.js';
import { bn, money } from '../../core/bn.js';
import { GameLogic } from './logic.js';
import { fx, makeHud, stats } from './fx.js';
import { quickQ } from './questions.js';
import { shopOrder, mergePuzzle, detectiveWord, applyOp } from './questions-play.js';

const sub = text => h('p', { class: 'de-row__sub st-center', text });
const secs = t0 => GameLogic.clampSeconds(Date.now() - t0);
const shake = el => { el.classList.remove('gm-shake'); void el.offsetWidth; el.classList.add('gm-shake'); };

// ---- হাটের দোকান: six customers. Build the change from notes and coins, then press ✓ ----
function haatShop(root, done, rnd = Math.random, { cls = 5 } = {}) {
  const CUSTOMERS = 6, PATIENCE = Number(cls) <= 3 ? 60 : 45, t0 = Date.now(), hud = makeHud({ maxTime: PATIENCE }), box = h('div', { class: 'gm-box' }), faces = GameLogic.shuffle(['👵', '👨‍🌾', '👩', '🧒', '👴', '🧕'], rnd);
  let n = 0, correct = 0, wrong = 0, combo = 0, order, tray = [], left = PATIENCE, locked = false, over = false, next, last = Date.now(), msgEl, trayEl;
  const sum = () => tray.reduce((a, b) => a + b, 0);
  const show = () => hud.set({ time: left, text: bn(`${Math.min(n + 1, CUSTOMERS)}/${CUSTOMERS} জন · ${correct} সঠিক`), combo });
  const end = () => { if (over) return; over = true; clearInterval(tick); clearTimeout(next); fx.end(); done({ correct, total: CUSTOMERS, seconds: secs(t0) }); };
  const refresh = () => { trayEl.replaceChildren(...(tray.length ? tray.map((d, i) => h('button', { class: 'gm-denom is-note is-small', type: 'button', 'aria-label': `${bn(d)} টাকা সরাও`, onclick: () => { if (!locked) { tray.splice(i, 1); fx.tick(); refresh(); } }, text: money(d) })) : [h('span', { class: 'de-row__sub', text: 'নোট বা কয়েনে ট্যাপ করে ফেরত সাজাও' })])); msgEl.textContent = `ফেরত দিচ্ছ: ${money(sum())}`; };
  const finish = (ok, why) => {
    if (locked || over) return; locked = true;
    if (ok) { correct++; combo++; fx.ok(combo); msgEl.textContent = 'ধন্যবাদ! 😊'; } else { wrong++; combo = 0; fx.bad(); shake(box); msgEl.textContent = `${why} ঠিক ফেরত ছিল ${money(order.change)}।`; }
    show(); n++;
    next = setTimeout(() => (n >= CUSTOMERS ? end() : serve()), ok ? 800 : 2200);
  };
  const serve = () => {
    order = shopOrder(rnd, cls); tray = []; left = PATIENCE; locked = false;
    msgEl = h('p', { class: 'de-row__sub st-center', 'aria-live': 'polite' }); trayEl = h('div', { class: 'gm-tray' });
    box.replaceChildren(h('section', { class: 'de-card st-q' },
      h('div', { class: 'gm-cust' }, h('span', { class: 'gm-face', 'aria-hidden': 'true', text: faces[n % faces.length] }), h('div', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: 'ক্রেতা বলছে:' }), h('span', { class: 'de-row__sub', text: `"আমি নিলাম, আর ${money(order.paid)} দিলাম। ফেরত কত?"` }))),
      h('div', { class: 'gm-order' }, ...order.lines.map(l => h('div', { class: 'de-row gx-line' }, h('span', { class: 'de-row__main', text: `${l.emoji} ${l.name} ${bn(l.qty)} ${l.unit} × ${money(l.price)}` }), h('b', { text: money(l.sum) }))), h('div', { class: 'de-row gx-line gm-total' }, h('span', { class: 'de-row__main', text: 'মোট' }), h('b', { text: money(order.total) }))),
      trayEl, msgEl,
      h('div', { class: 'gm-denoms' }, ...order.denoms.map(d => h('button', { class: 'gm-denom' + (d >= 10 ? ' is-note' : ''), type: 'button', 'aria-label': `${bn(d)} টাকা`, onclick: () => { if (locked) return; tray.push(d); fx.tick(); refresh(); }, text: money(d) }))),
      h('div', { class: 'st-actions' }, h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: () => { if (!locked) { tray = []; refresh(); } }, text: 'মুছে আবার' }), h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: () => finish(sum() === order.change, 'ইশ, মেলেনি!'), text: '✓ ফেরত দিলাম' }))));
    refresh(); show();
  };
  const tick = setInterval(() => { const now = Date.now(); if (!locked) left -= (now - last) / 1000; last = now; if (left <= 0 && !locked) finish(false, 'সময় শেষ!'); else show(); }, 100);
  root.replaceChildren(hud.el, box, h('button', { class: 'de-btn de-btn--text', type: 'button', onclick: end, text: 'এখানেই শেষ করি' }));
  serve();
  return () => { over = true; clearInterval(tick); clearTimeout(next); };
}

// ---- দানব লড়াই: three monsters (the last is the boss). A right answer hits, three right in a row is a big hit. A wrong answer costs a heart. Beat a monster once and it joins your collection ----
const MONSTERS = [['👾', 'রোবো-ভূত'], ['🐙', 'অক্টো-দৈত্য'], ['🦖', 'ডাইনো-রাজা'], ['🐉', 'আগুন-ড্রাগন'], ['🦂', 'বিছা-সম্রাট'], ['🐊', 'কুমির-দানব'], ['🦑', 'স্কুইড-ভূত'], ['🕷️', 'মাকড়সা-রানি']];
function monsterBattle(root, done, rnd = Math.random, { cls = 5, id = '' } = {}) {
  const t0 = Date.now(), hud = makeHud({ hearts: 3, bar: false }), seen = new Set(), line = GameLogic.shuffle(MONSTERS, rnd).slice(0, 3), HP = [3, 4, 6], extra = [];
  let m = 0, hp = HP[0], hearts = 3, right = 0, wrong = 0, combo = 0, locked = false, over = false, next;
  const monEl = h('div', { class: 'gm-mon', 'aria-hidden': 'true' }), nameEl = h('div', { class: 'de-row__title st-center' }), hpFill = h('i'), hpBar = h('div', { class: 'gm-bar gm-hp', role: 'presentation' }, hpFill), msg = h('p', { class: 'gm-note st-center de-row__sub', 'aria-live': 'polite' }), qbox = h('div', { class: 'gm-box' });
  const show = () => { hud.set({ text: bn(`দানব ${m + 1}/${line.length} · ${right} ঠিক`), hearts, combo }); hpFill.style.width = Math.max(0, hp / HP[m] * 100) + '%'; };
  const setMon = () => { const [e, name] = line[m]; monEl.textContent = e; nameEl.textContent = (m === line.length - 1 ? '👑 বস: ' : '') + name; hp = HP[m]; show(); };
  const end = () => { if (over) return; over = true; clearTimeout(next); fx.end(); done({ correct: right, total: Math.max(1, right + wrong), seconds: secs(t0), extra }); };
  const ask = () => {
    const q = quickQ(rnd, cls, right, seen); locked = false;
    const buttons = q.options.map(o => { const b = h('button', { class: 'st-opt', type: 'button' }, h('span', { text: o })); b.dataset.v = o; return b; });
    buttons.forEach(b => b.addEventListener('click', () => {
      if (locked || over) return; locked = true;
      const ok = b.dataset.v === q.right;
      buttons.forEach(x => { if (x.dataset.v === q.right) x.classList.add('is-right'); else if (x === b) x.classList.add('is-wrong'); });
      if (ok) {
        right++; combo++; const big = combo >= 3; hp -= big ? 2 : 1; fx.ok(combo); monEl.classList.remove('is-hit'); void monEl.offsetWidth; monEl.classList.add('is-hit'); msg.textContent = big ? '💥 মহা-আঘাত!' : '⚔️ আঘাত!';
        if (big) combo = 0;
        if (hp <= 0) { hp = 0; show(); const isNew = id && stats.collect(id, line[m][1]); if (isNew) extra.push(`${line[m][0]} নতুন দানব ধরেছ: ${line[m][1]}!`); fx.win(); msg.textContent = `🎉 ${line[m][1]} হেরে গেল!`; m++; next = setTimeout(() => { if (m >= line.length) end(); else { setMon(); msg.textContent = ''; ask(); } }, 1300); return; }
      } else { wrong++; combo = 0; hearts--; fx.bad(); shake(qbox); msg.textContent = '😵 দানব আঘাত করেছে!'; }
      show();
      next = setTimeout(() => { if (hearts <= 0) end(); else ask(); }, ok ? 500 : 1000);
    }));
    qbox.replaceChildren(h('section', { class: 'de-card st-q' }, sub(q.hint), h('div', { class: 'st-big', text: q.big }), h('div', { class: 'st-opts' }, ...buttons)));
  };
  root.replaceChildren(hud.el, h('section', { class: 'de-card gm-arena' }, monEl, nameEl, hpBar, msg), qbox, h('button', { class: 'de-btn de-btn--text', type: 'button', onclick: end, text: 'এখানেই শেষ করি' }));
  setMon(); ask();
  return () => { over = true; clearTimeout(next); };
}

// ---- সংখ্যা জোড়া: pick a number, pick + − × ÷, pick another number; they join. Make the target number appear. Five puzzles ----
const PUZZLES = 5, MERGE_TIME = 150;
function numberMerge(root, done, rnd = Math.random, { cls = 5 } = {}) {
  const t0 = Date.now(), c = Number(cls) || 5, ops = c <= 4 ? ['+', '−'] : c <= 6 ? ['+', '−', '×'] : ['+', '−', '×', '÷'], hud = makeHud({ maxTime: MERGE_TIME }), box = h('div', { class: 'gm-box' });
  let n = 0, solved = 0, p, tiles, hist, a = null, op = null, won = false, left = MERGE_TIME, over = false, last = Date.now(), next;
  const show = () => hud.set({ time: left, text: bn(`${Math.min(n + 1, PUZZLES)}/${PUZZLES} ধাঁধা · ${solved} মিলেছে`) });
  const end = () => { if (over) return; over = true; clearInterval(tick); clearTimeout(next); fx.end(); done({ correct: solved, total: PUZZLES, seconds: secs(t0) }); };
  const nextPuzzle = () => { n++; if (n >= PUZZLES) end(); else load(); };
  const load = () => { p = mergePuzzle(rnd, cls); tiles = p.nums.map(v => ({ v })); hist = []; a = null; op = null; won = false; draw(); show(); };
  const pickTile = i => {
    if (won || over) return; fx.tick();
    if (a === null || op === null) { a = i; return draw(); }
    if (i === a) { a = null; op = null; return draw(); }
    let x = tiles[a].v, y = tiles[i].v; if ((op === '−' || op === '÷') && x < y) [x, y] = [y, x];
    const r = applyOp(x, op, y);
    if (r == null || r < 1) { fx.bad(); a = null; op = null; draw(); shake(box); return; }
    hist.push(tiles); tiles = [...tiles.filter((_, k) => k !== a && k !== i), { v: r }]; a = null; op = null;
    if (tiles.some(t => t.v === p.target)) { won = true; solved++; fx.ok(solved); fx.win(); draw(); show(); next = setTimeout(nextPuzzle, 1000); return; }
    fx.boost(); draw();
  };
  const draw = () => {
    const stuck = !won && tiles.length === 1;
    box.replaceChildren(h('section', { class: 'de-card st-q' }, sub('দুটো সংখ্যা জোড়া লাগিয়ে এই সংখ্যাটা বানাও'), h('div', { class: 'st-big gm-target', 'aria-live': 'polite', text: `🎯 ${bn(p.target)}` }),
      h('div', { class: 'gm-tiles' }, ...tiles.map((t, i) => h('button', { class: 'gm-tile' + (a === i ? ' is-on' : '') + (won && t.v === p.target ? ' is-win' : ''), type: 'button', onclick: () => pickTile(i), text: bn(t.v) }))),
      h('div', { class: 'gm-ops' }, ...ops.map(o => h('button', { class: 'gm-key' + (op === o ? ' is-on' : ''), type: 'button', 'aria-label': o === '+' ? 'যোগ' : o === '−' ? 'বিয়োগ' : o === '×' ? 'গুণ' : 'ভাগ', onclick: () => { if (a === null || won) return; op = op === o ? null : o; fx.tick(); draw(); }, text: o }))),
      sub(won ? '🎉 মিলে গেছে!' : stuck ? 'মেলেনি। ↶ চেপে পিছিয়ে আবার চেষ্টা করো।' : a === null ? 'একটা সংখ্যা বাছো' : op === null ? 'এবার একটা চিহ্ন বাছো' : 'এবার আরেকটা সংখ্যা বাছো'),
      h('div', { class: 'st-actions' }, h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: () => { if (hist.length && !won) { tiles = hist.pop(); a = null; op = null; draw(); } }, text: '↶ পিছনে' }), h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: () => { if (!won) { tiles = p.nums.map(v => ({ v })); hist = []; a = null; op = null; draw(); } }, text: 'আবার শুরু' }), h('button', { class: 'de-btn de-btn--text', type: 'button', onclick: () => { if (!won) nextPuzzle(); }, text: 'পরেরটা' }))));
  };
  const tick = setInterval(() => { const now = Date.now(); left -= (now - last) / 1000; last = now; if (left <= 0) end(); else show(); }, 200);
  root.replaceChildren(hud.el, box, h('button', { class: 'de-btn de-btn--text', type: 'button', onclick: end, text: 'এখানেই শেষ করি' }));
  load();
  return () => { over = true; clearInterval(tick); clearTimeout(next); };
}

// ---- শব্দ গোয়েন্দা: the Bangla clue and blanks; tap letters. Three wrong letters and the word escapes. Five words ----
const WORDS_IN_ROUND = 5, LIVES = 3, ABC = 'abcdefghijklmnopqrstuvwxyz';
function wordDetective(root, done, rnd = Math.random, { cls = 5 } = {}) {
  const t0 = Date.now(), hud = makeHud({ hearts: LIVES, bar: false }), taken = new Set(), box = h('div', { class: 'gm-box' });
  let n = 0, correct = 0, combo = 0, w, got, tried = new Set(), lives, over = false, locked = false, next;
  const end = () => { if (over) return; over = true; clearTimeout(next); document.removeEventListener('keydown', onKey); fx.end(); done({ correct, total: WORDS_IN_ROUND, seconds: secs(t0) }); };
  const load = () => { w = detectiveWord(rnd, cls, taken); got = new Set(); tried = new Set(); lives = LIVES; locked = false; draw(); };
  const complete = () => [...w.word].every(ch => got.has(ch));
  const after = ok => { locked = true; if (ok) { correct++; combo++; fx.ok(combo); } else { combo = 0; fx.bad(); } n++; draw(); next = setTimeout(() => (n >= WORDS_IN_ROUND ? end() : load()), ok ? 900 : 1700); };
  const guess = ch => {
    if (locked || over || got.has(ch) || tried.has(ch)) return; tried.add(ch);
    if (w.word.includes(ch)) { got.add(ch); fx.tick(); if (complete()) return after(true); } else { lives--; fx.bad(); if (lives <= 0) { [...w.word].forEach(x => got.add(x)); return after(false); } }
    draw();
  };
  const draw = () => {
    hud.set({ text: bn(`${Math.min(n + 1, WORDS_IN_ROUND)}/${WORDS_IN_ROUND} শব্দ · ${correct} ধরা পড়ল`), hearts: lives, combo });
    const state = locked ? (complete() && lives > 0 ? '🎉 ধরে ফেলেছ!' : '😅 পালিয়ে গেল, শব্দটা ছিল এটা') : 'ইংরেজি শব্দটা কী? অক্ষরে ট্যাপ করো';
    box.replaceChildren(h('section', { class: 'de-card st-q' }, sub('বাংলা অর্থ দেখে ইংরেজি শব্দটা ধরো'), h('div', { class: 'st-big', text: w.clue }),
      h('div', { class: 'gm-slots', 'aria-live': 'polite', 'aria-label': 'শব্দ' }, ...[...w.word].map(ch => h('span', { class: 'gm-slot' + (got.has(ch) ? ' is-on' : ''), text: got.has(ch) ? ch : '' }))),
      sub(state),
      h('div', { class: 'gm-letters' }, ...[...ABC].map(ch => h('button', { class: 'gm-key gm-letter' + (tried.has(ch) ? (w.word.includes(ch) ? ' is-right' : ' is-wrong') : ''), type: 'button', 'aria-disabled': tried.has(ch) ? 'true' : 'false', onclick: () => guess(ch), text: ch })))));
  };
  const onKey = e => { if (/^[a-z]$/i.test(e.key)) guess(e.key.toLowerCase()); };
  document.addEventListener('keydown', onKey);
  root.replaceChildren(hud.el, box, h('button', { class: 'de-btn de-btn--text', type: 'button', onclick: end, text: 'এখানেই শেষ করি' }));
  load();
  return () => { over = true; clearTimeout(next); document.removeEventListener('keydown', onKey); };
}

export const NEW_GAMES = { haat_shop: haatShop, monster_battle: monsterBattle, number_merge: numberMerge, word_detective: wordDetective };

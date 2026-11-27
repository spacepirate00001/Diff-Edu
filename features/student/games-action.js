// Action learning games (70-more-games.sql): গণিত শুটার, শব্দ শুটার, ড্রোন মিশন. A round is about a minute and the score is only right answers,
// so the server rules stay the same. Drawing uses the app's colour tokens (read once, so light and dark both work). Loaded only with games.js.
import { h } from '../../ui/dom.js';
import { bn } from '../../core/bn.js';
import { GameLogic, ROUND_SECONDS } from './logic.js';

const PAIRS = [['বই', 'book'], ['জল', 'water'], ['আকাশ', 'sky'], ['গাছ', 'tree'], ['মাছ', 'fish'], ['ফুল', 'flower'], ['বাড়ি', 'house'], ['সূর্য', 'sun'], ['চাঁদ', 'moon'], ['পাখি', 'bird'], ['নদী', 'river'], ['বন্ধু', 'friend'], ['আম', 'mango'], ['কলম', 'pen'], ['দুধ', 'milk'], ['ভাত', 'rice']];

// Question makers: { prompt, right, wrongs: [..] } with the answers as plain strings.
const mathQ = rnd => {
  const kind = rnd(), a = 2 + Math.floor(rnd() * 9), b = 2 + Math.floor(rnd() * 9);
  const [prompt, ans] = kind < 0.4 ? [`${a} × ${b}`, a * b] : kind < 0.7 ? [`${a + b} − ${a}`, b] : [`${a * 3} + ${b}`, a * 3 + b];
  const wrongs = GameLogic.shuffle([ans + 1, ans - 1, ans + 2, ans - 2, ans + 10, ans + 3], rnd).filter(x => x >= 0 && x !== ans).slice(0, 3);
  return { prompt: bn(`${prompt} = ?`), right: bn(ans), wrongs: wrongs.map(bn) };
};
const wordQ = rnd => {
  const [bnw, en] = PAIRS[Math.floor(rnd() * PAIRS.length)];
  return { prompt: `${bnw} = ?`, right: en, wrongs: GameLogic.shuffle(PAIRS.map(p => p[1]).filter(x => x !== en), rnd).slice(0, 3) };
};

function theme() {
  const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim() || '#888';
  return { font: cs.getPropertyValue('--de-font').trim() || 'sans-serif', sky: v('--de-brand-soft'), ink: v('--de-ink'), onFun: v('--de-on-fun'), good: v('--de-good-solid'), bad: v('--de-bad-solid'), line: v('--de-line-ui'),
    balloon: [v('--de-fun-coral'), v('--de-fun-mint'), v('--de-fun-sky'), v('--de-fun-sunny')], brand: v('--de-brand') };
}
// A canvas as wide as its card. Returns the canvas, its 2d context and a function that maps a pointer event to canvas coordinates.
function makeCanvas(label, ratio) {
  const W = 340, H = Math.round(340 * ratio), dpr = Math.min(2, window.devicePixelRatio || 1);
  const cv = h('canvas', { class: 'st-canvas', width: W * dpr, height: H * dpr, role: 'img', 'aria-label': label, style: { width: '100%', 'aspect-ratio': `${W} / ${H}`, 'touch-action': 'none', 'border-radius': 'var(--de-r-md)' } });
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
  const at = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
  return { cv, ctx, W, H, at };
}
const loop = fn => { let id, last = performance.now(); const tick = now => { fn(Math.min(0.05, (now - last) / 1000)); last = now; id = requestAnimationFrame(tick); }; id = requestAnimationFrame(tick); return () => cancelAnimationFrame(id); };

// Balloons rise; tap one to shoot it. Right answer: a point. Wrong balloon, or the right one floating away: counts as a miss.
const shooter = make => (root, done, rnd = Math.random) => {
  const T = theme(), { cv, ctx, W, H, at } = makeCanvas('শুটিং: ঠিক উত্তরের বেলুনে ট্যাপ করো', 1.15);
  const t0 = Date.now(); let right = 0, miss = 0, q, balloons = [], pops = [], shots = [], left = ROUND_SECONDS, over = false;
  const qEl = h('div', { class: 'st-big', 'aria-live': 'polite' }), info = h('p', { class: 'de-row__sub st-center' });
  const info2 = () => { info.textContent = bn(`${Math.ceil(left)} সেকেন্ড · ${right} সঠিক · ${miss} ভুল`); };
  const spawn = () => {
    q = make(rnd); qEl.textContent = q.prompt;
    const lanes = GameLogic.shuffle([0, 1, 2, 3], rnd), words = [q.right, ...q.wrongs];
    balloons = words.map((t, i) => ({ t, ok: t === q.right, x: 42 + lanes[i] * ((W - 84) / 3), y: H + 40 + rnd() * 50, v: 46 + rnd() * 14, c: T.balloon[i % 4], r: 34 }));
  };
  const end = () => { if (over) return; over = true; stop(); done({ correct: right, total: Math.max(1, right + miss), seconds: GameLogic.clampSeconds(Date.now() - t0) }); };
  cv.addEventListener('pointerdown', e => {
    if (over) return; const [x, y] = at(e); shots.push({ x, y, t: 0.15 });
    const hit = balloons.find(b => Math.hypot(b.x - x, b.y - y) <= b.r * 1.25);
    if (!hit) return;
    pops.push({ x: hit.x, y: hit.y, c: hit.ok ? T.good : T.bad, t: 0.4 });
    if (hit.ok) { right++; spawn(); } else { miss++; balloons = balloons.filter(b => b !== hit); }
    info2();
  });
  const stop = loop(dt => {
    left -= dt; if (left <= 0) return end();
    for (const b of balloons) b.y -= b.v * dt;
    const gone = balloons.find(b => b.ok && b.y < -50); if (gone) { miss++; spawn(); }
    if (!balloons.some(b => b.ok)) spawn();
    pops.forEach(p => { p.t -= dt; }); pops = pops.filter(p => p.t > 0); shots.forEach(s => { s.t -= dt; }); shots = shots.filter(s => s.t > 0);
    ctx.fillStyle = T.sky; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 17px ${T.font}`;
    for (const b of balloons) {
      ctx.strokeStyle = T.line; ctx.beginPath(); ctx.moveTo(b.x, b.y + b.r); ctx.lineTo(b.x, b.y + b.r + 24); ctx.stroke();
      ctx.fillStyle = b.c; ctx.beginPath(); ctx.ellipse(b.x, b.y, b.r * 0.95, b.r * 1.1, 0, 0, 7); ctx.fill();
      ctx.fillStyle = T.onFun; ctx.fillText(b.t, b.x, b.y, b.r * 1.7);
    }
    for (const s of shots) { ctx.strokeStyle = T.brand; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(W / 2, H); ctx.lineTo(s.x, s.y); ctx.stroke(); }
    for (const p of pops) { ctx.strokeStyle = p.c; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, 50 * (1 - p.t / 0.4) + 8, 0, 7); ctx.stroke(); }
    ctx.fillStyle = T.brand; ctx.beginPath(); ctx.moveTo(W / 2 - 18, H); ctx.lineTo(W / 2 + 18, H); ctx.lineTo(W / 2, H - 26); ctx.fill();
    info2();
  });
  root.replaceChildren(info, h('section', { class: 'de-card st-q' }, h('p', { class: 'de-row__sub st-center', text: 'ঠিক উত্তরের বেলুনে ট্যাপ করে গুলি করো' }), qEl, cv), h('button', { class: 'de-btn de-btn--text', type: 'button', onclick: end, text: 'এখানেই শেষ করি' }));
  spawn(); info2();
  return () => { over = true; stop(); };
};

// The drone flies right; steer it up or down (drag on the sky, or use the two buttons) so it goes through the gate with the right answer.
const drone = (root, done, rnd = Math.random) => {
  const T = theme(), { cv, ctx, W, H, at } = makeCanvas('ড্রোন মিশন: ঠিক উত্তরের গেটের ভেতর দিয়ে ওড়াও', 0.9);
  const ROUNDS = 8, laneY = i => H * (0.2 + 0.3 * i), t0 = Date.now(); let n = 0, correct = 0, lane = 1, dy = laneY(1), q, gate, pause = 1.2, flash = null, over = false;
  const qEl = h('div', { class: 'st-big', 'aria-live': 'polite' }), info = h('p', { class: 'de-row__sub st-center' });
  const mk = () => { q = rnd() < 0.5 ? mathQ(rnd) : wordQ(rnd); qEl.textContent = q.prompt; const opts = GameLogic.shuffle([q.right, ...q.wrongs.slice(0, 2)], rnd); gate = { x: W + 10, opts }; };
  const setLane = i => { lane = Math.max(0, Math.min(2, i)); };
  const end = () => { if (over) return; over = true; stop(); done({ correct, total: ROUNDS, seconds: GameLogic.clampSeconds(Date.now() - t0) }); };
  cv.addEventListener('pointerdown', e => { setLane(Math.round(((at(e)[1] / H) - 0.2) / 0.3)); });
  cv.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'touch') setLane(Math.round(((at(e)[1] / H) - 0.2) / 0.3)); });
  root.addEventListener('keydown', e => { if (e.key === 'ArrowUp') setLane(lane - 1); if (e.key === 'ArrowDown') setLane(lane + 1); });
  const stop = loop(dt => {
    dy += (laneY(lane) - dy) * Math.min(1, dt * 9);
    if (pause > 0) { pause -= dt; if (pause <= 0 && n < ROUNDS) mk(); }
    else if (gate) {
      gate.x -= 80 * dt;
      if (gate.x < 78) { const ok = gate.opts[lane] === q.right; if (ok) correct++; flash = { ok, t: 0.7 }; n++; gate = null; if (n >= ROUNDS) pause = 0.8; else pause = 0.9; }
    } else if (n >= ROUNDS) { pause -= dt; if (pause <= 0) return end(); }
    if (flash) { flash.t -= dt; if (flash.t <= 0) flash = null; }
    ctx.fillStyle = T.sky; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = T.line; ctx.setLineDash([6, 8]); for (const i of [0, 1, 2]) { ctx.beginPath(); ctx.moveTo(0, laneY(i)); ctx.lineTo(W, laneY(i)); ctx.stroke(); } ctx.setLineDash([]);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 17px ${T.font}`;
    if (gate) gate.opts.forEach((o, i) => { ctx.fillStyle = T.balloon[(i + 1) % 4]; ctx.beginPath(); ctx.roundRect(gate.x - 40, laneY(i) - 24, 80, 48, 14); ctx.fill(); ctx.fillStyle = T.onFun; ctx.fillText(o, gate.x, laneY(i), 74); });
    // the drone: body, four rotors that spin, a little camera
    const dx = 52, spin = (Date.now() / 40) % 2;
    ctx.fillStyle = T.brand; ctx.beginPath(); ctx.roundRect(dx - 18, dy - 7, 36, 14, 7); ctx.fill();
    ctx.strokeStyle = T.ink; ctx.lineWidth = 3; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(dx + s * 12, dy - 7); ctx.lineTo(dx + s * 26, dy - 15); ctx.stroke(); ctx.beginPath(); ctx.ellipse(dx + s * 26, dy - 17, spin < 1 ? 14 : 8, 3, 0, 0, 7); ctx.stroke(); }
    ctx.fillStyle = T.ink; ctx.beginPath(); ctx.arc(dx, dy + 9, 4, 0, 7); ctx.fill();
    if (flash) { ctx.fillStyle = flash.ok ? T.good : T.bad; ctx.font = `700 26px ${T.font}`; ctx.fillText(flash.ok ? 'সাবাশ!' : 'আবার হবে', W / 2, H - 22); }
    info.textContent = bn(`${Math.min(n + 1, ROUNDS)}/${ROUNDS} · ${correct} সঠিক`);
  });
  const nudge = (d, label) => h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: () => setLane(lane + d), text: label });
  root.replaceChildren(info, h('section', { class: 'de-card st-q' }, qEl, cv, h('div', { class: 'st-actions' }, nudge(-1, '▲ উপরে'), nudge(1, '▼ নিচে'))), h('p', { class: 'de-row__sub st-center', text: 'আকাশে আঙুল টেনে বা বোতাম চেপে ড্রোন ওড়াও। ঠিক উত্তরের গেট দিয়ে যাও।' }));
  q = null; info.textContent = bn(`1/${ROUNDS} · 0 সঠিক`);
  return () => { over = true; stop(); };
};

export const ACTION_GAMES = { shoot_math: shooter(mathQ), shoot_words: shooter(wordQ), drone_mission: drone };

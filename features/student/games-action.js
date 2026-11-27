// বেলুন শুটার (maths and words together) and the FPV drone race (games-fpv.js). A round is about a minute and a half; the score is only right answers,
// so the server rules stay the same. Drawing uses the app's colour tokens. Loaded only with games.js.
import { h } from '../../ui/dom.js';
import { bn } from '../../core/bn.js';
import { GameLogic, ROUND_SECONDS } from './logic.js';
import { targetQ } from './questions.js';
import { theme, makeCanvas, loop } from './canvas.js';
import { fx, makeHud } from './fx.js';
import { fpvDrone } from './games-fpv.js';

// Balloons rise; tap one to shoot it. Right balloon: a point, a little more time, and the next balloons rise faster. A wrong balloon, or the right one floating away, is a miss.
function shooter(root, done, rnd = Math.random, { cls = 5 } = {}) {
  const T = theme(), { cv, ctx, W, H, at } = makeCanvas('শুটিং: ঠিক উত্তরের বেলুনে ট্যাপ করো', 1.15), hud = makeHud({ maxTime: ROUND_SECONDS + 20 });
  const t0 = Date.now(); let right = 0, miss = 0, combo = 0, q, balloons = [], pops = [], shots = [], left = ROUND_SECONDS, over = false;
  const qEl = h('div', { class: 'st-big', 'aria-live': 'polite' });
  const info = () => hud.set({ time: left, text: bn(`${Math.ceil(left)} সেকেন্ড · ${right} সঠিক · ${miss} ভুল`), combo });
  const spawn = () => {
    q = targetQ(rnd, cls, right); qEl.textContent = q.prompt;
    const lanes = GameLogic.shuffle([0, 1, 2, 3], rnd), words = [q.right, ...q.wrongs], speed = Math.min(40, right * 2.2);
    balloons = words.map((t, i) => ({ t, ok: t === q.right, x: 42 + lanes[i] * ((W - 84) / 3), y: H + 40 + rnd() * 50, v: 46 + speed + rnd() * 14, c: T.balloon[i % 4], r: 34 }));
  };
  const end = () => { if (over) return; over = true; stop(); fx.end(); done({ correct: right, total: Math.max(1, right + miss), seconds: GameLogic.clampSeconds(Date.now() - t0) }); };
  const missed = () => { miss++; combo = 0; left = Math.max(0, left - 3); fx.bad(); };
  cv.addEventListener('pointerdown', e => {
    if (over) return; const [x, y] = at(e); shots.push({ x, y, t: 0.15 });
    const hit = balloons.find(b => Math.hypot(b.x - x, b.y - y) <= b.r * 1.25);
    if (!hit) return;
    pops.push({ x: hit.x, y: hit.y, c: hit.ok ? T.good : T.bad, t: 0.4 });
    if (hit.ok) { right++; combo++; left = Math.min(ROUND_SECONDS + 20, left + 2); fx.ok(combo); spawn(); } else { missed(); balloons = balloons.filter(b => b !== hit); }
    info();
  });
  const stop = loop(dt => {
    left -= dt; if (left <= 0) return end();
    for (const b of balloons) b.y -= b.v * dt;
    const gone = balloons.find(b => b.ok && b.y < -50); if (gone) { missed(); spawn(); }
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
    info();
  });
  root.replaceChildren(hud.el, h('section', { class: 'de-card st-q' }, h('p', { class: 'de-row__sub st-center', text: 'ঠিক উত্তরের বেলুনে ট্যাপ করে গুলি করো। ঠিক হলে সময় বাড়ে, ভুলে কমে!' }), qEl, cv), h('button', { class: 'de-btn de-btn--text', type: 'button', onclick: end, text: 'এখানেই শেষ করি' }));
  spawn(); info();
  return () => { over = true; stop(); };
}

export const ACTION_GAMES = { shoot_math: shooter, fpv_drone: fpvDrone };

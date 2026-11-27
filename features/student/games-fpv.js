// FPV ড্রোন রেস: you fly through the ring with the right answer. Drag a finger on the screen to steer the drone (arrow keys work too).
// It is real first-person 3D (every ring, line and star is projected from its position in space), drawn with plain canvas, so there is nothing to download
// and it runs on cheap phones. If the phone is slow it lowers the sharpness and drops the extras by itself. Own design; the questions come from questions.js.
import { h } from '../../ui/dom.js';
import { bn } from '../../core/bn.js';
import { GameLogic } from './logic.js';
import { targetQ } from './questions.js';
import { theme, makeCanvas, loop } from './canvas.js';
import { fx, makeHud } from './fx.js';

const ROUNDS = 12, RING_R = 1.05, GATE_AT = 36, SPEED0 = 11, SPEED_MAX = 20, GROUND = 2.2, STARS = 22;
// Where the three rings hang (x across, y down), left to right.
const SLOTS = [[-2.2, 0.4], [0, -0.8], [2.2, 0.4]];

export function fpvDrone(root, done, rnd = Math.random, { cls = 5 } = {}) {
  const T = theme(), { cv, ctx, W, H, at, rescale } = makeCanvas('FPV ড্রোন: আঙুল টেনে ঠিক উত্তরের রিংয়ের ভেতর দিয়ে ওড়াও', 1.0, 1.5), F = W * 0.85, hud = makeHud({ bar: false });
  const t0 = Date.now(), cam = { x: 0, y: 0 }, aim = { x: 0, y: 0 };
  let dist = 0, speed = SPEED0, n = 0, correct = 0, combo = 0, q = null, gate = null, pause = 1.3, flash = null, shake = 0, boost = 0, over = false, low = false, fps = [];
  const stars = Array.from({ length: STARS }, () => ({ x: (rnd() - 0.5) * 14, y: (rnd() - 0.5) * 8, z: 4 + rnd() * 56 }));
  const qEl = h('div', { class: 'st-big', 'aria-live': 'polite' }), chips = h('div', { class: 'gm-chips' }), noteEl = h('p', { class: 'de-row__sub st-center gm-note', 'aria-live': 'polite' });
  const info = () => hud.set({ text: bn(`${Math.min(n + 1, ROUNDS)}/${ROUNDS} · ${correct} সঠিক`), combo });
  const end = () => { if (over) return; over = true; stop(); document.removeEventListener('keydown', onKey); fx.end(); done({ correct, total: ROUNDS, seconds: GameLogic.clampSeconds(Date.now() - t0) }); };

  const spawn = () => {
    q = targetQ(rnd, cls, correct);
    const order = GameLogic.shuffle([q.right, ...q.wrongs.slice(0, 2)], rnd);
    gate = { z0: GATE_AT, d0: dist, rings: order.map((t, i) => ({ t, ok: t === q.right, x: SLOTS[i][0], y: SLOTS[i][1], c: T.balloon[i] })) };
    qEl.textContent = q.prompt;
    chips.replaceChildren(...gate.rings.map(r => h('span', { class: 'gm-chip', style: { background: r.c, color: T.onFun }, text: r.t })));
    noteEl.textContent = 'আঙুল টেনে ঠিক উত্তরের রিংয়ের ভেতর দিয়ে ওড়াও';
  };
  const resolve = () => {
    const near = gate.rings.map(r => ({ r, d: Math.hypot(r.x - cam.x, r.y - cam.y) })).sort((a, b) => a.d - b.d)[0], hit = near.d <= RING_R * 1.5 ? near.r : null, ok = !!hit && hit.ok;
    n++;
    if (ok) { correct++; combo++; speed = Math.min(SPEED_MAX, speed + 0.8); boost = 0.5; fx.ok(combo); fx.boost(); noteEl.textContent = ''; }
    else { combo = 0; speed = Math.max(SPEED0, speed - 1.5); shake = 0.45; fx.bad(); noteEl.textContent = hit ? `ঠিক উত্তর ছিল: ${q.right}` : `রিংয়ের ভেতর দিয়ে যেতে হবে! ঠিক উত্তর: ${q.right}`; }
    flash = { ok, t: 0.9 }; gate = null; q = null; pause = 0.8; info();
    if (n >= ROUNDS) pause = 1.1;
  };

  const steer = e => { const [x, y] = at(e); aim.x = (x / W - 0.5) * 6.2; aim.y = (y / H - 0.5) * 3.8; };
  cv.addEventListener('pointerdown', e => { try { cv.setPointerCapture(e.pointerId); } catch { /* fine */ } steer(e); });
  cv.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'touch') steer(e); });
  const onKey = e => { const k = { ArrowLeft: [-0.5, 0], ArrowRight: [0.5, 0], ArrowUp: [0, -0.4], ArrowDown: [0, 0.4] }[e.key]; if (k) { e.preventDefault(); aim.x = Math.max(-3.1, Math.min(3.1, aim.x + k[0])); aim.y = Math.max(-1.9, Math.min(1.9, aim.y + k[1])); } };
  document.addEventListener('keydown', onKey);

  const P = (X, Y, z) => [W / 2 + (X - cam.x) * F / z, H / 2 + (Y - cam.y) * F / z];
  const stop = loop((dt, ms) => {
    // slow phone? lower the sharpness once and drop the extras
    fps.push(ms); if (fps.length >= 45) { if (!low && fps.reduce((a, b) => a + b, 0) / fps.length > 36) { low = true; rescale(1); } fps = []; }
    cam.x += (Math.max(-3.1, Math.min(3.1, aim.x)) - cam.x) * Math.min(1, dt * 5); cam.y += (Math.max(-1.9, Math.min(1.9, aim.y)) - cam.y) * Math.min(1, dt * 5);
    const bank = Math.max(-0.2, Math.min(0.2, (aim.x - cam.x) * 0.06));
    dist += speed * (1 + boost) * dt; boost = Math.max(0, boost - dt); shake = Math.max(0, shake - dt);
    if (pause > 0) { pause -= dt; if (pause <= 0) { if (n >= ROUNDS) return end(); spawn(); } }
    else if (gate && gate.z0 - (dist - gate.d0) <= 0.4) resolve();
    if (flash) { flash.t -= dt; if (flash.t <= 0) flash = null; }

    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * 10 * shake, (Math.random() - 0.5) * 10 * shake);
    ctx.translate(W / 2, H / 2); ctx.rotate(bank); ctx.translate(-W / 2, -H / 2);
    ctx.fillStyle = T.sky; ctx.fillRect(-70, -70, W + 140, H + 140);
    // the ground: lines that rush toward you
    const horizon = H / 2;
    ctx.fillStyle = T.balloon[1]; ctx.globalAlpha = 0.28; ctx.fillRect(-70, horizon, W + 140, H + 140 - horizon); ctx.globalAlpha = 1;
    ctx.strokeStyle = T.line; ctx.lineWidth = 1; ctx.globalAlpha = 0.7;
    const off = dist % 6;
    ctx.beginPath();
    for (let k = 0; k < 11; k++) { const z = k * 6 - off + 1.2; if (z < 1) continue; const y = H / 2 + (GROUND - cam.y) * F / z; ctx.moveTo(-70, y); ctx.lineTo(W + 70, y); }
    if (!low) for (let x = -16; x <= 16; x += 4) { const a = P(x, GROUND, 1.2), b = P(x, GROUND, 70); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
    ctx.stroke(); ctx.globalAlpha = 1;
    // streaks in the air: the feeling of speed
    if (!low) { ctx.strokeStyle = T.brand; ctx.globalAlpha = 0.45; ctx.lineWidth = 1.5; ctx.beginPath(); for (const s of stars) { s.z -= speed * (1 + boost) * dt; if (s.z < 1) { s.z = 55 + rnd() * 10; s.x = (rnd() - 0.5) * 14; s.y = (rnd() - 0.5) * 8; } const a = P(s.x, s.y, s.z), b = P(s.x, s.y, s.z + 0.9 + speed * 0.05); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); } ctx.stroke(); ctx.globalAlpha = 1; }
    // the rings
    if (gate) {
      const z = gate.z0 - (dist - gate.d0);
      if (z > 0.3) for (const r of gate.rings) {
        const [sx, sy] = P(r.x, r.y, z), rad = RING_R * F / z;
        ctx.globalAlpha = 0.3; ctx.fillStyle = r.c; ctx.beginPath(); ctx.arc(sx, sy, rad, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = r.c; ctx.lineWidth = Math.max(2, rad * 0.2); ctx.beginPath(); ctx.arc(sx, sy, rad, 0, 7); ctx.stroke();
        ctx.strokeStyle = T.ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(sx, sy, rad + Math.max(1, rad * 0.1), 0, 7); ctx.stroke();
        if (z < 20) { ctx.fillStyle = T.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 ${Math.max(12, Math.min(26, rad * 0.5))}px ${T.font}`; ctx.fillText(r.t, sx, sy, rad * 1.7); }
      }
    }
    ctx.restore();
    // the drone itself: crosshair and two spinning rotors at the bottom corners
    ctx.strokeStyle = T.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(W / 2, H / 2, 7, 0, 7); ctx.moveTo(W / 2 - 14, H / 2); ctx.lineTo(W / 2 - 9, H / 2); ctx.moveTo(W / 2 + 9, H / 2); ctx.lineTo(W / 2 + 14, H / 2); ctx.stroke();
    const spin = performance.now() / 18;
    for (const cx of [26, W - 26]) { ctx.beginPath(); for (let i = 0; i < 2; i++) { const a = (spin + i * 180) * Math.PI / 180; ctx.moveTo(cx - Math.cos(a) * 24, H - 6 - Math.sin(a) * 6); ctx.lineTo(cx + Math.cos(a) * 24, H - 6 + Math.sin(a) * 6); } ctx.stroke(); }
    if (flash) { ctx.fillStyle = flash.ok ? T.good : T.bad; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 28px ${T.font}`; ctx.fillText(flash.ok ? 'সাবাশ!' : 'আবার হবে', W / 2, H * 0.3); }
    if (!gate && pause > 0 && n === 0) { ctx.fillStyle = T.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 24px ${T.font}`; ctx.fillText('তৈরি হও…', W / 2, H * 0.3); }
  });
  root.replaceChildren(hud.el, h('section', { class: 'de-card st-q' }, qEl, chips, cv, noteEl), h('button', { class: 'de-btn de-btn--text', type: 'button', onclick: end, text: 'এখানেই শেষ করি' }));
  info();
  return () => { over = true; stop(); document.removeEventListener('keydown', onKey); };
}

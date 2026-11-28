// Game feel for the learning games: tiny sounds (WebAudio, no files), vibration, confetti, a top bar (time, hearts, combo), and the player's own bests, streak
// and daily mission. Bests, streak and mission are kept on this phone only (the server keeps the points). Sound and vibration can be switched off.
import { h } from '../../ui/dom.js';
import { aicon } from '../../ui/aicons.js';
import { bn, dhakaDay } from '../../core/bn.js';
import { addDays } from './logic.js';

const KEY = 'de_gfx';
const load = k => { try { return localStorage.getItem(k); } catch { return null; } };
const save = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode: nothing to keep */ } };
const calm = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
let on = load(KEY) !== 'off', actx = null;

function tone(freq, at, dur, type = 'sine', vol = 0.13) {
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + at;
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch { /* no audio on this phone: the game still works */ }
}
const play = (...notes) => { if (on) notes.forEach(n => tone(...n)); };
export const fx = {
  get on() { return on; },
  set(v) { on = !!v; save(KEY, on ? 'on' : 'off'); },
  ok(combo = 0) { const f = 520 + 40 * Math.min(combo, 8); play([f, 0, 0.12], [f * 1.5, 0.08, 0.16]); this.buzz(12); },
  bad() { play([170, 0, 0.22, 'sawtooth', 0.09]); this.buzz(70); },
  tick() { play([900, 0, 0.04, 'square', 0.04]); },
  boost() { play([300, 0, 0.12, 'triangle'], [600, 0.06, 0.2, 'triangle']); },
  win() { play([523, 0, 0.16], [659, 0.14, 0.16], [784, 0.28, 0.16], [1047, 0.42, 0.34]); this.buzz([30, 40, 30]); },
  end() { play([392, 0, 0.18], [330, 0.16, 0.26]); },
  buzz(p) { if (on) try { navigator.vibrate?.(p); } catch { /* ignore */ } },
};

// ---- confetti: one canvas over the screen for about a second and a half, then gone ----
export function confetti() {
  if (calm()) return;
  const cs = getComputedStyle(document.documentElement), cols = ['--de-fun-coral', '--de-fun-mint', '--de-fun-sky', '--de-fun-sunny'].map(n => cs.getPropertyValue(n).trim() || '#FFD84D');
  const W = innerWidth, H = innerHeight, cv = h('canvas', { width: W, height: H, 'aria-hidden': 'true', style: { position: 'fixed', inset: '0', 'pointer-events': 'none', 'z-index': '60' } }), c = cv.getContext('2d');
  const bits = Array.from({ length: 48 }, (_, i) => ({ x: W / 2 + (Math.random() - 0.5) * 80, y: H * 0.45, vx: (Math.random() - 0.5) * 520, vy: -260 - Math.random() * 360, r: 4 + Math.random() * 5, c: cols[i % 4], a: Math.random() * 6 }));
  document.body.append(cv);
  let last = performance.now(), life = 1.6;
  const tick = now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; life -= dt;
    c.clearRect(0, 0, W, H);
    for (const b of bits) { b.vy += 900 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.a += dt * 8; c.fillStyle = b.c; c.save(); c.translate(b.x, b.y); c.rotate(b.a); c.fillRect(-b.r, -b.r / 2, b.r * 2, b.r); c.restore(); }
    if (life > 0) requestAnimationFrame(tick); else cv.remove();
  };
  requestAnimationFrame(tick);
}

// ---- the top bar: a draining time bar, hearts, a combo line ----
export function makeHud({ hearts = 0, maxTime = 60, bar: showBar = true } = {}) {
  const info = h('span', { class: 'gm-info' }), lives = h('span', { class: 'gm-hearts', 'aria-hidden': 'true' }), fill = h('i'), bar = h('div', { class: 'gm-bar', role: 'presentation' }, fill), combo = h('div', { class: 'gm-combo', 'aria-live': 'polite' });
  const snd = h('button', { class: 'de-btn de-btn--text gm-snd', type: 'button', 'aria-label': 'শব্দ আর ভাইব্রেশন চালু বা বন্ধ', onclick: () => { fx.set(!fx.on); paintSnd(); } });
  const paintSnd = () => snd.replaceChildren(aicon(fx.on ? 'sound' : 'mute'));
  paintSnd();
  const el = h('div', { class: 'gm-top' }, h('div', { class: 'gm-hud' }, info, lives, snd), showBar ? bar : null, combo);
  return {
    el,
    set({ time, text, hearts: hl, combo: cb }) {
      if (time != null) { fill.style.width = Math.max(0, Math.min(100, time / maxTime * 100)) + '%'; bar.classList.toggle('is-low', time < maxTime * 0.2); }
      if (text != null) info.textContent = text;
      if (hl != null) lives.replaceChildren(...Array.from({ length: Math.max(0, hl) }, () => aicon('heart')), ...Array.from({ length: Math.max(0, hearts - hl) }, () => aicon('heartoff')));
      if (cb != null) { const t = cb >= 3 ? `${bn(cb)} কম্বো!` : ''; if (t !== combo.textContent) { combo.replaceChildren(...(t ? [aicon('flame', 'ai--live'), t] : [])); combo.classList.remove('pop'); if (t) { void combo.offsetWidth; combo.classList.add('pop'); } } }
    },
  };
}

// ---- own bests, streak, daily mission (this phone only) ----
export const MISSION = 3;
const sk = id => 'de_gstats_' + id;
const read = id => { try { return JSON.parse(load(sk(id)) || '{}') || {}; } catch { return {}; } };
const streakOf = (s, day) => (s.last === day || s.last === addDays(day, -1) ? s.streak || 0 : 0);
export const stats = {
  view(id) { const s = read(id), day = dhakaDay(); return { best: s.best || {}, streak: streakOf(s, day), today: s.day === day ? s.games || [] : [], mons: (s.mon || []).length }; },
  // A monster beaten for the first time goes into the collection. Returns true when it is new.
  collect(id, key) { const s = read(id), mon = s.mon || []; if (mon.includes(key)) return false; mon.push(key); save(sk(id), JSON.stringify({ ...s, mon })); return true; },
  // Call once per finished round. Returns what to show on the result.
  record(id, game, points) {
    const s = read(id), day = dhakaDay(), best = s.best || {}, prev = best[game] || 0, today = s.day === day ? s.games || [] : [];
    const first = s.last !== day, streak = first ? streakOf(s, day) + 1 : s.streak || 1, wasDone = today.length >= MISSION;
    if (!today.includes(game)) today.push(game);
    if (points > prev) best[game] = points;
    save(sk(id), JSON.stringify({ ...s, best, last: day, streak, day, games: today }));
    return { prev, isBest: points > prev && prev > 0, streak, today: today.length, missionJust: !wasDone && today.length >= MISSION };
  },
};

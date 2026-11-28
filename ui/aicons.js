// Animated icons (Lucide shapes + motion from animateicons / pqoqubbw icons, both MIT; see licenses.txt).
// Data: ui/icons-data.js (format diffedu-icon/1: nodes with optional anim tracks). Built with createElementNS only (no innerHTML),
// played with the Web Animations API, one animation per node. Nothing plays when the phone asks for less motion.
import DATA from './icons-data.js';
import { svgEl } from './dom.js';

// names used across the app -> library icon ids
const ALIAS = {
  bulb: 'lightbulb', pad: 'gamepad', people: 'users', chart: 'chart-column', bag: 'shopping-bag', chat: 'message-circle', bolt: 'zap', calc: 'calculator',
  balloon: 'sparkles', cards: 'layers', cart: 'shopping-cart', party: 'party-popper', heartoff: 'heart-crack', sound: 'volume-2', mute: 'volume-x', check: 'circle-check',
  // the app's older sprite names (ui/icons.js) -> library icons
  home: 'house', more: 'menu', cloud: 'cloud-off', book: 'book-open', exam: 'file-text', office: 'building-2', back: 'arrow-left', wifioff: 'wifi-off', alert: 'triangle-alert',
  text: 'type', help: 'circle-question-mark', refresh: 'refresh-cw', logout: 'log-out', coin: 'coins', chev: 'chevron-right', chevdown: 'chevron-down', eyeoff: 'eye-off',
  down: 'download', up: 'arrow-up', trash: 'trash-2', gamepad: 'gamepad',
};
export const libName = name => (DATA[name] ? name : ALIAS[name] && DATA[ALIAS[name]] ? ALIAS[name] : null);
export const hasAicon = name => !!libName(name);

const calm = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const GEO = ['d', 'cx', 'cy', 'r', 'x', 'y', 'width', 'height', 'rx', 'ry', 'x1', 'x2', 'y1', 'y2', 'points', 'stroke-dasharray', 'stroke-dashoffset', 'pathLength'];

// ---- build ----
function build(node, parent, list) {
  const el = svgEl(node.tag, {});
  for (const k of GEO) if (node[k] != null) el.setAttribute(k, node[k]);
  for (const k of Object.keys(node)) if (k !== 'tag' && k !== 'anim' && k !== 'children' && !GEO.includes(k)) { if (/^[a-z-]+$/.test(k) && typeof node[k] !== 'object') el.setAttribute(k, node[k]); }
  if (node.anim) {
    el.style.transformBox = 'view-box';
    el.style.transformOrigin = node.anim.origin[0] + 'px ' + node.anim.origin[1] + 'px';
    if (node.anim.tracks.some(t => t.prop === 'pathLength')) { el.setAttribute('pathLength', '1'); el.setAttribute('stroke-dasharray', '1'); }
    list.push([el, node.anim.tracks]);
  }
  for (const c of node.children || []) build(c, el, list);
  parent.appendChild(el);
}

// ---- sampling (framer-motion style keyframes: times + cubic-bezier per segment) ----
function bez(p, t) {
  if (t <= 0) return 0; if (t >= 1) return 1;
  const [x1, y1, x2, y2] = p;
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  let s = t;
  for (let i = 0; i < 8; i++) { const x = ((ax * s + bx) * s + cx) * s - t, d = (3 * ax * s + 2 * bx) * s + cx; if (Math.abs(x) < 1e-5 || !d) break; s -= x / d; }
  s = Math.min(1, Math.max(0, s));
  return ((ay * s + by) * s + cy) * s;
}
function at(tr, ms) {
  const kf = tr.keyframes, n = kf.length;
  if (n === 1) return kf[0];
  const local = ms - tr.delay;
  if (local <= 0) return kf[0];
  if (local >= tr.duration) return kf[n - 1];
  const f = local / tr.duration, times = tr.times || kf.map((_, i) => i / (n - 1));
  let i = 0; while (i < n - 2 && f >= times[i + 1]) i++;
  const span = times[i + 1] - times[i], u = span > 0 ? (f - times[i]) / span : 1;
  const e = Array.isArray(tr.easing[0]) ? tr.easing[Math.min(i, tr.easing.length - 1)] : tr.easing;
  return kf[i] + (kf[i + 1] - kf[i]) * bez(e, u);
}
function frames(tracks, total) {
  const marks = new Set();
  for (let i = 0; i <= 36; i++) marks.add(total * i / 36);
  for (const t of tracks) { marks.add(t.delay); const n = t.keyframes.length, times = t.times || t.keyframes.map((_, i) => i / Math.max(1, n - 1)); for (const f of times) { const m = t.delay + t.duration * f; marks.add(m); marks.add(Math.min(total, m + 0.5)); } }
  const ts = [...marks].filter(m => m >= 0 && m <= total).sort((a, b) => a - b);
  return ts.map(ms => {
    const v = { x: 0, y: 0, rotate: 0, scale: 1, scaleX: 1, scaleY: 1, skewX: 0 }, out = { offset: ms / total };
    for (const t of tracks) {
      const val = at(t, ms);
      if (t.prop === 'opacity') out.opacity = val;
      else if (t.prop === 'dashoffset') out.strokeDashoffset = val;
      else if (t.prop === 'pathLength') out.strokeDashoffset = 1 - val;
      else v[t.prop] = val;
    }
    out.transform = `translate(${v.x}px, ${v.y}px) rotate(${v.rotate}deg) scale(${v.scale * v.scaleX}, ${v.scale * v.scaleY}) skewX(${v.skewX}deg)`;
    return out;
  });
}

// ---- play ----
export function play(svg) {
  if (!svg || !svg._ai || calm()) return;
  for (const a of svg._ai.running || []) a.cancel();
  svg._ai.running = svg._ai.list.map(([el, tracks]) => {
    const total = Math.max(...tracks.map(t => t.delay + t.duration));
    try { return el.animate(frames(tracks, total), { duration: total, easing: 'linear', fill: 'none' }); } catch { return null; }
  }).filter(Boolean);
  return svg._ai.running[0];
}

// one observer: an icon plays once when it first shows, if it asked to (data-auto); icons inside the current tab play too
let io = null;
function watch(svg) {
  if (typeof IntersectionObserver === 'undefined') return;
  io = io || new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) { const s = e.target; io.unobserve(s); if (s.dataset.auto || s.closest('.de-bottomnav__item.is-on')) setTimeout(() => play(s), 120 + Math.random() * 260); if (s.classList.contains('ai--live')) live(s); } });
  io.observe(svg);
}
function live(s) { const loop = () => { if (!s.isConnected) return; const a = play(s); if (a) a.finished.then(() => setTimeout(loop, 1400)).catch(() => {}); }; loop(); }

export function aicon(name, cls = '', { auto = true } = {}) {
  const id = libName(name) || 'star', d = DATA[id];
  const svg = svgEl('svg', { class: 'ai ai-' + name + (cls ? ' ' + cls : ''), viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' });
  const list = [];
  for (const n of d.n) build(n, svg, list);
  svg._ai = { list, running: [] };
  if (auto) svg.dataset.auto = '1';
  watch(svg);
  return svg;
}

// touch or hover on a button/link/row plays the icons inside it (once, short)
if (typeof document !== 'undefined') {
  const hit = e => { const b = e.target.closest?.('button, a, [role="button"], .de-row'); if (b) for (const s of b.querySelectorAll('svg.ai')) if (!s.classList.contains('ai--still')) play(s); };
  document.addEventListener('pointerdown', hit, { passive: true });
  document.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hit(e); }, { capture: true, passive: true });
}

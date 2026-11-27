// Shared bits for the games that draw on a canvas (balloons, FPV drone). Colours come from the app's tokens (read once, so light and dark both work).
import { h } from '../../ui/dom.js';

export function theme() {
  const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim() || '#888';
  return { font: cs.getPropertyValue('--de-font').trim() || 'sans-serif', sky: v('--de-brand-soft'), ink: v('--de-ink'), onFun: v('--de-on-fun'), good: v('--de-good-solid'), bad: v('--de-bad-solid'), line: v('--de-line-ui'),
    balloon: [v('--de-fun-coral'), v('--de-fun-mint'), v('--de-fun-sky'), v('--de-fun-sunny')], brand: v('--de-brand'), raised: v('--de-raised') };
}
// A canvas as wide as its card. rescale(dpr) lets a game lower the sharpness when the phone is slow.
export function makeCanvas(label, ratio, maxDpr = 2) {
  const W = 340, H = Math.round(340 * ratio);
  const cv = h('canvas', { class: 'st-canvas', role: 'img', 'aria-label': label, style: { width: '100%', 'aspect-ratio': `${W} / ${H}`, 'touch-action': 'none', 'border-radius': 'var(--de-r-md)' } });
  const ctx = cv.getContext('2d');
  const rescale = dpr => { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  rescale(Math.min(maxDpr, window.devicePixelRatio || 1));
  const at = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
  return { cv, ctx, W, H, at, rescale };
}
export const loop = fn => { let id, last = performance.now(); const tick = now => { fn(Math.min(0.05, (now - last) / 1000), now - last); last = now; id = requestAnimationFrame(tick); }; id = requestAnimationFrame(tick); return () => cancelAnimationFrame(id); };

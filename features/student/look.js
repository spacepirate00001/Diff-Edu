// Data-driven cosmetics from shop_items.meta: ring, banner, badge, title, effect, theme. No emoji decoration, no innerHTML; css is ui/look.css.
import { h, svgEl } from '../../ui/dom.js';

export const SLOTS = [['avatar', 'অবতার'], ['ring', 'ফ্রেম'], ['banner', 'প্রোফাইল ব্যাকগ্রাউন্ড'], ['badge', 'ব্যাজ'], ['title', 'টাইটেল'], ['effect', 'অ্যানিমেটেড ইফেক্ট'], ['theme', 'থিম']];

const HEX = /^#[0-9a-fA-F]{3,8}$/;
const col = (c, d) => (HEX.test(c) ? c : d);
const cols = (m, d = ['#888888', '#cccccc']) => { const a = (m?.colors || []).filter(c => HEX.test(c)).slice(0, 4); return a.length ? (a.length === 1 ? [a[0], a[0]] : a) : d; };
const oneOf = (v, list, d) => (list.includes(v) ? v : d);

// 24px badge icons: [paths..., fill?]. Stroke icons use currentColor.
const ICONS = {
  trophy: 'M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8 20h8',
  bolt: 'M13 2 5 14h6l-1 8 9-12h-6l1-8z',
  book: 'M4 5a2 2 0 0 1 2-1h6v16H6a2 2 0 0 0-2 1V5zM20 5a2 2 0 0 0-2-1h-6v16h6a2 2 0 0 1 2 1V5z',
  flame: 'M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-4 3-7 1 1 2 2 3 2 0-3-1-4 0-7z',
  heart: 'M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z',
  crown: 'M3 8l4 4 5-7 5 7 4-4-2 11H5L3 8z',
  shield: 'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6l8-3zM9 12l2 2 4-4',
  rocket: 'M12 2c4 2 6 6 5 11l-3 3h-4l-3-3c-1-5 1-9 5-11zM9 16l-3 3 1 2 3-1M15 16l3 3-1 2-3-1M12 9m-1.5 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0',
  atom: 'M12 12m-1.5 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0M12 12c5-8 9-8 9-5s-4 8-9 5zM12 12c-5 8-9 8-9 5s4-8 9-5zM12 12c-8-1-10-5-8-7s7 0 8 7zM12 12c8 1 10 5 8 7s-7 0-8-7z',
  leaf: 'M5 19C4 9 10 4 20 4c0 10-5 16-13 15M5 19c3-5 6-8 10-10',
  moon: 'M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2',
  gem: 'M6 3h12l4 6-10 12L2 9l4-6zM2 9h20M9 3l-2 6 5 12 5-12-2-6',
  medal: 'M8 3l4 7 4-7M12 10m-5 0a5 5 0 1 0 10 0 5 5 0 1 0-10 0M12 8l1 2 2 .3-1.5 1.4.4 2.1L12 12.8 10.1 13.8l.4-2.1L9 10.3 11 10z',
  key: 'M8 14m-4 0a4 4 0 1 0 8 0 4 4 0 1 0-8 0M11 11l9-9M16 6l3 3M14 8l2 2',
  flag: 'M5 21V3M5 4h13l-3 4 3 4H5',
  brain: 'M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V4a3 3 0 0 0-3 0zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1',
  pencil: 'M4 20l1-5L16 4l4 4L9 19l-5 1zM14 6l4 4',
  compass: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15.5 8.5l-2 5-5 2 2-5 5-2z',
  wave: 'M2 9c3-4 5 4 10 0s7 4 10 0M2 15c3-4 5 4 10 0s7 4 10 0',
  star: 'M12 2l3 7 7 .6-5.3 4.7 1.6 7.2L12 17.800 5.700 21.500l1.600-7.200L2 9.600 9 9l3-7z',
  cap: 'M2 9l10-5 10 5-10 5L2 9zM6 11v5c3 3 9 3 12 0v-5M22 9v6',
  clover: 'M12 12c-3-1-5-4-3-6s5 0 3 6zM12 12c1-3 4-5 6-3s0 5-6 3zM12 12c3 1 5 4 3 6s-5 0-3-6zM12 12c-1 3-4 5-6 3s0-5 6-3zM12 12v9',
  target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
};
const FILLED = new Set(['bolt', 'flame', 'heart', 'crown', 'star', 'moon', 'gem']);
export function badgeIcon(m, size = 22) {
  const name = ICONS[m?.icon] ? m.icon : 'star', color = col(m?.color, '#D4B95A');
  const s = svgEl('svg', { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': 'true', focusable: 'false', class: 'lk-bi lk-bi--' + oneOf(m?.anim, ['none', 'float', 'pulse', 'spin', 'shine'], 'none') });
  const p = svgEl('path', { d: ICONS[name], fill: FILLED.has(name) ? color : 'none', 'fill-opacity': FILLED.has(name) ? '0.9' : '0', stroke: color, 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  s.append(p); s.style.color = color; return s;
}

// ---- ring ----
function ringStyle(m) {
  const c = cols(m), w = Math.min(6, Math.max(2, +m?.width || 3)), st = oneOf(m?.style, ['solid', 'gradient', 'dashed', 'double', 'dotted'], 'solid');
  const o = { '--lk-w': w + 'px', '--lk-c0': c[0], '--lk-c1': c[1] };
  o['--lk-bg'] = st === 'gradient' ? `conic-gradient(from 0deg, ${[...c, c[0]].join(', ')})` : c[0];
  return [o, st, oneOf(m?.anim, ['none', 'spin', 'pulse', 'shimmer'], 'none')];
}
export function lookAvatar(face, look, size = 'lg', initials) {
  const r = look?.ring, av = h('span', { class: 'de-avatar lk-av__f' + (size === 'lg' ? ' de-avatar--lg' : ''), 'aria-hidden': 'true', text: face || initials || '' });
  if (!r) return h('span', { class: 'lk-av lk-av--' + size }, av);
  const [style, st, an] = ringStyle(r.meta);
  return h('span', { class: `lk-av lk-av--${size} lk-ring lk-ring--${st} lk-ring--${an}`, style }, h('i', { class: 'lk-ring__b' }), av);
}

// ---- banner / theme / title / effect ----
const PAT = ['none', 'dots', 'stripes', 'waves', 'grid', 'stars', 'rays', 'diamonds'];
function bannerStyle(m) {
  const c = cols(m), a = Math.min(360, Math.max(0, +m?.angle || 135));
  return [{ '--lk-bg': `linear-gradient(${a}deg, ${c.join(', ')})` }, oneOf(m?.pattern, PAT, 'none'), oneOf(m?.anim, ['none', 'drift'], 'none')];
}
export function titlePill(item) {
  const m = item?.meta || {}, c = col(m.color, '#D4B95A'), c2 = col(m.color2, c), st = oneOf(m.style, ['plain', 'gradient', 'glow'], 'plain');
  return h('span', { class: 'lk-title lk-title--' + st, style: { '--lk-c0': c, '--lk-c1': c2 }, text: item?.name || '' });
}
const KINDS = ['sparkle', 'hearts', 'confetti', 'snow', 'fireflies', 'bubbles', 'stars', 'rain', 'flames', 'leaves', 'orbit', 'aurora'];
export function effectLayer(item) {
  const m = item?.meta || {}, k = oneOf(m.kind, KINDS, 'sparkle'), c = cols(m, ['#ffffff', '#ffffff']);
  const n = k === 'aurora' ? 3 : k === 'orbit' ? 4 : 12;
  const ps = Array.from({ length: n }, (_, i) => h('i', { class: 'lk-p', style: { '--x': ((i * 37 + 11) % 92 + 4) + '%', '--y': ((i * 53 + 7) % 80 + 8) + '%', '--d': (2.6 + (i * 7) % 5 * 0.55).toFixed(2) + 's', '--l': (-(i * 0.37)).toFixed(2) + 's', '--c': c[i % c.length], '--i': i } }));
  return h('span', { class: 'lk-fx lk-fx--' + k, 'aria-hidden': 'true' }, ...ps);
}

// ---- hero (profile) ----
export function lookHero({ name, sub, face, look = {}, extra } = {}) {
  const b = look.banner, th = look.theme?.meta, [bs, pat, an] = b ? bannerStyle(b.meta) : [{}, 'none', 'none'];
  const style = { ...bs };
  if (!b && th) { const c = cols(th, ['#66386F', '#3B1F42']); style['--lk-bg'] = `linear-gradient(135deg, ${c[0]}, ${c[1]})`; }
  const dark = !!(b || th), tx = th ? col(th.text, '#ffffff') : '#ffffff';
  if (dark) style['--lk-tx'] = tx;
  const badges = look.badges || (look.badge ? [look.badge] : []);
  return h('section', { class: `de-card st-who lk-hero${dark ? ' lk-hero--tint' : ''}`, 'data-pat': pat, 'data-anim': an, style },
    h('span', { class: 'lk-hero__bg', 'aria-hidden': 'true' }), look.effect ? effectLayer(look.effect) : null,
    lookAvatar(face, look, 'hero'), h('b', { class: 'st-who__n lk-hero__n', text: name }),
    look.title ? titlePill(look.title) : null,
    badges.length ? h('span', { class: 'lk-badges' }, ...badges.map(x => h('span', { class: 'lk-badge', title: x.name || '' }, badgeIcon(x.meta)))) : null,
    h('span', { class: 'de-row__sub lk-hero__s', text: sub || '' }), extra || null);
}

// ---- preview of one catalog item (shop tile art) ----
export function lookPreview(item) {
  const m = item?.meta || {}, s = item?.slot;
  if (s === 'avatar') return h('span', { class: 'lk-pv lk-pv--avatar', 'aria-hidden': 'true', text: m.emoji || '' });
  if (s === 'ring') return h('span', { class: 'lk-pv' }, lookAvatar('', { ring: item }, 'sm'));
  if (s === 'banner') { const [bs, pat, an] = bannerStyle(m); return h('span', { class: 'lk-pv lk-pv--sw lk-sw', 'data-pat': pat, 'data-anim': an, style: bs }, h('span', { class: 'lk-hero__bg' })); }
  if (s === 'theme') { const c = cols(m, ['#66386F', '#3B1F42']); return h('span', { class: 'lk-pv lk-pv--sw', style: { '--lk-bg': `linear-gradient(135deg, ${c[0]}, ${c[1]})` } }, h('b', { class: 'lk-pv__t', style: { color: col(m.text, '#fff') }, text: 'Aa' })); }
  if (s === 'badge') return h('span', { class: 'lk-pv' }, badgeIcon(m, 34));
  if (s === 'title') return h('span', { class: 'lk-pv' }, titlePill(item));
  if (s === 'effect') return h('span', { class: 'lk-pv lk-pv--sw lk-pv--dark' }, effectLayer(item));
  return h('span', { class: 'lk-pv' });
}

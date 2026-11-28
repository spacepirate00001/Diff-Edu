// Icons: one hidden SVG sprite, 24px stroke icons (style comes from .de-icon in components.css).
import { svgEl } from './dom.js';
import { aicon, libName } from './aicons.js';

const P = {
  home: 'M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z',
  chart: 'M4 20h16M7 16v-5M12 16V6M17 16v-8',
  chat: 'M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 4v-4H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  more: 'M5 7h14M5 12h14M5 17h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  bell: 'M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4',
  cloud: 'M7 18a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 9.5a4.3 4.3 0 0 1 0 8.5zM4 4l16 16',
  book: 'M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10',
  play: 'M8 5l11 7-11 7zM4 5v14',
  people: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c.5-3.5 3-5 6-5s5.500 1.500 6 5M17 6a3 3 0 0 1 0 6M18 15c2 .5 3 2 3.500 5',
  exam: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h4',
  office: 'M4 20V8l8-4 8 4v12zM9 20v-5h6v5M8 11h2M14 11h2',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  back: 'M15 5l-7 7 7 7',
  x: 'M6 6l12 12M18 6L6 18',
  wifioff: 'M3 3l18 18M2 9a15 15 0 0 1 5-3M22 9a15 15 0 0 0-3-2M5 12.500a10 10 0 0 1 4-2.500M19 12.500a10 10 0 0 0-2-1.400M8.500 16a5 5 0 0 1 3-1.500M12 19.500h.01',
  alert: 'M12 4l9 16H3zM12 10v4M12 17h.01',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  phone: 'M6 3h3l2 5-2 1.500a11 11 0 0 0 5.500 5.500L16 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z',
  text: 'M4 19l5-14 5 14M6 14h6M16 19l3-8 3 8M17 17h4',
  help: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.500 9.500a2.500 2.500 0 1 1 3.500 2.300c-.7.400-1 .9-1 1.700M12 17h.01',
  refresh: 'M20 12a8 8 0 1 1-2.500-5.800M20 4v5h-5',
  logout: 'M10 4H5v16h5M15 8l4 4-4 4M19 12H9',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6',
  file: 'M6 3h9l4 4v14H6zM9 12h6M9 16h4',
  coin: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v10M9.500 9.500c0-1 1-1.500 2.500-1.500s2.500.6 2.500 1.500-1 1.500-2.500 1.500S9.500 12 9.500 13s1 1.500 2.500 1.500 2.500-.5 2.500-1.500',
  chev: 'M9 6l6 6-6 6',
  chevdown: 'M6 9l6 6 6-6',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  eyeoff: 'M3 3l18 18M10 6.200A9 9 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3 3.500M6.500 7.500A17 17 0 0 0 2 12s4 7 10 7a9 9 0 0 0 4-1M9.900 9.900a3 3 0 0 0 4.200 4.200',
  sound: 'M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6M18.500 6.500a8 8 0 0 1 0 11',
  moon: 'M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.500h.01',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  down: 'M12 4v12M7 11l5 5 5-5M5 20h14',
  star: 'M12 3l2.700 5.800 6.300.800-4.600 4.400 1.200 6.300L12 17.300 6.400 20.300l1.200-6.300L3 9.600l6.300-.800z',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M10 17h4',
  gamepad: 'M7 8h10a4 4 0 0 1 4 4v1a3 3 0 0 1-5.500 1.600L15 14H9l-.500.600A3 3 0 0 1 3 13v-1a4 4 0 0 1 4-4zM8 10.500v3M6.500 12h3M16 11.500h.01M18 13h.01',
  plus: 'M12 5v14M5 12h14',
  up: 'M12 20V8M7 13l5-5 5 5M5 4h14',
  trash: 'M5 7h14M10 11v6M14 11v6M7 7l1 13h8l1-13M9 7V4h6v3',
  gift: 'M4 9h16v4H4zM5 13h14v8H5zM12 9v12M12 9C9 9 8 6.500 9.500 5.500S12 6 12 9zM12 9c3 0 4-2.500 2.500-3.500S12 6 12 9z',
};
export function installIcons() {
  if (document.getElementById('de-sprite')) return;
  const s = svgEl('svg', { id: 'de-sprite', class: 'tg-sprite', 'aria-hidden': 'true', focusable: 'false' });
  for (const [id, d] of Object.entries(P)) {
    const sym = svgEl('symbol', { id: 'i-' + id, viewBox: '0 0 24 24' });
    sym.appendChild(svgEl('path', { d }));
    s.appendChild(sym);
  }
  document.body.prepend(s);
}
export function icon(name, cls = '') {
  const lib = libName(name);
  if (lib) return aicon(name, 'de-icon' + (cls ? ' ' + cls : ''), { auto: false });
  const svg = svgEl('svg', { class: 'de-icon' + (cls ? ' ' + cls : ''), 'aria-hidden': 'true', focusable: 'false' });
  svg.appendChild(svgEl('use', { href: '#i-' + name }));
  return svg;
}

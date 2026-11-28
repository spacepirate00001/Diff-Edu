// Small animated icons that replace emoji in the interface. Same line style as ui/icons.js (stroke = currentColor),
// with a soft fill (.f) and a gold touch (.s). Built with createElementNS only (no innerHTML). Motion lives in aicons.css.
import { svgEl } from './dom.js';

// [tag, data, class]: path = d, circle = "cx cy r", rect = "x y w h rx [transform]". Elements with class a-* are the ones that move.
const S = {
  bulb: [['circle', '12 10 8', 's a-glow'], ['path', 'M9 17.5h6M10 20.5h4'], ['path', 'M12 3.500a6 6 0 0 0-3.500 10.900c.6.500 1 1.200 1 2.100h5c0-.900.400-1.600 1-2.100A6 6 0 0 0 12 3.500z', 'a-pulse']],
  pad: [['path', 'M7 8h10a4 4 0 0 1 4 4v1a3 3 0 0 1-5.500 1.600L15 14H9l-.500.600A3 3 0 0 1 3 13v-1a4 4 0 0 1 4-4z', 'f a-wobble'], ['path', 'M7 8h10a4 4 0 0 1 4 4v1a3 3 0 0 1-5.500 1.600L15 14H9l-.500.600A3 3 0 0 1 3 13v-1a4 4 0 0 1 4-4zM8 10.500v3M6.500 12h3', 'a-wobble'], ['circle', '16 11.500 .9', 'k a-wobble'], ['circle', '18 13 .9', 'k a-wobble']],
  trophy: [['path', 'M8 4h8v5a4 4 0 0 1-8 0z', 's'], ['path', 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M10 17h4'], ['path', 'M10.200 6.500v2.500', 'w a-shine']],
  people: [['circle', '9 8.500 3.500', 'f'], ['circle', '9 8.500 3.200'], ['path', 'M3.500 20c.600-3.400 2.800-5 5.500-5s4.900 1.600 5.500 5'], ['circle', '17 9 2.300', 'a-nod'], ['path', 'M16.500 14.300c2.400-.200 4 1.200 4.500 4.500', 'a-nod']],
  swords: [['path', 'M6 4l11 11M18 4L7 15M15 15l3 3M9 15l-3 3M4.500 17.500l2 2M19.500 17.500l-2 2', 'a-clash']],
  chart: [['rect', '4 12 4 8 1', 'f a-bar1'], ['rect', '10 5 4 15 1', 's a-bar2'], ['rect', '16 9 4 11 1', 'f a-bar3'], ['path', 'M3 20.500h18']],
  bag: [['path', 'M5 8h14l-1 12H6z', 'f'], ['path', 'M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2', 'a-swing']],
  palette: [['path', 'M12 3a9 9 0 1 0 0 18c1.500 0 2-1 1.500-2s0-2.500 1.500-2.500H17a4 4 0 0 0 4-4C21 6.500 17 3 12 3z', 'f'], ['path', 'M12 3a9 9 0 1 0 0 18c1.500 0 2-1 1.500-2s0-2.500 1.500-2.500H17a4 4 0 0 0 4-4C21 6.500 17 3 12 3z'], ['circle', '8 11 1', 'k a-dot1'], ['circle', '12 7.500 1', 'k a-dot2'], ['circle', '16 10 1', 'k a-dot3']],
  chat: [['path', 'M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 4v-4H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', 'f'], ['path', 'M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 4v-4H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z'], ['circle', '8.500 10.500 .9', 'k a-d1'], ['circle', '12 10.500 .9', 'k a-d2'], ['circle', '15.500 10.500 .9', 'k a-d3']],
  rocket: [['path', 'M12 3c3 2 5 5 5 9l-2 3H9l-2-3c0-4 2-7 5-9z', 'f'], ['path', 'M12 3c3 2 5 5 5 9l-2 3H9l-2-3c0-4 2-7 5-9zM9 15l-2 4 3-1M15 15l2 4-3-1', 'a-lift'], ['circle', '12 9.500 1.400', 's a-lift']],
  bolt: [['path', 'M13 3L5 13.500h6L10 21l9-11.500h-6z', 's a-zap'], ['path', 'M13 3L5 13.500h6L10 21l9-11.500h-6z', 'a-zap']],
  calc: [['rect', '5 3.500 14 17 3', 'f'], ['rect', '5 3.500 14 17 3'], ['path', 'M8.500 8h7'], ['circle', '9 12.500 1', 'k a-k1'], ['circle', '15 12.500 1', 'k a-k2'], ['circle', '9 16.500 1', 'k a-k3'], ['circle', '15 16.500 1', 'k a-k4']],
  balloon: [['path', 'M12 3a6 6 0 0 1 6 6c0 4-3.500 7-6 8-2.500-1-6-4-6-8a6 6 0 0 1 6-6z', 's a-float'], ['path', 'M12 3a6 6 0 0 1 6 6c0 4-3.500 7-6 8-2.500-1-6-4-6-8a6 6 0 0 1 6-6zM12 17l-1.500 2.500h3zM12 19.500c-1 1 1 1.500 0 2.500', 'a-float']],
  cards: [['rect', '4.500 6 10 14 2 rotate(-8 9.500 13)', 'f a-fan1'], ['rect', '4.500 6 10 14 2 rotate(-8 9.500 13)', 'a-fan1'], ['rect', '9.500 4 10 14 2 rotate(8 14.500 11)', 's a-fan2'], ['rect', '9.500 4 10 14 2 rotate(8 14.500 11)', 'a-fan2']],
  type: [['path', 'M4 19l5-14 5 14M6 14h6M16 19l3-8 3 8M17 17h4', 'a-letters']],
  cart: [['path', 'M3 4h2.500l2 11h10l2-8H7', 'a-roll'], ['circle', '10 19.500 1.200', 'k'], ['circle', '17 19.500 1.200', 'k']],
  target: [['circle', '12 12 8.500'], ['circle', '12 12 5', 'f'], ['circle', '12 12 1.500', 's a-hit']],
  search: [['circle', '11 11 6.500', 'f'], ['circle', '11 11 6.500', 'a-scan'], ['path', 'M20 20l-4.500-4.500', 'a-scan']],
  flame: [['path', 'M12 3c1 3.500 5.500 5.500 5.500 10.500a5.500 5.500 0 0 1-11 0c0-2 1-3.500 2-4.500.200 1.500 1 2.300 1.800 2.500C10 9 10.500 5.500 12 3z', 's a-flick'], ['path', 'M12 3c1 3.500 5.500 5.500 5.500 10.500a5.500 5.500 0 0 1-11 0c0-2 1-3.500 2-4.500.200 1.500 1 2.300 1.800 2.500C10 9 10.500 5.500 12 3z', 'a-flick']],
  star: [['path', 'M12 3.500l2.600 5.500 6 .8-4.400 4.200 1.100 6-5.300-2.900-5.300 2.900 1.100-6L3.400 9.800l6-.8z', 's a-twinkle'], ['path', 'M12 3.500l2.600 5.500 6 .8-4.400 4.200 1.100 6-5.300-2.900-5.300 2.900 1.100-6L3.400 9.800l6-.8z', 'a-twinkle']],
  heart: [['path', 'M12 20s-7-4.500-7-10a4 4 0 0 1 7-2.500A4 4 0 0 1 19 10c0 5.500-7 10-7 10z', 'b a-beat']],
  heartoff: [['path', 'M12 20s-7-4.500-7-10a4 4 0 0 1 7-2.500A4 4 0 0 1 19 10c0 5.500-7 10-7 10z', 'dim']],
  medal: [['circle', '12 14.500 5.500', 's'], ['circle', '12 14.500 5.500'], ['path', 'M8.500 3l3 6.500M15.500 3l-3 6.500M12 12v5'], ['path', 'M10.500 13.500l1.500-1.500v5', 'a-shine']],
  party: [['path', 'M12 3l1.800 5.200L19 10l-5.200 1.800L12 17l-1.800-5.200L5 10l5.200-1.800z', 's a-twinkle'], ['path', 'M12 3l1.800 5.200L19 10l-5.200 1.800L12 17l-1.800-5.200L5 10l5.200-1.800zM19 16l.7 1.800 1.800.7-1.800.7L19 21l-.7-1.800-1.800-.7 1.800-.7z', 'a-twinkle']],
  sound: [['path', 'M4 9h4l5-4v14l-5-4H4z', 'f'], ['path', 'M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6M18.500 6.500a8 8 0 0 1 0 11', 'a-wave']],
  mute: [['path', 'M4 9h4l5-4v14l-5-4H4z', 'f'], ['path', 'M4 9h4l5-4v14l-5-4H4zM17 9.500l4.500 5M21.500 9.500l-4.500 5']],
  clock: [['circle', '12 12 9', 'f'], ['circle', '12 12 9'], ['path', 'M12 7v5l3 2', 'a-tick']],
  check: [['circle', '12 12 9', 'f'], ['circle', '12 12 9'], ['path', 'M7.800 12.500l3 3 5.400-6', 'a-draw']],
};

export const hasAicon = name => !!S[name];
export function aicon(name, cls = '') {
  const svg = svgEl('svg', { class: 'ai ai-' + name + (cls ? ' ' + cls : ''), viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' });
  for (const [tag, d, c] of S[name] || S.star) {
    let el;
    if (tag === 'path') el = svgEl('path', { d });
    else if (tag === 'circle') { const [cx, cy, r] = d.split(' '); el = svgEl('circle', { cx, cy, r }); }
    else { const [x, y, width, height, rx, ...tr] = d.split(' '); el = svgEl('rect', { x, y, width, height, rx }); if (tr.length) el.setAttribute('transform', tr.join(' ')); }
    if (c) el.setAttribute('class', c);
    svg.appendChild(el);
  }
  return svg;
}

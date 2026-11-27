// The printable report card: the same black-and-white A5 card the live app prints (pwa-dev/reports.js cardHtml print:true), built with DOM calls
// instead of HTML text because this app's CSP forbids inline styles and scripts. Two cards make one A4 sheet. Used only by print.html / print.js.
// Left out on purpose: the line-art doodles (decoration only). Everything that carries information is here.
import { h } from '../../ui/dom.js';
import { bn, shortDate } from '../../core/bn.js';
import { grade, rankBn, d1, marksPct, cheer } from './calc.js';

const KIND = { weekly: 'সাপ্তাহিক রিপোর্ট কার্ড', series: 'মডেল টেস্ট সিরিজ' };
const date = iso => shortDate(Date.parse(String(iso).slice(0, 10) + 'T06:00:00Z'));
const range = (f, t) => `${date(f)} – ${date(t)}`;
const num = v => bn(String(Math.round(Number(v) * 100) / 100));
const field = (k, v, cls = '') => h('div', { class: 'fd ' + cls }, h('small', { text: k }), h('b', { text: v }));

export function cardNode(c, { noRank = false } = {}) {
  const d = c.data || {}, lines = d.lines || [], m = marksPct(lines), weekly = c.kind !== 'series';
  const g = m.pct == null ? '—' : grade(m.pct);
  const arrow = l => (l.p == null ? '' : (Number(l.o) || 0) > Number(l.p) ? ' ↑' : (Number(l.o) || 0) < Number(l.p) ? ' ↓' : ' =');
  const prevSum = lines.reduce((s, l) => s + (Number(l.p) || 0), 0), hasPrev = weekly && lines.some(l => l.p != null);
  const first = (d.name || '').trim().split(/\s+/)[0] || 'তুমি', msg = cheer(m.pct, hasPrev && m.got > prevSum, first);
  const award = noRank ? '' : c.award === 'topper' ? '★ ক্লাস টপার' : c.award === 'improved' ? '↑ সবচেয়ে উন্নতি' : '';
  const head = ['বিষয়', 'পূর্ণমান', 'প্রাপ্ত', 'গ্রেড', ...(weekly ? ['গত সপ্তাহ'] : [])];
  const table = h('table', {}, h('tr', {}, ...head.map(t => h('th', { text: t }))),
    ...lines.map(l => h('tr', {}, h('td', {}, l.s, !weekly && l.d ? h('small', { text: ' · ' + date(l.d) }) : null), h('td', { text: num(l.f) }), h('td', { class: 'ob' }, l.o == null ? h('i', { text: 'অনুপস্থিত' }) : num(l.o)), h('td', { class: 'gr', text: l.o == null ? '—' : grade(100 * l.o / l.f) }), weekly ? h('td', { class: 'pv', text: l.p == null ? '—' : num(l.p) + arrow(l) }) : null)),
    lines.length ? h('tr', { class: 'tot' }, h('td', { text: 'মোট' }), h('td', { text: num(m.full) }), h('td', { class: 'ob', text: num(m.got) }), h('td', { class: 'gr', text: g }), weekly ? h('td') : null) : null);
  const bars = d.b != null && lines.length <= 4 ? h('div', { class: 'rb' }, h('div', { class: 'rh' }, `${weekly ? 'এই সপ্তাহের' : 'এই সময়ের'} ক্লাস রেটিং `, h('small', { text: '(প্রতিদিনের গড়)' })),
    ...[['আচরণ', d.b, 3], ['বাড়ির কাজ', d.h, 3], ['ক্লাসের পারফরম্যান্স', d.pe, 4]].map(([k, v, mx]) => h('div', { class: 'rr' }, h('span', { text: k }), h('div', { class: 'rt' }, h('i', { style: { width: (v == null ? 0 : Math.min(100, 100 * v / mx)) + '%' } })), h('b', {}, d1(v), h('small', { text: '/' + bn(mx) })))),
    h('div', { class: 'rn', text: 'মোট স্কোর = পরীক্ষার নম্বর ৬০% + ক্লাস রেটিং ৪০%' })) : null;
  return h('div', { class: 'pc' }, h('div', { class: 'tk' },
    h('div', { class: 'bar' }, h('img', { src: 'ui/assets/diff-edu-logo.svg', alt: '' }), h('div', { class: 'bt' }, h('b', { text: 'ডিফারেন্ট একাডেমিক অ্যান্ড এক্সাম কেয়ার' }), h('span', { text: 'DIFFERENT ACADEMIC & EXAM CARE · KUSHTIA' })), h('div', { class: 'kd', text: KIND[c.kind] || c.title || '' })),
    h('div', { class: 'fs' }, field('শিক্ষার্থী', d.name || '', 'nm'), field('ক্লাস', bn(c.class_level)), field('রোল', bn(d.roll || '—')), field('ব্যাচ', d.batch || '—'), field('সময়', range(c.period_from, c.period_to), 'pd')),
    h('div', { class: 'bd' }, h('div', { class: 'lc' }, table, bars, h('div', { class: 'sx' }, field('রেটিং', d.rating == null ? '—' : d1(d.rating) + '/১০'), field('উপস্থিতি', `${bn(d.present || 0)}/${bn(d.days || 0)} দিন`), field('মোট স্কোর', d1(d.score)))),
      h('div', { class: 'sd' }, noRank ? null : h('div', { class: 'rk' }, h('small', { text: 'ক্লাসে অবস্থান' }), h('b', { text: c.rank ? rankBn(c.rank) : '—' }), h('span', { text: `${bn(c.class_size || 0)} জনের মধ্যে` }), award ? h('em', { text: award }) : null),
        h('div', { class: 'stp' }, h('small', { text: 'গ্রেড' }), h('b', { text: g })))),
    msg ? h('div', { class: 'ms', text: msg }) : null,
    h('div', { class: 'tn' }, h('span', { text: 'শিক্ষকের মন্তব্য' }), h('i')),
    h('div', { class: 'sg' }, h('span', { text: 'শ্রেণি শিক্ষক' }), h('span', { text: 'পরিচালক' }), h('span', { text: 'অভিভাবকের স্বাক্ষর' })),
    h('div', { class: 'ft' }, h('img', { src: 'ui/assets/diff-edu-logo.svg', alt: '' }), h('b', { text: 'ডিফারেন্ট একাডেমিক অ্যান্ড এক্সাম কেয়ার' }), h('u'), h('span', { text: 'Every child is Different.' }))));
}
// Two cards per A4 sheet with a cut line.
export function sheets(cards, opts) {
  const out = [];
  for (let i = 0; i < cards.length; i += 2) out.push(h('section', {}, ...cards.slice(i, i + 2).map(c => cardNode(c, opts)), h('div', { class: 'cut' }, h('span', { text: '✂' }))));
  return out;
}

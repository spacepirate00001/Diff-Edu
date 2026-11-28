// The printable question paper and answer key (A4, black and white). Used only by print.html / print.js; job comes from paper-logic.js printJob().
// DOM calls only (the page's CSP forbids inline scripts and styles). The browser's print dialog saves it as PDF.
import { h } from '../../ui/dom.js';
import { bn } from '../../core/bn.js';
import { LAB } from './logic.js';

const num = v => bn(String(Math.round(Number(v) * 100) / 100));
const lines = t => String(t ?? '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
const meta = (k, v) => (v ? h('span', { class: 'qp-meta' }, h('small', { text: k }), ' ', h('b', { text: v })) : null);

function header(job) {
  const hd = job.header || {};
  return h('header', { class: 'qp-head' },
    h('h1', { class: 'qp-inst', text: hd.institute || 'ডিফ এডু' }),
    hd.exam_name ? h('div', { class: 'qp-exam', text: hd.exam_name }) : null,
    h('div', { class: 'qp-title', text: job.title }),
    h('div', { class: 'qp-metas' }, meta('শ্রেণি:', job.class_level ? bn(job.class_level) : ''), meta('বিষয়:', job.subject), meta('তারিখ:', hd.date ? bn(hd.date) : ''),
      meta('সময়:', hd.minutes ? bn(hd.minutes) + ' মিনিট' : ''), meta('পূর্ণমান:', num(job.total))),
    hd.note ? h('p', { class: 'qp-note', text: hd.note }) : null,
    h('div', { class: 'qp-who' }, h('span', { text: 'নাম:' }), h('span', { text: 'রোল:' }), h('span', { text: 'শাখা:' })));
}
function question(r) {
  const body = lines(r.body);
  const opts = (r.options || []).length ? h('ol', { class: 'qp-opts' }, ...r.options.map((o, i) => h('li', {}, h('b', { text: (LAB[i] || bn(i + 1)) + '.' }), ' ', h('span', { text: o })))) : null;
  return h('div', { class: 'qp-q' },
    h('span', { class: 'qp-no', text: bn(r.no) + '.' }),
    h('div', { class: 'qp-body' }, ...body.map((l, i) => h('p', { class: i ? 'qp-part' : 'qp-line', text: l })), r.needs_figure ? h('p', { class: 'qp-fig', text: '(চিত্র যোগ করুন)' }) : null, opts),
    h('span', { class: 'qp-mk', text: `[${num(r.marks)}]` }));
}
function section(s) {
  return h('div', { class: 'qp-sec' }, h('h2', { class: 'qp-sh' }, h('span', { text: s.title }), h('span', { text: `মোট নম্বর ${num(s.marks)}` })), ...s.rows.map(question));
}
function key(job) {
  const mcq = job.sections.filter(s => s.qtype === 'mcq'), other = job.sections.filter(s => s.qtype !== 'mcq');
  return h('div', { class: 'qp-doc qp-key' },
    h('h1', { class: 'qp-inst', text: 'উত্তরমালা' }), h('div', { class: 'qp-title', text: `${job.title} · ${job.subject}` }),
    ...mcq.map(s => h('div', { class: 'qp-sec' }, h('h2', { class: 'qp-sh' }, h('span', { text: s.title })),
      h('ul', { class: 'qp-grid' }, ...s.rows.map(r => h('li', { text: `${bn(r.no)}-${r.letter || '—'}` }))))),
    ...other.map(s => { const rows = s.rows.filter(r => String(r.answer || '').trim()); return rows.length ? h('div', { class: 'qp-sec' }, h('h2', { class: 'qp-sh' }, h('span', { text: s.title })),
      ...rows.map(r => h('div', { class: 'qp-ans' }, h('b', { text: bn(r.no) + '.' }), ' ', h('span', { text: r.answer })))) : null; }));
}
export function paperSheets(job) {
  const out = [h('div', { class: 'qp-doc' }, header(job), ...job.sections.map(section))];
  if (job.withAnswers) out.push(key(job));
  return out;
}

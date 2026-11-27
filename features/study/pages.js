// The study pages of the guardian: attendance, results, homework, routine, materials, revision plan, ratings, goals, certificates.
// Every page is a childPage (child strip + loading / empty / offline / error / stale states, ui/datapage.js). Report cards are in report.js.
import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { chip, chipRow } from '../../ui/chip.js';
import { emptyState } from '../../ui/states.js';
import { toast } from '../../ui/toast.js';
import { childPage } from '../../ui/datapage.js';
import { bn, DAYS, MONTHS, dhakaParts, dhakaDay, shortDate, clockText } from '../../core/bn.js';
import { attendanceMonth, avgPercent, revisionPlan, addDays } from './calc.js';
import { loadAttendance, loadMarks, loadHomework, loadRoutine, loadMaterials, loadRevision, loadRatings, loadGoals, signedUrl, safeUrl, shiftBn } from './data.js';

const T = 'T06:00:00Z';
export const dayText = iso => shortDate(Date.parse(String(iso).slice(0, 10) + T));
const weekday = iso => DAYS[dhakaParts(Date.parse(String(iso).slice(0, 10) + T)).wd];
const card = (cls, ...k) => h('section', { class: 'de-card gx-card ' + cls }, ...k);
const bar = (ratio, tone) => h('span', { class: 'gx-bar', role: 'presentation' }, h('i', { class: 'gx-bar__fill gx-bar__fill--' + tone, style: { width: Math.round(Math.max(0, Math.min(1, ratio)) * 100) + '%' } }));
const tone = p => (p >= 0.8 ? 'good' : p >= 0.5 ? 'warn' : 'soft');
const stat = (value, label, cls = '') => h('div', { class: 'gx-stat ' + cls }, h('b', { text: value }), h('span', { text: label }));

// ---- attendance ----
export const attendancePage = () => childPage({
  key: 'att', load: k => loadAttendance(k.id), isEmpty: r => !r.length,
  empty: () => emptyState('এখনো হাজিরার তথ্য নেই', 'শিক্ষক হাজিরা নিলে এখানে দেখা যাবে।'),
  draw: rowsList => {
    let back = 0;
    const box = h('div');
    const paint = () => {
      const tp = dhakaParts(), idx = tp.y * 12 + (tp.m - 1) - back, y = Math.floor(idx / 12), m = idx % 12 + 1;
      const mo = attendanceMonth(rowsList, y, m, dhakaDay());
      const cells = [...['র', 'সো', 'ম', 'বু', 'বৃ', 'শু', 'শ'].map(d => h('span', { class: 'gx-cal__h', 'aria-hidden': 'true', text: d })), ...Array.from({ length: mo.lead }, () => h('span', { class: 'gx-cal__d gx-cal__d--blank', 'aria-hidden': 'true' })),
        ...mo.cells.map(c => h('span', { class: `gx-cal__d gx-cal__d--${c.state}${c.today ? ' is-today' : ''}`, role: 'img', 'aria-label': `${bn(c.d)} তারিখ, ${c.state === 'present' ? 'উপস্থিত' : c.state === 'absent' ? 'অনুপস্থিত' : 'ক্লাস ছিল না'}` }, bn(c.d), h('i', { 'aria-hidden': 'true', text: c.state === 'present' ? '✓' : c.state === 'absent' ? '–' : '' })))];
      box.replaceChildren(
        card('', h('div', { class: 'gx-stats' }, stat(bn(mo.present), 'উপস্থিত', 'gx-stat--good'), stat(bn(mo.absent), 'অনুপস্থিত', mo.absent ? 'gx-stat--warn' : ''), stat(mo.pct == null ? '—' : bn(mo.pct) + '%', 'উপস্থিতির হার'))),
        card('', h('div', { class: 'gx-monthbar' },
          h('button', { class: 'gx-nav', type: 'button', 'aria-label': 'আগের মাস', disabled: back >= 2, onclick: () => { back++; paint(); } }, icon('back')),
          h('h2', { class: 'gx-month', text: `${MONTHS[m - 1]} ${bn(y)}` }),
          h('button', { class: 'gx-nav gx-nav--next', type: 'button', 'aria-label': 'পরের মাস', disabled: back <= 0, onclick: () => { back--; paint(); } }, icon('back'))), h('div', { class: 'gx-cal' }, ...cells),
          h('p', { class: 'gx-legend' }, '✓ উপস্থিত · – অনুপস্থিত · ফাঁকা = ক্লাস ছিল না')),
        h('h2', { class: 'inbox-group__h', text: 'সাম্প্রতিক দিন' }),
        h('div', { class: 'de-card more-card' }, ...rowsList.slice(0, 15).map(r => h('div', { class: 'de-row gx-line' }, h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: `${dayText(r.date)} · ${weekday(r.date)}` }), r.source === 'cctv' ? h('span', { class: 'de-row__sub', text: 'ক্যামেরায় হাজিরা' }) : null),
          r.check_in ? h('span', { class: 'de-chip de-chip--good', text: `উপস্থিত ${clockText(r.check_in)}` }) : h('span', { class: 'de-chip de-chip--warn', text: 'অনুপস্থিত' })))));
    };
    paint();
    return box;
  },
});

// ---- results ----
export const resultsPage = () => childPage({
  key: 'marks', load: k => loadMarks(k.id), isEmpty: r => !r.length,
  empty: () => emptyState('এখনো কোনো ফল প্রকাশ হয়নি', 'পরীক্ষার নম্বর দেওয়া হলে এখানে দেখা যাবে।'),
  draw: ms => {
    const avg = avgPercent(ms);
    return [card('gx-hero', h('span', { class: 'gx-cap', text: 'সব পরীক্ষার গড় নম্বর' }), h('b', { class: 'gx-big', text: bn(avg) + '%' }), bar(avg / 100, tone(avg / 100))),
      ...ms.map(m => { const p = m.obtained / m.exam.full_marks; return card('', h('div', { class: 'gx-row' }, h('div', {}, h('span', { class: 'de-chip de-chip--plain', text: m.exam.subject?.name || 'পরীক্ষা' }), h('h3', { class: 'gx-h3', text: m.exam.title }), h('span', { class: 'de-row__sub', text: dayText(m.exam.exam_date) })),
        h('b', { class: 'gx-score', text: `${bn(m.obtained)}/${bn(m.exam.full_marks)}` })), bar(p, tone(p))); })];
  },
});

// ---- homework ----
export const homeworkPage = () => childPage({
  key: 'hw', load: k => loadHomework(k), isEmpty: r => !r.length,
  empty: () => emptyState('বাড়ির কাজ নেই', 'শিক্ষক বাড়ির কাজ দিলে এখানে দেখা যাবে।'),
  draw: list => {
    const today = dhakaDay(), sorted = list.slice().sort((a, b) => a.done - b.done || a.due_date.localeCompare(b.due_date));
    const when = x => (x.done ? 'জমা হয়েছে' : x.due_date === today ? 'আজ জমা' : x.due_date === addDays(today, 1) ? 'কাল জমা' : x.due_date < today ? 'জমার তারিখ পেরিয়েছে' : `${dayText(x.due_date)} জমা`);
    return h('div', { class: 'de-card more-card' }, ...sorted.map(x => h('div', { class: 'de-row gx-line' }, h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: `${x.subject?.name || ''}${x.subject ? ': ' : ''}${x.title}` }), h('span', { class: 'de-row__sub', text: when(x) })),
      x.done ? h('span', { class: 'de-chip de-chip--good', text: 'হয়েছে' }) : x.due_date < today ? h('span', { class: 'de-chip de-chip--warn', text: 'বাকি' }) : h('span', { class: 'de-chip de-chip--plain', text: 'চলছে' }))));
  },
});

// ---- routine ----
export const routinePage = () => childPage({
  key: 'routine', load: k => loadRoutine(k), isEmpty: d => !d.periods.length,
  empty: () => emptyState('রুটিন এখনো ঠিক হয়নি', 'রুটিন ঠিক হলে এখানে দেখা যাবে।'),
  draw: (d, kid) => [h('p', { class: 'de-row__sub gx-note', text: `${kid.name} · ${d.shift ? shiftBn(d.shift) + ' ব্যাচ' : 'সব ব্যাচ'}` }),
    h('div', { class: 'de-card more-card' }, ...d.periods.map(p => h('div', { class: 'de-row gx-line' }, h('span', { class: 'gx-slot', 'aria-hidden': 'true', text: bn(p.slot) }), h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: `${bn(p.slot)}ম ক্লাস` }), h('span', { class: 'de-row__sub', text: p.teacher?.full_name || 'শিক্ষক ঠিক হয়নি' })))))],
});

// ---- materials and videos ----
const KIND = { pdf: ['file', 'PDF'], note: ['file', 'নোট'], video: ['play', 'ভিডিও'], link: ['info', 'লিংক'] };
export const materialsPage = initial => {
  let only = ['video', 'pdf'].includes(initial) ? initial : 'all';
  return childPage({
    key: 'mat', load: k => loadMaterials(k), isEmpty: r => !r.length,
    empty: () => emptyState('এখনো কোনো উপকরণ নেই', 'শিক্ষক নোট বা ভিডিও দিলে এখানে দেখা যাবে।'),
    draw: list => {
      const box = h('div'), paint = () => {
        const shown = list.filter(m => only === 'all' || (only === 'video' ? m.kind === 'video' : m.kind !== 'video'));
        box.replaceChildren(chipRow('ধরন', [['all', 'সব'], ['video', 'ভিডিও'], ['pdf', 'নোট ও PDF']].map(([k, l]) => chip(l, only === k, () => { only = k; paint(); }))),
          shown.length ? h('div', { class: 'de-card more-card' }, ...shown.map(m => h('button', { class: 'de-row more-row', type: 'button', onclick: () => open(m) },
            h('span', { class: 'more-ic', 'aria-hidden': 'true' }, icon(KIND[m.kind]?.[0] || 'file')), h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: m.title }), h('span', { class: 'de-row__sub', text: [m.subject?.name, m.chapter, KIND[m.kind]?.[1]].filter(Boolean).join(' · ') })), icon('chev'))))
            : emptyState('এই ধরনের কিছু নেই', 'অন্য ধরন বেছে দেখুন।'));
      };
      paint();
      return box;
    },
  });
};
async function open(m) {
  let url = safeUrl(m.url);
  if (!url && m.storage_path) { toast('ফাইল খোলা হচ্ছে…'); url = await signedUrl(m.storage_path); }
  if (!url) return toast('ফাইলটা এখন খোলা যাচ্ছে না। নেট দেখে আবার চেষ্টা করুন।');
  window.open(url, '_blank', 'noopener');   // videos and files open in the browser (the app does not embed other sites)
}

// ---- revision plan (live rule: chapters spread over the days left, unfinished first, last day = everything) ----
export const revisionPage = () => childPage({
  key: 'rev', load: k => loadRevision(k), isEmpty: d => !d.exams.length,
  empty: () => emptyState('এখন কোনো পরীক্ষা ঠিক নেই', 'পরীক্ষার তারিখ ঠিক হলে পড়ার পরিকল্পনা এখানে নিজে থেকে তৈরি হবে।'),
  draw: d => d.exams.map(ex => {
    const today = dhakaDay(), left = Math.round((Date.parse(ex.exam_date) - Date.parse(today)) / 864e5), chs = d.chapters.filter(c => (ex.chapter_ids || []).includes(c.id)), plan = revisionPlan(ex.exam_date, chs, today);
    return card('', h('h2', { class: 'gx-h3', text: `${ex.subject?.name ? ex.subject.name + ': ' : ''}${ex.title}` }), h('span', { class: 'de-row__sub', text: `${dayText(ex.exam_date)} · আর ${bn(left)} দিন` }),
      plan.length ? h('ol', { class: 'gx-plan' }, ...plan.map(p => h('li', {}, h('b', { text: `${dayText(p.date)} (${weekday(p.date)})` }), h('span', { text: p.full ? 'সব অধ্যায় একবার দেখে নাও' : p.chapters.map(c => c.title).join(', ') })))) : h('p', { class: 'de-row__sub', text: 'পরিকল্পনার জন্য অধ্যায় ঠিক করা হয়নি।' }));
  }),
});

// ---- ratings and praise ----
const BADGE = { star: 'তারকা', helper: 'সাহায্যকারী', improver: 'উন্নতি', neat: 'পরিপাটি', punctual: 'সময়নিষ্ঠ', curious: 'জিজ্ঞাসু' };
const tot = r => Number(r.behavior) + Number(r.homework) + Number(r.performance);
export const ratingsPage = () => childPage({
  key: 'rat', load: k => loadRatings(k.id), isEmpty: d => !d.ratings.length && !d.praise.length,
  empty: () => emptyState('এখনো কোনো রেটিং নেই', 'শিক্ষক ক্লাসে রেটিং দিলে এখানে দেখা যাবে।'),
  draw: ({ ratings, praise }) => {
    const avg = ratings.length ? ratings.reduce((s, r) => s + tot(r), 0) / ratings.length : null;
    return [avg == null ? null : card('gx-hero', h('span', { class: 'gx-cap', text: `গত ${bn(ratings.length)} ক্লাসের গড়` }), h('b', { class: 'gx-big', text: `${bn(Math.round(avg * 10) / 10)}/১০` }), bar(avg / 10, tone(avg / 10))),
      ratings.length ? h('h2', { class: 'inbox-group__h', text: 'ক্লাস রেটিং' }) : null,
      ratings.length ? h('div', { class: 'de-card more-card' }, ...ratings.slice(0, 14).map(r => h('div', { class: 'de-row gx-line' }, h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: `${dayText(r.day)} · ${weekday(r.day)}` }),
        h('span', { class: 'de-row__sub', text: `আচরণ ${bn(r.behavior)} · বাড়ির কাজ ${Number(r.homework) === 0 ? 'হয়নি' : Number(r.homework) === 3 ? 'হয়েছে' : 'আধা'} · ক্লাসে ${bn(r.performance)}` })), h('b', { class: 'gx-score', text: bn(tot(r)) })))) : null,
      praise.length ? h('h2', { class: 'inbox-group__h', text: 'প্রশংসা কার্ড' }) : null,
      ...praise.map(p => card('', h('div', { class: 'gx-row' }, h('div', {}, h('h3', { class: 'gx-h3', text: BADGE[p.badge] || p.badge }), h('span', { class: 'de-row__sub', text: `${p.giver?.full_name || 'শিক্ষক'} · ${dayText(p.created_at)}` }), p.note ? h('p', { class: 'gx-note', text: p.note }) : null), h('span', { class: 'de-chip de-chip--good', text: 'প্রশংসা' }))))];
  },
});

// ---- goals ----
export const goalsPage = () => childPage({
  key: 'goals', load: k => loadGoals(k.id), isEmpty: r => !r.length,
  empty: () => emptyState('এখনো কোনো লক্ষ্য ঠিক হয়নি', 'শিক্ষক লক্ষ্য ঠিক করলে এখানে দেখা যাবে।'),
  draw: gs => h('div', { class: 'de-card more-card' }, ...gs.map(g => h('div', { class: 'de-row gx-line' }, h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: g.subject }), h('span', { class: 'de-row__sub', text: `লক্ষ্য ${bn(g.target_percent)}% নম্বর` })),
    g.achieved_at ? h('span', { class: 'de-chip de-chip--good', text: 'অর্জিত!' }) : h('span', { class: 'de-chip de-chip--plain', text: 'চলছে' })))),
});

// ---- certificates (same rules as the old app's certificates page; looking only, printing stays in the old app for now) ----
export const certsPage = () => childPage({
  key: 'certs', load: async k => { const [a, r, g] = await Promise.all([loadAttendance(k.id), loadRatings(k.id), loadGoals(k.id)]); const bad = [a, r, g].find(x => x.kind !== 'ok'); return bad ? { kind: bad.kind } : { kind: 'ok', data: { att: a.data, ...r.data, goals: g.data } }; },
  draw: d => {
    const held = d.att.length, pct = held ? Math.round(100 * d.att.filter(x => x.check_in).length / held) : 0, rs = d.ratings.slice(0, 12), avgT = rs.length ? rs.reduce((s, r) => s + tot(r), 0) / rs.length : 0, avgB = rs.length ? rs.reduce((s, r) => s + Number(r.behavior), 0) / rs.length : 0;
    const list = [['নিয়মিত উপস্থিতি', `${bn(pct)}% উপস্থিতি`, held >= 8 && pct >= 90, 'উপস্থিতি ৯০% হলে পাবে'], ['আদর্শ আচরণ', 'ক্লাসে ভদ্র ও মনোযোগী আচরণ', rs.length >= 6 && avgB >= 2.8, 'আচরণে প্রায় পুরো নম্বর পেলে পাবে'],
      ['চমৎকার পারফরম্যান্স', `গড় রেটিং ${bn(Math.round(avgT * 10) / 10)}/১০`, rs.length >= 6 && avgT >= 8.5, 'গড় রেটিং ৮.৫ হলে পাবে'], ['প্রশংসার তারকা', `${bn(d.praise.length)}টি প্রশংসা কার্ড`, d.praise.length >= 5, '৫টি প্রশংসা কার্ড লাগবে'],
      ...d.goals.filter(g => g.achieved_at).map(g => [`লক্ষ্য পূরণ: ${g.subject}`, `${bn(g.target_percent)}% নম্বরের লক্ষ্য`, true, ''])];
    return h('div', { class: 'de-card more-card' }, ...list.map(([t, why, got, hint]) => h('div', { class: 'de-row gx-line' + (got ? '' : ' is-dim') }, h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: t }), h('span', { class: 'de-row__sub', text: got ? why : hint })),
      got ? h('span', { class: 'de-chip de-chip--good', text: 'অর্জিত!' }) : h('span', { class: 'de-chip de-chip--plain', text: 'এখনো না' }))));
  },
});

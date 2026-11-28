// "প্রশ্নপত্র" (teacher): /more/paper (my papers), /more/paper/new and /more/paper/:id/edit (the builder), /more/paper/:id (one paper: print, run as an exam, copy).
// A paper is built from the question bank: pick by hand or "অটো বাছাই", reorder, set marks, edit a copy. The bank itself is never changed here.
import { h } from '../../ui/dom.js';
import { chip, chipRow } from '../../ui/chip.js';
import { field } from '../../ui/field.js';
import { openSheet } from '../../ui/sheet.js';
import { confirmBox } from '../../ui/dialog.js';
import { toast } from '../../ui/toast.js';
import { dataPage } from '../../ui/datapage.js';
import { stateCard, loading, errorState, offlineState } from '../../ui/states.js';
import { icon } from '../../ui/icons.js';
import { store } from '../../core/store.js';
import { bn, ascii, agoText, dhakaDay, shortDate } from '../../core/bn.js';
import { QT, LAB, LEVELS, chaptersOf } from './logic.js';
import { myLevels } from './data.js';
import * as P from './paper-logic.js';
import { loadBankFull, loadPapers, loadPaper, savePaper, deletePaper, publishOnline, loadPaperRuns, closeRun } from './paper-data.js';

const SHOW = 40;                                   // questions drawn at once in the picker
const DRAFT = 'de.next.paperdraft';
const closeSheet = () => { document.querySelector('.de-sheet')?.remove(); document.querySelector('.de-sheet-scrim')?.remove(); };
const subLine = p => `ক্লাস ${bn(p.class_level)} · ${p.subject} · ${P.totalsLine(p.items)}`;
const say = (state, ok) => toast(state === 'offline' ? 'নেট নেই, নেট এলে আবার চাপুন' : state === 'forbidden' ? 'এই প্রশ্নপত্র আপনি বদলাতে পারবেন না (যিনি বানিয়েছেন বা অ্যাডমিন পারবেন)' : state === 'saved' || state === 'ok' ? ok : 'হয়নি, আবার চেষ্টা করুন');

// the question as a student would read it: body, options (the right one marked), marks
function qView(it, { answer = true } = {}) {
  return h('div', { class: 'tc-wrap pp-q' }, h('p', { class: 'tc-q', text: it.body }),
    it.options?.length ? h('ol', { class: 'tc-opts' }, ...it.options.map((o, i) => h('li', { class: answer && String(o) === it.answer ? 'is-ans' : '' }, h('span', { class: 'tc-lab', text: LAB[i] || bn(i + 1) }), h('span', { text: String(o) + (answer && String(o) === it.answer ? ' ✓' : '') })))) : (answer && it.answer ? h('p', { class: 'tc-cap', text: 'উত্তর: ' + it.answer }) : null));
}
const tag = (text, cls = '') => h('span', { class: 'de-chip de-chip--plain ' + cls, text });

// ================= my papers =================
export function paperListPage(ctx) {
  return dataPage({
    key: 'papers.list', load: loadPapers, isEmpty: d => !d.length,
    empty: () => stateCard({ kind: 'empty', title: 'এখনো কোনো প্রশ্নপত্র নেই', text: 'প্রশ্ন ব্যাংক থেকে বেছে মিনিটেই প্রশ্নপত্র বানিয়ে ফেলুন। ছাপতে পারবেন, অ্যাপে পরীক্ষাও নিতে পারবেন।', action: 'প্রথম প্রশ্নপত্র বানান', onAction: () => ctx.go('/more/paper/new') }),
    draw: list => [h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: () => ctx.go('/more/paper/new'), text: '+ নতুন প্রশ্নপত্র বানান' }),
      h('div', { class: 'de-card' }, h('ul', { class: 'tc-list' }, ...list.map(p => h('li', {}, h('button', { class: 'de-row more-row', type: 'button', onclick: () => ctx.go('/more/paper/' + p.id) },
        h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: p.title }), h('span', { class: 'de-row__sub', text: `${subLine(p)} · ${agoText(p.updated_at || p.created_at)}` })), icon('chev'))))))],
  });
}

// ================= one paper =================
export function paperViewPage(ctx, id) {
  let box = null;
  const page = dataPage({
    key: null, load: () => loadPaper(id), isEmpty: () => false, empty: () => null,
    draw: (p, reload) => {
      const printIt = withAnswers => { store.setJson('de.next.print', P.printJob(p, { withAnswers })); if (!window.open('print.html', '_blank')) toast('নতুন পাতা খুলতে দিন, তারপর আবার চাপুন।'); };
      const runs = h('div');
      const drawRuns = async () => {
        const r = await loadPaperRuns(p.id);
        const list = r.kind === 'ok' ? r.data : [];
        runs.replaceChildren(...(list.length ? [h('h3', { class: 'tc-h', text: 'এটা দিয়ে নেওয়া পরীক্ষা' }), h('div', { class: 'de-card' }, h('ul', { class: 'tc-list' }, ...list.map(x => h('li', {}, h('div', { class: 'de-row' },
          h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: x.title }), h('span', { class: 'de-row__sub', text: `${x.kind === 'practice' ? 'যেকোনো সময়' : shortDate(Date.parse(x.starts_at)) + ' থেকে'} · ${bn(x.duration_minutes)} মিনিট · ${bn(x.attempts || 0)} জন দিয়েছে · ${x.status === 'published' ? 'চালু' : 'বন্ধ'}` })),
          x.status === 'published' ? h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: 'বন্ধ করুন', onclick: async () => { if (!await confirmBox({ title: 'পরীক্ষা বন্ধ?', text: 'শিক্ষার্থীরা আর এটা দেখবে না। যারা দিয়ে ফেলেছে তাদের ফল থাকবে।', ok: 'বন্ধ করুন' })) return; say(await closeRun(x.id), 'পরীক্ষা বন্ধ হয়েছে'); drawRuns(); } }) : null)))))] : []));
      };
      drawRuns();
      return [h('p', { class: 'tc-sub', text: subLine(p) }),
        h('div', { class: 'tc-wrap' },
          h('button', { class: 'de-btn de-btn--primary', type: 'button', text: 'প্রশ্নপত্র ছাপুন / PDF', onclick: () => printIt(false) }),
          h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: 'উত্তরমালাসহ ছাপুন', onclick: () => printIt(true) })),
        h('div', { class: 'de-card tc-card' }, h('h3', { class: 'tc-h', text: 'অ্যাপে পরীক্ষা নিন' }), h('p', { class: 'tc-cap', text: P.onlineSummary(p).text }),
          h('button', { class: 'de-btn de-btn--primary', type: 'button', disabled: !P.onlineSummary(p).on, text: 'শিক্ষার্থীদের পরীক্ষা চালু করুন', onclick: () => runSheet(p, drawRuns) })),
        runs,
        h('div', { class: 'tc-wrap' },
          h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: 'সম্পাদনা', onclick: () => ctx.go(`/more/paper/${p.id}/edit`) }),
          h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: 'কপি করে নতুন বানান', onclick: () => { saveDraft(P.copyPaper(p), true); ctx.go('/more/paper/new'); } }),
          h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: 'মুছুন', onclick: async () => { if (!await confirmBox({ title: 'প্রশ্নপত্র মুছবেন?', text: 'প্রশ্নপত্রটা চলে যাবে। প্রশ্ন ব্যাংকের প্রশ্ন ঠিকই থাকবে।', ok: 'মুছুন', danger: true })) return; const s = await deletePaper(p.id); say(s, 'মুছে গেছে'); if (s === 'saved' || s === 'ok') ctx.replace('/more/paper'); } })),
        h('h3', { class: 'tc-h', text: `প্রশ্নগুলো (${bn(p.items.length)}টা)` }),
        ...P.sections(P.groupByType(p.items)).map(s => h('section', { class: 'tc-page' }, h('p', { class: 'tc-cap', text: `${s.title} · ${P.marksText(s.marks)} নম্বর` }),
          ...s.rows.map(({ no, item }) => h('div', { class: 'de-card tc-card' }, h('div', { class: 'tc-wrap' }, tag(`${bn(no)}।`), tag(`${P.marksText(item.marks)} নম্বর`), item.chapter ? tag(item.chapter) : null, item.edited ? tag('বদলানো') : null), qView(item)))))];
    },
  });
  return page;
}

// run as an online exam
function runSheet(p, done) {
  const on = P.onlineSummary(p);
  let kind = 'practice';
  const mins = field({ label: 'কত মিনিট সময়', inputmode: 'numeric', value: bn(String(Number(ascii(p.header?.minutes || '')) || Math.max(10, on.on))) });
  const start = field({ label: 'কখন শুরু (বাংলাদেশ সময়)', type: 'datetime-local' });
  const kinds = h('div'), startBox = h('div'), msg = h('p', { class: 'tc-cap' });
  const go = h('button', { class: 'de-btn de-btn--primary', type: 'button', text: 'চালু করুন' });
  const draw = () => {
    kinds.replaceChildren(chipRow('কীভাবে', [chip('যেকোনো সময় (অনুশীলন)', kind === 'practice', () => { kind = 'practice'; draw(); }), chip('নির্দিষ্ট সময়ে', kind === 'live', () => { kind = 'live'; draw(); })]));
    startBox.replaceChildren(kind === 'live' ? start.el : '');
    msg.textContent = kind === 'practice' ? `ক্লাস ${bn(p.class_level)}-এর শিক্ষার্থীরা যেকোনো সময় এটা দিতে পারবে।` : `ক্লাস ${bn(p.class_level)}-এর শিক্ষার্থীরা শুরুর সময় থেকে সময়সীমার মধ্যে একবারই দিতে পারবে।`;
  };
  draw();
  go.addEventListener('click', async () => {
    const v = P.validateRun({ kind, minutes: mins.input.value, start: start.input.value }), e = v.errors;
    mins.error(e.minutes || ''); start.error(e.start || e.end || '');
    if (!v.ok) return;
    go.disabled = true; go.textContent = 'চালু হচ্ছে…';
    const r = await publishOnline(p, v.value);
    go.disabled = false; go.textContent = 'চালু করুন';
    if (r.state !== 'ok') return toast(r.state === 'offline' ? 'নেট নেই, নেট এলে আবার চাপুন' : r.state === 'empty' ? 'অ্যাপে দেওয়ার মতো বহুনির্বাচনী প্রশ্ন নেই' : 'পরীক্ষা চালু হয়নি, আবার চেষ্টা করুন');
    closeSheet(); toast('পরীক্ষা চালু হয়েছে। শিক্ষার্থীরা "পরীক্ষা"-য় দেখবে।'); done?.();
  });
  openSheet({ title: 'অ্যাপে পরীক্ষা চালু', content: h('div', { class: 'sheet-col' }, h('p', { class: 'sheet-text', text: on.text }), kinds, msg, mins.el, startBox, go) });
}

// ================= the builder =================
function saveDraft(p, force) { if (force || p.items.length || p.title) store.setJson(DRAFT, { at: Date.now(), paper: p }); }
const readDraft = () => { const d = store.json(DRAFT); return d?.paper && Array.isArray(d.paper.items) && Date.now() - d.at < 7 * 86400e3 ? d.paper : null; };

export function paperBuilderPage(ctx, id) {
  const root = h('div', { class: 'tc-page' });
  let inner = null;
  const mount = (p, isNew) => { inner = builder(ctx, p, isNew); root.replaceChildren(inner.node); };
  if (id === 'new') {
    const d = readDraft();
    // a copy made from "কপি করে নতুন বানান" or a draft left from earlier
    if (d && (d.items.length || d.title)) {
      root.replaceChildren(stateCard({ kind: 'empty', title: 'আগের অসমাপ্ত প্রশ্নপত্র আছে', text: `"${d.title || 'নামহীন'}" · ${P.totalsLine(d.items)}`, action: 'এটাই চালিয়ে যাই', onAction: () => mount(d, true),
        extra: h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: 'না, নতুন করে শুরু', onclick: () => { store.del(DRAFT); mount(P.newPaper(), true); } }) }));
    } else mount(P.newPaper(), true);
  } else {
    root.replaceChildren(loading(3));
    loadPaper(id).then(r => {
      if (!root.isConnected && !inner) { /* page left */ }
      if (r.kind === 'ok') mount(r.data, false);
      else root.replaceChildren(r.kind === 'offline' ? offlineState(() => ctx.replace(`/more/paper/${id}/edit`)) : r.kind === 'missing' ? stateCard({ kind: 'empty', title: 'এই প্রশ্নপত্র পাওয়া যায়নি', action: 'আমার প্রশ্নপত্র', onAction: () => ctx.replace('/more/paper') }) : errorState(() => ctx.replace(`/more/paper/${id}/edit`)));
    });
  }
  return { node: root, destroy() { inner?.destroy?.(); } };
}

function builder(ctx, paper, isNew) {
  let p = paper, tab = p.items.length && !isNew ? 'mine' : 'pick', bank = null, bankLevel = null, bankState = '', saving = false, dead = false, shown = SHOW;
  const f = { qtype: null, chapters: new Set(), difficulty: null, only: null, q: '', hideFigure: true };
  let auto = { n: 10, mix: false };
  const root = h('div', { class: 'tc-page' });
  const update = (patch, redraw = true) => { p = { ...p, ...patch }; if (isNew) saveDraft(p); if (redraw) draw(); };
  const setItems = items => update({ items });

  async function loadBank(level) {
    bank = null; bankLevel = level; bankState = 'loading'; draw();
    const r = await loadBankFull(level);
    if (dead || bankLevel !== level) return;
    if (r.kind === 'ok') { bank = r.data; bankState = ''; } else bankState = r.kind === 'offline' ? 'নেট নেই। নেট এলে আবার চেষ্টা করুন।' : 'প্রশ্ন আনা যায়নি।';
    draw();
  }
  const levels = [...LEVELS];
  myLevels().then(r => { if (r.kind === 'ok' && r.data?.length && !dead && !p.class_level && !p.items.length) { levels.splice(0, levels.length, ...r.data); draw(); } });
  if (p.class_level) loadBank(p.class_level);

  // ---------- tab 1: pick ----------
  function setup() {
    const subjects = bank ? [...new Set(bank.map(r => r.subject))].sort((a, b) => a.localeCompare(b, 'bn')) : [];
    const locked = p.items.length > 0;
    return h('div', { class: 'de-card tc-card' },
      chipRow('ক্লাস', levels.map(n => chip(`ক্লাস ${bn(n)}`, p.class_level === n, () => { if (locked && n !== p.class_level) return toast('প্রশ্ন বাছা হয়ে গেলে ক্লাস বদলানো যায় না। নতুন প্রশ্নপত্র বানান।'); update({ class_level: n, subject: '' }, false); f.chapters.clear(); loadBank(n); }))),
      p.class_level ? (bankState === 'loading' ? h('p', { class: 'tc-cap', text: 'প্রশ্ন আনা হচ্ছে…' }) : bankState ? h('p', { class: 'tc-cap', text: bankState }) : subjects.length ? chipRow('বিষয়', subjects.map(s => chip(s, p.subject === s, () => { if (locked && s !== p.subject) return toast('প্রশ্ন বাছা হয়ে গেলে বিষয় বদলানো যায় না। নতুন প্রশ্নপত্র বানান।'); f.chapters.clear(); shown = SHOW; update({ subject: s }); }))) : h('p', { class: 'tc-cap', text: 'এই ক্লাসের ব্যাংকে এখনো প্রশ্ন নেই। "প্রশ্ন জমা" থেকে বইয়ের পাতা দিন।' })) : h('p', { class: 'tc-cap', text: 'আগে ক্লাস বেছে নিন।' }));
  }
  function picker() {
    const rows = bank.filter(r => r.subject === p.subject);
    const chosen = new Set(p.items.map(i => i.bank_id).filter(Boolean));
    const pool = P.pickable(rows, { ...f, chapters: f.chapters });
    const free = P.pickable(rows, { ...f, exclude: chosen });
    const types = [...new Set(rows.map(r => r.qtype))], chs = chaptersOf(rows), hasRes = rows.some(r => r.visibility === 'reserved'), hasFig = rows.some(r => r.needs_figure);
    const list = h('div', { class: 'tc-page' });
    const paintList = () => {
      const view = pool.slice(0, shown);
      list.replaceChildren(h('p', { class: 'tc-cap', text: `${bn(pool.length)}টা প্রশ্ন পাওয়া গেছে${pool.length ? ` · ${bn(pool.length - free.length)}টা আগেই যোগ হয়েছে` : ''}` }),
        pool.length ? null : stateCard({ kind: 'empty', title: 'কোনো প্রশ্ন মিলল না', text: 'ফিল্টার একটু কমিয়ে দেখুন।', mascot: false }),
        ...view.map(r => { const inP = chosen.has(r.id); return h('div', { class: 'de-card tc-card' + (inP ? ' is-picked' : '') },
          h('div', { class: 'tc-wrap' }, tag(QT[r.qtype] || r.qtype), r.chapter_name ? tag(r.chapter_name) : null, r.difficulty ? tag(P.DIFF[r.difficulty] || r.difficulty) : null, r.needs_figure ? tag('ছবি লাগে', 'de-chip--warn') : null, r.visibility === 'reserved' ? tag('পরীক্ষার জন্য রাখা') : null),
          qView({ ...r, options: r.options || [] }),
          inP ? h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: '✓ যোগ হয়েছে, বাদ দিন', onclick: () => setItems(p.items.filter(i => i.bank_id !== r.id)) })
            : h('button', { class: 'de-btn de-btn--primary', type: 'button', text: '+ প্রশ্নপত্রে যোগ করুন', onclick: () => setItems(P.addItems(p.items, [r])) })); }),
        pool.length > shown ? h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: `আরও দেখান (${bn(pool.length - shown)}টা বাকি)`, onclick: () => { shown += SHOW; paintList(); } }) : null);
    };
    paintList();
    const search = h('input', { class: 'de-field__input', type: 'search', placeholder: 'প্রশ্নে খুঁজুন', 'aria-label': 'প্রশ্নে খুঁজুন', value: f.q, oninput: e => { f.q = e.target.value; setTimeout(() => { if (f.q === e.target.value) { shown = SHOW; draw(); const s = root.querySelector('input[type=search]'); s?.focus(); s?.setSelectionRange(f.q.length, f.q.length); } }, 350); } });
    const nInput = h('input', { class: 'de-field__input pp-n', type: 'text', inputmode: 'numeric', 'aria-label': 'কয়টা প্রশ্ন', value: bn(auto.n), oninput: e => { auto.n = Math.max(1, Math.min(P.MAX_ITEMS, Number(ascii(e.target.value)) || 1)); } });
    const doAuto = () => {
      const n = Math.min(auto.n, P.MAX_ITEMS - p.items.length);
      if (!free.length) return toast('যোগ করার মতো প্রশ্ন নেই। ফিল্টার বদলে দেখুন।');
      const mix = auto.mix ? { easy: Math.round(n * 0.3), medium: Math.round(n * 0.5), hard: n - Math.round(n * 0.3) - Math.round(n * 0.5) } : null;
      const got = P.autoPick(free, n, { mix });
      setItems(P.addItems(p.items, got));
      toast(got.length < auto.n ? `${bn(got.length)}টা প্রশ্ন যোগ হলো (এর বেশি পাওয়া যায়নি)` : `${bn(got.length)}টা প্রশ্ন বেছে দিলাম। "আমার প্রশ্নপত্র" থেকে দেখে নিন।`);
    };
    return [h('div', { class: 'de-card tc-card' }, h('h3', { class: 'tc-h', text: 'অটো বাছাই' }), h('p', { class: 'tc-cap', text: 'নিচের ফিল্টার অনুযায়ী এলোমেলোভাবে বেছে দেব, প্রতি অধ্যায় থেকে সমানভাবে।' }),
        h('div', { class: 'tc-row' }, nInput, h('span', { class: 'tc-cap', text: 'টা প্রশ্ন' }), h('button', { class: 'de-btn de-btn--primary tc-grow', type: 'button', text: 'বেছে দিন', onclick: doAuto })),
        chipRow('মিশ্রণ', [chip('সহজ-মাঝারি-কঠিন মিশিয়ে (৩:৫:২)', auto.mix, () => { auto.mix = !auto.mix; draw(); })])),
      h('div', { class: 'de-card tc-card' }, h('h3', { class: 'tc-h', text: 'নিজে বাছুন' }), search,
        types.length > 1 ? chipRow('ধরন', [chip('সব ধরন', !f.qtype, () => { f.qtype = null; shown = SHOW; draw(); }), ...types.map(t => chip(QT[t] || t, f.qtype === t, () => { f.qtype = f.qtype === t ? null : t; shown = SHOW; draw(); }))]) : null,
        chs.length ? chipRow('অধ্যায় (একাধিক বাছা যায়)', [chip('সব অধ্যায়', !f.chapters.size, () => { f.chapters.clear(); shown = SHOW; draw(); }), ...chs.map(c => chip(c, f.chapters.has(c), () => { f.chapters.has(c) ? f.chapters.delete(c) : f.chapters.add(c); shown = SHOW; draw(); }))]) : null,
        chipRow('কঠিনতা', [chip('সব', !f.difficulty, () => { f.difficulty = null; shown = SHOW; draw(); }), ...Object.keys(P.DIFF).map(d => chip(P.DIFF[d], f.difficulty === d, () => { f.difficulty = f.difficulty === d ? null : d; shown = SHOW; draw(); }))]),
        hasRes ? chipRow('কোন প্রশ্ন', [chip('সব', !f.only, () => { f.only = null; draw(); }), chip('পরীক্ষার জন্য রাখা', f.only === 'reserved', () => { f.only = f.only === 'reserved' ? null : 'reserved'; draw(); }), chip('অনুশীলনের', f.only === 'practice', () => { f.only = f.only === 'practice' ? null : 'practice'; draw(); })]) : null,
        hasFig ? chipRow('ছবি', [chip('ছবি লাগে এমন প্রশ্ন বাদ', f.hideFigure, () => { f.hideFigure = !f.hideFigure; draw(); })]) : null,
        pool.length && pool.length <= 100 && free.length ? h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: `এই ${bn(free.length)}টাই যোগ করুন`, onclick: () => setItems(P.addItems(p.items, free)) }) : null),
      list];
  }

  // ---------- tab 2: my paper ----------
  function mine() {
    const t = P.totals(p.items);
    const title = field({ label: 'প্রশ্নপত্রের নাম', value: p.title, maxlength: P.TITLE_MAX, placeholder: 'যেমন: ৬ষ্ঠ শ্রেণি গণিত, প্রথম সাময়িক', oninput: e => { p = { ...p, title: e.target.value }; if (isNew) saveDraft(p); } });
    const hd = (k, label, opts = {}) => { const fl = field({ label, value: p.header?.[k] || '', maxlength: opts.max || 80, type: opts.type, inputmode: opts.inputmode, placeholder: opts.ph, oninput: e => { p = { ...p, header: { ...p.header, [k]: e.target.value } }; if (isNew) saveDraft(p); } }); return fl; };
    const minutes = hd('minutes', 'সময় (মিনিট)', { inputmode: 'numeric', max: 4, ph: 'যেমন: ৪৫' });
    const date = hd('date', 'তারিখ', { type: 'date', max: 30 });
    const head = h('details', { class: 'de-card tc-card pp-head' }, h('summary', { class: 'tc-h', text: 'কাগজের ওপরের তথ্য (ঐচ্ছিক)' }),
      hd('institute', 'প্রতিষ্ঠানের নাম', { ph: 'ডিফ এডু' }).el, hd('exam_name', 'পরীক্ষার নাম', { ph: 'যেমন: প্রথম সাময়িক পরীক্ষা' }).el, date.el, minutes.el, hd('note', 'নির্দেশনা', { max: 300, ph: 'যেমন: সব প্রশ্নের উত্তর দাও' }).el);
    const types = P.TYPE_ORDER.filter(k => t.byType[k]);
    const bulk = types.length ? h('div', { class: 'de-card tc-card' }, h('h3', { class: 'tc-h', text: 'নম্বর একসাথে ঠিক করুন' }), ...types.map(k => { const cur = p.items.find(i => i.qtype === k)?.marks ?? 1; const inp = h('input', { class: 'de-field__input pp-n', type: 'text', inputmode: 'decimal', 'aria-label': `${QT[k]} প্রতিটির নম্বর`, value: bn(cur) });
      return h('div', { class: 'tc-row' }, h('span', { class: 'tc-grow', text: `${QT[k]} (${bn(t.byType[k])}টা), প্রতিটি` }), inp, h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: 'ঠিক করুন', onclick: () => { const m = Number(ascii(inp.value).replace(',', '.')); if (!(m > 0 && m <= 100)) return toast('নম্বর ০-এর বেশি আর ১০০-এর মধ্যে দিন'); setItems(P.setMarksAll(p.items, k, m)); } })); })) : null;
    const items = p.items.map((it, i) => h('div', { class: 'de-card tc-card' },
      h('div', { class: 'tc-row' }, h('b', { class: 'tc-grow', text: `${bn(i + 1)}। ${QT[it.qtype] || it.qtype} · ${P.marksText(it.marks)} নম্বর` }), it.edited ? tag('বদলানো') : null, it.needs_figure ? tag('ছবি লাগে', 'de-chip--warn') : null),
      qView(it),
      h('div', { class: 'tc-wrap' },
        h('button', { class: 'de-btn de-btn--secondary', type: 'button', 'aria-label': 'ওপরে নিন', disabled: i === 0, text: '↑ ওপরে', onclick: () => setItems(P.moveItem(p.items, i, i - 1)) }),
        h('button', { class: 'de-btn de-btn--secondary', type: 'button', 'aria-label': 'নিচে নিন', disabled: i === p.items.length - 1, text: '↓ নিচে', onclick: () => setItems(P.moveItem(p.items, i, i + 1)) }),
        h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: 'বদলান / নম্বর', onclick: () => editSheet(it, nu => setItems(p.items.map((x, k) => (k === i ? nu : x)))) }),
        h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: 'বাদ দিন', onclick: () => setItems(P.removeAt(p.items, i)) }))));
    const own = h('div', { class: 'tc-wrap' }, ...['mcq', 'short', 'creative'].map(k => h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: `+ নিজের ${QT[k]} প্রশ্ন লিখুন`, onclick: () => editSheet(P.blankItem(k), nu => setItems([...p.items, nu])) })));
    return [h('div', { class: 'de-card tc-card' }, title.el, h('p', { class: 'tc-big', text: P.totalsLine(p.items) }),
        p.class_level ? h('p', { class: 'tc-cap', text: `ক্লাস ${bn(p.class_level)} · ${p.subject || 'বিষয় বাছা হয়নি'}` }) : h('p', { class: 'tc-cap', text: 'ক্লাস আর বিষয় "প্রশ্ন বাছুন" থেকে ঠিক করুন।' })),
      head, bulk, ...(items.length ? items : [stateCard({ kind: 'empty', title: 'এখনো কোনো প্রশ্ন নেই', text: '"প্রশ্ন বাছুন" থেকে প্রশ্ন যোগ করুন, অথবা নিজের প্রশ্ন লিখুন।', mascot: false })]), own];
  }

  // ---------- one question's edit sheet (a copy: the bank keeps the original) ----------
  function editSheet(it, done) {
    const body = field({ label: 'প্রশ্ন', value: it.body, multiline: true, rows: 4 });
    const marks = field({ label: 'নম্বর', value: bn(it.marks), inputmode: 'decimal' });
    let ans = it.answer;
    const optsBox = h('div', { class: 'sheet-col' });
    const optF = it.qtype === 'mcq' ? (it.options.length ? it.options : ['', '', '', '']).map((o, i) => field({ label: `অপশন ${LAB[i] || bn(i + 1)}`, value: o })) : [];
    while (optF.length && optF.length < 4) optF.push(field({ label: `অপশন ${LAB[optF.length]}`, value: '' }));
    const ansF = it.qtype === 'mcq' ? null : field({ label: it.qtype === 'creative' ? 'উত্তরের নির্দেশনা (ঐচ্ছিক)' : 'উত্তর (ঐচ্ছিক)', value: it.answer, multiline: true, rows: 3 });
    const pickBox = h('div');
    const drawPick = () => pickBox.replaceChildren(it.qtype === 'mcq' ? chipRow('সঠিক উত্তর কোনটা', optF.map((fl, i) => { const v = fl.input.value.trim(); return chip(LAB[i] || bn(i + 1), !!v && v === ans, () => { ans = fl.input.value.trim(); drawPick(); }); })) : '');
    optF.forEach(fl => fl.input.addEventListener('input', () => { if (ans && !optF.some(x => x.input.value.trim() === ans)) ans = ''; }));
    optF.forEach(fl => fl.input.addEventListener('change', drawPick));
    drawPick();
    optsBox.append(...optF.map(x => x.el));
    const msg = h('p', { class: 'de-field__help', role: 'alert' });
    const save = h('button', { class: 'de-btn de-btn--primary', type: 'button', text: 'ঠিক আছে', onclick: () => {
      const r = P.editItem(it, { body: body.input.value, options: optF.map(x => x.input.value), answer: it.qtype === 'mcq' ? ans : ansF.input.value, marks: marks.input.value });
      if (!r.ok) { msg.textContent = r.error; return; }
      closeSheet(); done(r.item);
    } });
    openSheet({ title: it.bank_id ? 'প্রশ্ন বদলান (শুধু এই প্রশ্নপত্রে)' : 'নিজের প্রশ্ন', content: h('div', { class: 'sheet-col' }, it.bank_id ? h('p', { class: 'sheet-text', text: 'এটা কপি। ব্যাংকের আসল প্রশ্ন বদলাবে না।' }) : null, body.el, optsBox, pickBox, ansF?.el, marks.el, msg, save) });
  }

  // ---------- save ----------
  async function save() {
    if (saving) return;
    p = { ...p, header: P.cleanHeader(p.header) };
    const v = P.validatePaper(p);
    if (!v.ok) { const first = Object.values(v.errors)[0]; if (v.errors.title) tab = 'mine'; toast(first); draw(); return; }
    saving = true; draw();
    const s = await savePaper(p, { isNew });
    saving = false;
    if (s === 'saved' || s === 'ok') { store.del(DRAFT); toast('প্রশ্নপত্র সংরক্ষণ হয়েছে'); ctx.replace('/more/paper/' + p.id); return; }
    say(s, ''); draw();
  }

  function draw() {
    if (dead) return;
    const t = P.totals(p.items);
    const keepScroll = window.scrollY;
    root.replaceChildren(...[
      h('div', { class: 'tc-wrap' }, ...[['pick', 'প্রশ্ন বাছুন'], ['mine', `আমার প্রশ্নপত্র (${bn(t.count)})`]].map(([k, l]) => h('button', { class: 'de-btn ' + (tab === k ? 'de-btn--primary' : 'de-btn--secondary'), type: 'button', 'aria-pressed': String(tab === k), text: l, onclick: () => { tab = k; draw(); window.scrollTo(0, 0); } }))),
      ...(tab === 'pick' ? [setup(), p.class_level && p.subject && bank ? picker() : null] : mine()),
      h('div', { class: 'tc-sticky' }, h('span', { class: 'tc-total', text: P.totalsLine(p.items) }),
        h('div', { class: 'tc-wrap' }, tab === 'pick' ? h('button', { class: 'de-btn de-btn--secondary', type: 'button', disabled: !t.count, text: 'দেখুন ও সাজান →', onclick: () => { tab = 'mine'; draw(); window.scrollTo(0, 0); } }) : null,
          h('button', { class: 'de-btn de-btn--primary', type: 'button', disabled: saving, text: saving ? 'সংরক্ষণ হচ্ছে…' : 'সংরক্ষণ করুন', onclick: save })))].flat(Infinity).filter(Boolean));
    if (tab === 'pick') window.scrollTo(0, keepScroll);
  }
  draw();
  return { node: root, destroy() { dead = true; } };
}

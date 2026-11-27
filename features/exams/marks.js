// "নম্বর এন্ট্রি": the exams of my classes, a new exam, and one box per student for the marks. Blank = not entered. A mark above the full marks is refused on the phone.
// Saved marks go through the outbox (marks has one row per exam and student). A changed saved mark asks once, because the report card reads it.
import { h } from '../../ui/dom.js';
import { chip, chipRow } from '../../ui/chip.js';
import { field } from '../../ui/field.js';
import { openSheet } from '../../ui/sheet.js';
import { confirmBox } from '../../ui/dialog.js';
import { toast } from '../../ui/toast.js';
import { saveBar } from '../../ui/savebar.js';
import { dataPage } from '../../ui/datapage.js';
import { stateCard } from '../../ui/states.js';
import { icon } from '../../ui/icons.js';
import { session } from '../../core/session.js';
import { bn, shortDate } from '../../core/bn.js';
import { avatar } from '../teacher/ui.js';
import { LEVELS, TITLE_MAX, validateExam, examCards, marksDiff, marksSummary, parseMark } from './logic.js';
import { loadExams, loadExam, loadSubjects, createExam, saveMarks, myLevels, today } from './data.js';

const num = v => bn(Number.isInteger(+v) ? String(+v) : String(+v));

// ---- list ----
export function marksListPage(ctx) {
  let only = true;   // true = only my classes
  const open = id => ctx.go('/more/marks/' + id);
  return dataPage({
    key: 'marks.list',
    load: async () => {
      const [e, l] = await Promise.all([loadExams(), myLevels()]);
      return e.kind === 'ok' ? { kind: 'ok', data: { ...e.data, levels: l.kind === 'ok' ? l.data : null } } : e;
    },
    isEmpty: () => false,
    draw: (d, reload) => {
      const cards = examCards(d.exams, d.marksCount, d.classSize);
      const shown = only && d.levels ? cards.filter(c => d.levels.includes(c.class_level)) : cards;
      const newBtn = h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: () => newExamSheet({ levels: d.levels, onDone: async id => { reload(); if (id) open(id); } }) }, icon('plus'), 'নতুন পরীক্ষা');
      const row = c => h('li', {}, h('button', { class: 'de-row more-row', type: 'button', onclick: () => open(c.id) },
        h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: `${c.subject_name ? c.subject_name + ' · ' : ''}${c.title}` }),
          h('span', { class: 'de-row__sub', text: `ক্লাস ${bn(c.class_level)} · ${c.exam_date ? shortDate(c.exam_date + 'T00:00:00+06:00') : 'তারিখ নেই'} · পূর্ণমান ${num(c.full_marks)}` })),
        h('span', { class: 'de-chip ' + (c.complete ? 'de-chip--good' : 'de-chip--warn'), text: c.total != null ? `${bn(c.done)}/${bn(c.total)}` : bn(c.done) }), icon('chev')));
      return [
        newBtn,
        d.levels ? chipRow('কোন ক্লাস', [chip('আমার ক্লাস', only, () => { only = true; reload(); }), chip('সব ক্লাস', !only, () => { only = false; reload(); })]) : null,
        shown.length ? h('div', { class: 'de-card' }, h('ul', { class: 'tc-list' }, ...shown.map(row)))
          : stateCard({ kind: 'empty', title: 'এখনো কোনো পরীক্ষা নেই', text: 'উপরের "নতুন পরীক্ষা" দিয়ে পরীক্ষা বানান, তারপর নম্বর দিন।' }),
        d.partial ? h('p', { class: 'tc-cap', text: 'কয়টা নম্বর দেওয়া হয়েছে তা পুরো আনা যায়নি।' }) : null,
      ];
    },
  });
}

// ---- new exam ----
function newExamSheet({ levels, onDone }) {
  let level = levels?.length === 1 ? levels[0] : null, subject = '', subjects = [];
  const title = field({ label: 'পরীক্ষার নাম', maxlength: TITLE_MAX, help: 'যেমন: মডেল টেস্ট ২, ইউনিট টেস্ট' });
  const full = field({ label: 'পূর্ণমান', inputmode: 'numeric', value: '100' });
  const date = field({ label: 'পরীক্ষার তারিখ', type: 'date', value: today() });
  const lvBox = h('div'), subBox = h('div'), go = h('button', { class: 'de-btn de-btn--primary', type: 'button', text: 'পরীক্ষা তৈরি করুন' });
  const drawLv = () => lvBox.replaceChildren(chipRow('কোন ক্লাস', (levels || LEVELS).map(l => chip('ক্লাস ' + bn(l), l === level, () => { level = l; subject = ''; drawLv(); loadSub(); }))));
  const drawSub = () => subBox.replaceChildren(subjects.length ? chipRow('বিষয় (ঐচ্ছিক)', subjects.map(s => chip(s.name_bn || s.name, s.id === subject, () => { subject = subject === s.id ? '' : s.id; drawSub(); }))) : '');
  async function loadSub() { subjects = []; drawSub(); if (!level) return; const r = await loadSubjects(level); if (r.kind === 'ok') { subjects = r.data; drawSub(); } }
  drawLv(); loadSub();
  const sheet = openSheet({ title: 'নতুন পরীক্ষা', content: h('div', { class: 'sheet-col' }, lvBox, subBox, title.el, full.el, date.el, go) });
  go.addEventListener('click', async () => {
    const v = validateExam({ title: title.input.value, class_level: level, full_marks: full.input.value, exam_date: date.input.value, subject_id: subject }, today());
    title.error(v.errors.title || ''); full.error(v.errors.full_marks || ''); date.error(v.errors.exam_date || '');
    if (v.errors.class_level) return toast(v.errors.class_level);
    if (!v.ok) return;
    go.disabled = true; go.textContent = 'একটু অপেক্ষা…';
    const r = await createExam(v.value);
    go.disabled = false; go.textContent = 'পরীক্ষা তৈরি করুন';
    if (r.state === 'failed' || r.state === 'rejected') return saveBar.show(r.state, { onRetry: () => go.click() });
    sheet.close(); saveBar.show(r.state, { text: r.state === 'saved' ? 'পরীক্ষা তৈরি হয়েছে' : undefined });
    onDone(r.state === 'saved' ? r.id : null);
  });
}

// ---- marks for one exam ----
export function marksEntryPage(ctx, id) {
  const uid = session.uid();
  return dataPage({
    key: 'marks.exam.' + id,
    load: () => loadExam(id),
    isEmpty: d => !d.roster.length,
    empty: () => stateCard({ kind: 'empty', title: 'এই ক্লাসে কোনো শিক্ষার্থী নেই', text: 'অফিসে জানান।' }),
    draw: (d, reload) => {
      const { exam, roster } = d, full = Number(exam.full_marks), ids = roster.map(s => s.id);
      const saved = Object.fromEntries(Object.entries(d.saved)), entered = {}, inputs = {}, errs = {};
      const sumBox = h('div', { class: 'tc-count' });
      const save = h('button', { class: 'de-btn de-btn--primary', type: 'button', text: 'নম্বর সংরক্ষণ করুন' });
      const paintSum = () => {
        const s = marksSummary({ ids, entered, saved, full });
        sumBox.replaceChildren(h('span', { class: 'de-chip ' + (s.left ? 'de-chip--warn' : 'de-chip--good'), text: s.left ? `${bn(s.left)} জনের বাকি` : 'সবার নম্বর আছে' }),
          h('span', { class: 'de-chip', text: `নম্বর দেওয়া ${bn(s.done)}/${bn(s.total)}` }), s.avg != null ? h('span', { class: 'de-chip', text: `গড় ${num(s.avg)}` }) : null, s.top != null ? h('span', { class: 'de-chip', text: `সর্বোচ্চ ${num(s.top)}` }) : null);
        const n = Object.keys(entered).filter(k => entered[k] !== (saved[k]?.obtained == null ? '' : String(saved[k].obtained))).length;
        save.disabled = !n; save.textContent = n ? `${bn(n)} জনের নম্বর সংরক্ষণ করুন` : 'নম্বর সংরক্ষণ করুন';
      };
      const row = (s, i) => {
        const was = saved[s.id]?.obtained;
        const input = h('input', { class: 'de-field__input tc-mark', type: 'text', inputmode: 'decimal', enterkeyhint: i === roster.length - 1 ? 'done' : 'next', autocomplete: 'off', value: was == null ? '' : String(was),
          'aria-label': `${s.name}, রোল ${bn(s.roll || '—')}, নম্বর (পূর্ণমান ${num(full)})`, 'aria-describedby': 'm-err-' + s.id });
        const err = h('span', { class: 'tc-err', id: 'm-err-' + s.id, role: 'status' });
        inputs[s.id] = { input, err };
        input.addEventListener('input', () => {
          entered[s.id] = input.value;
          const p = parseMark(input.value, full);
          err.textContent = p.ok ? '' : p.error; input.setAttribute('aria-invalid', p.ok ? 'false' : 'true'); delete errs[s.id];
          paintSum();
        });
        input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); (inputs[ids[i + 1]]?.input || save).focus(); } });
        return h('li', { class: 'tc-markrow' }, avatar(s.name),
          h('span', { class: 'tc-att__name' }, h('b', { text: s.name }), h('span', { text: `রোল ${bn(s.roll || '—')}` }), err),
          h('span', { class: 'tc-markbox' }, input, h('span', { class: 'tc-cap', text: '/ ' + num(full) })));
      };
      save.addEventListener('click', async () => {
        const diff = marksDiff({ ids, entered, saved, full });
        for (const k of ids) if (inputs[k]) { const m = diff.errors[k]; inputs[k].err.textContent = m || inputs[k].err.textContent; }
        if (Object.keys(diff.errors).length) { toast('লাল চিহ্ন দেওয়া নম্বরগুলো ঠিক করুন'); inputs[Object.keys(diff.errors)[0]].input.focus(); return; }
        if (!diff.rows.length) return;
        const changed = diff.rows.filter(r => r.changed).length;
        if (changed && !await confirmBox({ title: 'সংরক্ষিত নম্বর বদলাবে', text: `${bn(changed)} জনের আগের নম্বর বদলে যাবে। রিপোর্ট কার্ডে নতুন নম্বর যাবে। বদলাবেন?`, ok: 'হ্যাঁ, বদলান' })) return;
        save.disabled = true; save.textContent = 'একটু অপেক্ষা…';
        const state = await saveMarks({ exam_id: exam.id, rows: diff.rows });
        if (state === 'failed' || state === 'rejected') { paintSum(); return saveBar.show(state, { onRetry: () => save.click() }); }
        for (const r of diff.rows) { saved[r.id] = { obtained: r.value }; entered[r.id] = String(r.value); }
        paintSum();
        saveBar.show(state, { text: state === 'saved' ? `${bn(diff.rows.length)} জনের নম্বর জমা হয়েছে` : undefined });
      });
      paintSum();
      return [
        h('section', { class: 'de-card tc-card' }, h('h2', { class: 'tc-h', text: `${exam.subject_name ? exam.subject_name + ' · ' : ''}${exam.title}` }),
          h('p', { class: 'tc-sub', text: `ক্লাস ${bn(exam.class_level)} · ${exam.exam_date ? shortDate(exam.exam_date + 'T00:00:00+06:00') : ''} · পূর্ণমান ${num(full)}` }), sumBox,
          h('p', { class: 'tc-cap', text: 'যে লেখা নেই সেটা ফাঁকা থাকবে। অনুপস্থিত হলে ০ লিখুন, নইলে রিপোর্ট কার্ড আটকে থাকবে।' })),
        h('div', { class: 'de-card' }, h('ul', { class: 'tc-list' }, ...roster.map(row))),
        h('div', { class: 'tc-sticky' }, save),
      ];
    },
  });
}

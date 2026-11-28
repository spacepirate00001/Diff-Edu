import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from './paper-logic.js';

const bank = [];
for (let i = 0; i < 30; i++) bank.push({ id: 'q' + i, qtype: i < 24 ? 'mcq' : 'short', body: 'প্রশ্ন ' + i, options: i < 24 ? ['ক১', 'খ১', 'গ১', 'ঘ১'] : [], answer: i < 24 ? 'খ১' : '', chapter_name: 'অধ্যায় ' + (i % 3), difficulty: ['easy', 'medium', 'hard'][i % 3], visibility: i % 5 ? 'practice' : 'reserved' });
const seq = a => () => a.shift() ?? 0.5;

test('pickable filters', () => {
  assert.equal(P.pickable(bank, { qtype: 'short' }).length, 6);
  assert.equal(P.pickable(bank, { chapters: new Set(['অধ্যায় 1']) }).length, 10);
  assert.equal(P.pickable(bank, { only: 'reserved' }).length, 6);
  assert.equal(P.pickable(bank, { exclude: new Set(['q0', 'q1']) }).length, 28);
  assert.equal(P.pickable(bank, { q: 'প্রশ্ন 29' }).length, 1);
});
test('autoPick: n unique, spread over chapters, mix honoured', () => {
  const r = P.autoPick(bank, 9);
  assert.equal(r.length, 9); assert.equal(new Set(r.map(x => x.id)).size, 9);
  for (const c of ['অধ্যায় 0', 'অধ্যায় 1', 'অধ্যায় 2']) assert.equal(r.filter(x => x.chapter_name === c).length, 3);
  const m = P.autoPick(bank, 6, { mix: { easy: 2, medium: 2, hard: 2 } });
  for (const d of ['easy', 'medium', 'hard']) assert.equal(m.filter(x => x.difficulty === d).length, 2);
  assert.equal(P.autoPick(bank, 99).length, 30);
  assert.equal(P.autoPick(bank, 0).length, 0);
});
test('add, move, totals, sections', () => {
  let items = P.addItems([], bank.slice(0, 3).concat(bank.slice(24, 26)));
  assert.equal(items.length, 5);
  assert.equal(P.addItems(items, bank.slice(0, 3)).length, 5, 'no duplicates');
  assert.equal(P.totals(items).marks, 3 * 1 + 2 * 2);
  items = P.moveItem(items, 0, 2); assert.equal(items[2].bank_id, 'q0');
  const s = P.sections(items); assert.deepEqual(s.map(x => x.qtype), ['mcq', 'short']); assert.equal(s[1].rows[1].no, 2);
  assert.match(P.totalsLine(items), /৫টা প্রশ্ন · পূর্ণমান ৭/);
});
test('editItem keeps answer inside options', () => {
  const it = P.itemFromBank(bank[0]);
  assert.equal(P.editItem(it, { body: 'x', options: ['a', 'b'], answer: 'c', marks: 1 }).ok, false);
  const ok = P.editItem(it, { body: 'নতুন', options: ['a', 'b'], answer: 'b', marks: '২' });
  assert.ok(ok.ok); assert.equal(ok.item.marks, 2); assert.equal(ok.item.edited, true); assert.equal(P.answerLetter(ok.item), 'খ');
});
test('validatePaper', () => {
  const p = P.newPaper({ title: 'T', class_level: 6, subject: 'গণিত', items: [P.itemFromBank(bank[0])] });
  assert.ok(P.validatePaper(p).ok);
  assert.equal(P.validatePaper({ ...p, items: [] }).errors.items.length > 0, true);
  assert.equal(P.validatePaper({ ...p, title: ' ' }).ok, false);
  assert.equal(P.validatePaper({ ...p, items: [{ ...p.items[0], answer: 'zzz' }] }).ok, false);
});
test('online plan: only sound MCQs, right answers, draft first', () => {
  const p = P.newPaper({ title: 'T', class_level: 6, subject: 'গণিত', items: P.addItems([], [bank[0], bank[24], bank[1]]) });
  const plan = P.onlinePlan(p, { coaching_id: 'c', uid: 'u', kind: 'practice', minutes: 20 });
  assert.equal(plan.questions.length, 2); assert.equal(plan.options.length, 8);
  assert.equal(plan.options.filter(o => o.is_correct).length, 2);
  assert.equal(plan.exam.status, 'draft'); assert.equal(plan.exam.class_level, 6); assert.equal(plan.exam.paper_id, p.id);
  assert.equal(P.onlineSummary(p).off, 1);
});
test('validateRun', () => {
  const now = Date.parse('2026-11-28T00:00:00Z');
  assert.ok(P.validateRun({ kind: 'practice', minutes: '20' }, now).ok);
  assert.equal(P.validateRun({ kind: 'live', minutes: '20', start: '2026-11-27T10:00' }, now).errors.start.length > 0, true);
  const r = P.validateRun({ kind: 'live', minutes: '20', start: '2026-11-29T10:00' }, now);
  assert.ok(r.ok); assert.equal(r.value.starts_at, '2026-11-29T04:00:00.000Z'); assert.equal(r.value.ends_at, '2026-11-29T04:50:00.000Z');
});
test('row round trip + copy + printJob', () => {
  const p = P.newPaper({ title: 'T', class_level: 6, subject: 'গণিত', header: { institute: ' ডিফ এডু ', minutes: '৪৫' }, items: P.addItems([], [bank[0], bank[24]]) });
  const row = P.paperRow(p, { coaching_id: 'c', uid: 'u' });
  assert.equal(row.header.minutes, '45'); assert.equal(row.header.institute, 'ডিফ এডু');
  const back = P.paperFromRow({ ...row }); assert.equal(back.items.length, 2);
  assert.notEqual(P.copyPaper(back).id, back.id);
  const j = P.printJob(back, { withAnswers: true }); assert.equal(j.sections[0].rows[0].letter, 'খ'); assert.equal(j.total, 3);
});

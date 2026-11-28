import test from 'node:test';
import assert from 'node:assert/strict';
import { setTransport } from '../../core/http.js';
import * as D from './paper-data.js';
import * as P from './paper-logic.js';

const calls = [];
const run = (fn) => { setTransport(async (method, path, { body }) => { calls.push({ method, path, body }); return fn(method, path, body); }); calls.length = 0; };
const paper = P.newPaper({ title: 'T', class_level: 6, subject: 'গণিত', items: P.addItems([], [
  { id: 'a', qtype: 'mcq', body: 'এক', options: ['১', '২'], answer: '২' }, { id: 'b', qtype: 'short', body: 'দুই', options: [], answer: '' }, { id: 'c', qtype: 'mcq', body: 'তিন', options: ['x', 'y', 'z'], answer: 'x' }]) });
const rv = { kind: 'practice', minutes: 20, starts_at: null, ends_at: null };

test('publishOnline: exam draft, questions, options, then published', async () => {
  run(() => ({ status: 201, data: null }));
  const r = await D.publishOnline(paper, rv);
  assert.equal(r.state, 'ok');
  assert.deepEqual(calls.map(c => c.method + ' ' + c.path.split('?')[0].replace('/rest/v1/', '')), ['POST online_exams', 'POST exam_questions', 'POST exam_options', 'PATCH online_exams']);
  assert.equal(calls[0].body.status, 'draft'); assert.equal(calls[3].body.status, 'published');
  assert.equal(calls[1].body.length, 2); assert.equal(calls[2].body.length, 5);
});
test('publishOnline: a failed step deletes the exam', async () => {
  run((m, path) => (path.includes('exam_options') ? { status: 500, data: null } : { status: 201, data: null }));
  const r = await D.publishOnline(paper, rv);
  assert.deepEqual([r.state, r.why], ['failed', 'options']);
  assert.equal(calls.at(-1).method, 'DELETE');
});
test('publishOnline: offline and empty', async () => {
  run(() => ({ status: 0, data: null }));
  assert.equal((await D.publishOnline(paper, rv)).state, 'offline');
  run(() => ({ status: 201, data: null }));
  assert.equal((await D.publishOnline({ ...paper, items: [paper.items[1]] }, rv)).state, 'empty');
  assert.equal(calls.length, 0);
});
test('savePaper: new posts, conflict falls back to patch', async () => {
  run(() => ({ status: 201, data: null }));
  assert.equal(await D.savePaper(paper, { isNew: true }), 'saved');
  run(m => (m === 'POST' ? { status: 409, data: null } : { status: 204, data: null }));
  assert.equal(await D.savePaper(paper, { isNew: true }), 'saved');
  assert.deepEqual(calls.map(c => c.method), ['POST', 'PATCH']);
  run(() => ({ status: 0, data: null }));
  assert.equal(await D.savePaper(paper), 'offline');
});
test('loadBankFull pages until a short page; loadPaper missing', async () => {
  run((m, path) => ({ status: 200, data: path.includes('offset=0') ? Array.from({ length: 1000 }, (_, i) => ({ id: i })) : [{ id: 'x' }] }));
  const r = await D.loadBankFull(6);
  assert.equal(r.data.length, 1001); assert.equal(calls.length, 2);
  run(() => ({ status: 200, data: [] }));
  assert.equal((await D.loadPaper('zz')).kind, 'missing');
});

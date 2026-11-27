// "প্রশ্ন জমা": a page of the book (PDF or photo) or pasted text goes up, the AI reads it and makes questions, and they wait in "প্রশ্ন অনুমোদন".
// Needs the net (a file cannot wait in the outbox). One file = one part here; a bigger file asks the teacher to cut it. The AI worker is poked one job at a time while this page is open.
import { h } from '../../ui/dom.js';
import { chip, chipRow } from '../../ui/chip.js';
import { field } from '../../ui/field.js';
import { toast } from '../../ui/toast.js';
import { saveBar } from '../../ui/savebar.js';
import { dataPage } from '../../ui/datapage.js';
import { stateCard } from '../../ui/states.js';
import { icon } from '../../ui/icons.js';
import { bn, agoText } from '../../core/bn.js';
import { LEVELS, KIND_BN, SOURCE_STATUS, sourceBusy, validateUpload, kindOfFile } from './logic.js';
import { loadSubjects, loadSources, submitSource, pokeWorker, retryFailed, myLevels } from './data.js';

export function uploadPage(ctx) {
  const root = h('div', { class: 'tc-page' });
  let mode = 'file', level = null, subject = '', subjects = [], file = null, ack = false, busy = false, dead = false, polls = 0, list = null;
  const title = field({ label: 'নাম', maxlength: 200, help: 'যেমন: ৬ষ্ঠ শ্রেণি গণিত, অধ্যায় ৩' });
  const text = field({ label: 'লেখা', multiline: true, rows: 8, help: 'বই বা প্রশ্নপত্রের লেখা এখানে পেস্ট করুন' });
  const fileIn = h('input', { class: 'tc-file', type: 'file', accept: '.pdf,application/pdf,image/*,.txt,.md,text/plain', 'aria-label': 'ফাইল বাছুন' });
  const fileInfo = h('p', { class: 'tc-cap', 'aria-live': 'polite' }), fileErr = h('p', { class: 'tc-err', role: 'status' });
  const ackBox = h('input', { type: 'checkbox', id: 'ack', onchange: e => { ack = e.target.checked; } });
  const ackErr = h('p', { class: 'tc-err', role: 'status' });
  const go = h('button', { class: 'de-btn de-btn--primary', type: 'button', text: 'জমা দিন' });
  const modeBox = h('div'), lvBox = h('div'), subBox = h('div'), fileBox = h('div', { class: 'tc-card' }, fileIn, fileInfo, fileErr);
  const drawMode = () => { modeBox.replaceChildren(chipRow('কীভাবে দেবেন', [chip('PDF বা ছবি', mode === 'file', () => { mode = 'file'; drawMode(); }), chip('লেখা পেস্ট', mode === 'text', () => { mode = 'text'; drawMode(); })])); fileBox.hidden = mode !== 'file'; text.el.hidden = mode !== 'text'; };
  const drawLv = (levels) => lvBox.replaceChildren(chipRow('কোন ক্লাস', (levels || LEVELS).map(l => chip('ক্লাস ' + bn(l), l === level, () => { level = l; subject = ''; drawLv(levels); loadSub(); }))));
  const drawSub = () => subBox.replaceChildren(subjects.length ? chipRow('বিষয় (ঐচ্ছিক)', subjects.map(s => chip(s.name_bn || s.name, s.id === subject, () => { subject = subject === s.id ? '' : s.id; drawSub(); }))) : '');
  async function loadSub() { subjects = []; drawSub(); if (!level) return; const r = await loadSubjects(level); if (r.kind === 'ok' && !dead) { subjects = r.data; drawSub(); } }
  fileIn.addEventListener('change', () => {
    file = fileIn.files?.[0] || null; fileErr.textContent = '';
    fileInfo.textContent = file ? `${KIND_BN[kindOfFile(file)] || 'ফাইল'} · ${bn((file.size / 1048576).toFixed(1))} MB` : '';
    if (file && !title.input.value) title.input.value = file.name.replace(/\.[^.]+$/, '').slice(0, 200);
  });
  myLevels().then(r => { if (dead) return; const lv = r.kind === 'ok' ? r.data : null; if (lv?.length === 1) level = lv[0]; drawLv(lv); loadSub(); });
  drawMode();

  go.addEventListener('click', async () => {
    if (busy) return;
    const kind = mode === 'text' ? 'text' : kindOfFile(file) || 'pdf';
    const v = validateUpload({ kind, class_level: level, title: title.input.value, text: text.input.value, file, ack });
    title.error(v.errors.title || ''); text.error(v.errors.text || ''); fileErr.textContent = v.errors.file || ''; ackErr.textContent = v.errors.ack || '';
    if (v.errors.class_level) toast(v.errors.class_level);
    if (!v.ok) return;
    busy = true; go.disabled = true; go.textContent = 'জমা হচ্ছে…';
    const r = await submitSource({ kind, title: title.input.value, class_level: level, subject_id: subject, text: text.input.value, file }, (n, t) => { go.textContent = `জমা হচ্ছে… ${bn(n)}/${bn(t)}`; });
    busy = false; go.disabled = false; go.textContent = 'জমা দিন';
    if (r.state === 'duplicate') return toast('এই ফাইল বা লেখা আগেই দেওয়া হয়েছে। নিচের তালিকা দেখুন।');
    if (r.state === 'offline') return saveBar.show('failed', { text: 'নেট নেই। ফাইল যায়নি, নেট এলে আবার দিন।', onRetry: () => go.click() });
    if (r.state !== 'ok') return saveBar.show('failed', { text: 'জমা হয়নি। আবার চেষ্টা করুন।', onRetry: () => go.click() });
    saveBar.show('saved', { text: 'জমা হয়েছে। AI প্রশ্ন বানাচ্ছে।' });
    title.input.value = ''; text.input.value = ''; fileIn.value = ''; file = null; fileInfo.textContent = ''; ackBox.checked = false; ack = false;
    polls = 0; list?.reload(); work();
  });

  // The worker does one job per call: keep poking while something is waiting and the page is open (at most ~40 calls, then the teacher can tap "আবার").
  async function work() {
    if (dead) return;
    const r = await pokeWorker();
    if (dead) return;
    list?.reload();
    if (r.state === 'processed' && ++polls < 40) setTimeout(work, 600);
    else if (r.state === 'idle' && r.waiting && ++polls < 40) setTimeout(work, 8000);
  }
  const statusChip = s => h('span', { class: 'de-chip ' + (s.status === 'done' ? 'de-chip--good' : s.status === 'failed' || s.status === 'partial' ? 'de-chip--bad' : 'de-chip--warn'), text: SOURCE_STATUS[s.status] || s.status });
  list = dataPage({
    key: null, load: () => loadSources(), isEmpty: d => !d.length,
    empty: () => h('p', { class: 'tc-sub', text: 'এখনো কিছু জমা দেওয়া হয়নি।' }),
    draw: (d, reload) => {
      if (d.some(s => sourceBusy(s.status)) && polls === 0) { polls = 1; work(); }
      return [h('h2', { class: 'tc-h', text: 'আপনাদের জমা দেওয়া উৎস' }), h('div', { class: 'de-card' }, h('ul', { class: 'tc-list' }, ...d.map(s => h('li', { class: 'tc-rule' },
        h('div', { class: 'tc-row' }, h('div', { class: 'tc-grow' }, h('b', { text: s.title }), h('p', { class: 'tc-cap', text: `${KIND_BN[s.kind] || s.kind} · ক্লাস ${bn(s.class_level || '—')}${s.subject_name ? ' · ' + s.subject_name : ''} · ${agoText(s.created_at)}` })), statusChip(s)),
        s.pending || s.approved ? h('p', { class: 'tc-sub', text: `${bn(s.pending)}টা প্রশ্ন অনুমোদনের অপেক্ষায়, ${bn(s.approved)}টা ব্যাংকে গেছে` }) : null,
        h('div', { class: 'tc-wrap' },
          s.pending ? h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: () => ctx.go('/more/approve/' + s.id), text: `প্রশ্ন দেখুন (${bn(s.pending)})` }) : null,
          s.jobsFailed ? h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: async () => { const x = await retryFailed(s.id); toast(x === 'ok' ? 'আবার চেষ্টা শুরু হয়েছে' : 'এখন হলো না'); polls = 0; reload(); work(); }, text: `${bn(s.jobsFailed)}টা অংশ আবার চেষ্টা` }) : null))))),
        d.some(s => sourceBusy(s.status)) ? h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: () => { polls = 0; work(); }, text: 'AI-কে আবার ডাকুন' }) : null];
    },
  });
  root.append(h('section', { class: 'de-card tc-card' }, h('h2', { class: 'tc-h', text: 'বইয়ের পাতা থেকে প্রশ্ন' }),
    h('p', { class: 'tc-sub', text: 'পাতার PDF, ছবি বা লেখা দিন। AI প্রশ্ন বের করবে। আপনি দেখে "হ্যাঁ" না বললে কোনো প্রশ্ন শিক্ষার্থীর কাছে যাবে না।' }),
    modeBox, lvBox, subBox, title.el, fileBox, text.el,
    h('label', { class: 'tc-ack', for: 'ack' }, ackBox, h('span', { text: 'এই উৎসে কোনো শিক্ষার্থীর নাম, ছবি বা ব্যক্তিগত তথ্য নেই।' })), ackErr, go), list.node);
  fileBox.append(h('p', { class: 'tc-cap', text: 'একটা PDF বা ছবি, সর্বোচ্চ ১২ MB। বড় হলে কয়েক পাতা করে আলাদা দিন।' }));
  text.el.hidden = true;
  return { node: root, destroy() { dead = true; list?.destroy(); } };
}

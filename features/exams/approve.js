// "প্রশ্ন অনুমোদন": the AI's questions wait here. Nothing reaches a student until the teacher says yes (one by one, or the safe ones together).
// Approve and reject are server calls (approve_source_items / reject_source_items), so they need the net and they say what the server skipped.
import { h } from '../../ui/dom.js';
import { chip, chipRow } from '../../ui/chip.js';
import { field } from '../../ui/field.js';
import { openSheet } from '../../ui/sheet.js';
import { confirmBox } from '../../ui/dialog.js';
import { toast } from '../../ui/toast.js';
import { dataPage } from '../../ui/datapage.js';
import { stateCard } from '../../ui/states.js';
import { bn, agoText } from '../../core/bn.js';
import { QT, LAB, mcqBad, needsLook, isSafe, splitItems, suggestOf, approveCall, rejectCall, approveResult, editPatch, sourceCards, KIND_BN } from './logic.js';
import { loadSources, loadItems, loadChapters, callApprove, patchItem } from './data.js';

// ---- the waiting sources ----
export function approveListPage(ctx) {
  return dataPage({
    key: 'approve.list', load: loadSources, isEmpty: d => !d.some(s => s.pending),
    empty: () => stateCard({ kind: 'empty', title: 'অনুমোদনের জন্য কোনো প্রশ্ন নেই', text: 'বইয়ের পাতা জমা দিলে AI প্রশ্ন বানিয়ে এখানে রাখবে।', action: 'প্রশ্ন জমা দিন', onAction: () => ctx.go('/more/upload') }),
    draw: d => [h('div', { class: 'de-card' }, h('ul', { class: 'tc-list' }, ...sourceCards(d).filter(s => s.pending).map(s => h('li', {}, h('button', { class: 'de-row more-row', type: 'button', onclick: () => ctx.go('/more/approve/' + s.id) },
      h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: s.title }), h('span', { class: 'de-row__sub', text: `${KIND_BN[s.kind] || s.kind} · ক্লাস ${bn(s.class_level || '—')}${s.subject_name ? ' · ' + s.subject_name : ''} · ${agoText(s.created_at)}` })),
      h('span', { class: 'de-chip de-chip--warn', text: bn(s.pending) }))))))],
  });
}

// ---- one source ----
export function approveSourcePage(ctx, sourceId) {
  let filter = 'all', visibility = 'practice', chapterId = '', subjectText = '';
  return dataPage({
    key: null,
    load: async () => { const r = await loadItems(sourceId); if (r.kind !== 'ok') return r; const c = r.data.source.class_level ? await loadChapters(r.data.source.class_level) : { kind: 'ok', data: [] }; return { kind: 'ok', data: { ...r.data, chapters: c.kind === 'ok' ? c.data : [] } }; },
    isEmpty: d => !d.items.length,
    empty: () => stateCard({ kind: 'empty', title: 'সব প্রশ্ন দেখা হয়ে গেছে', text: 'অনুমোদন করা প্রশ্ন "প্রশ্ন ব্যাংক"-এ আছে।', action: 'প্রশ্ন ব্যাংক', onAction: () => ctx.go('/more/qbank') }),
    draw: (d, reload) => {
      const { source, chapters } = d;
      let items = d.items.slice();
      const { safe, look } = splitItems(items);
      const needSubject = !source.subject_name;
      const opts = () => ({ visibility, chapter_id: chapterId || null, subject: needSubject ? subjectText.trim() || null : null });
      const guard = () => { if (needSubject && !subjectText.trim()) { toast('আগে বিষয় লিখুন'); return false; } return true; };
      const listBox = h('div', { class: 'tc-page' }), head = h('div', { class: 'tc-page' });
      const run = async (call, ids, ok) => {
        const r = await callApprove(call);
        if (r.state === 'offline') return toast('নেট নেই। নেট এলে আবার চেষ্টা করুন।');
        if (r.state !== 'ok') return toast('হয়নি, আবার চেষ্টা করুন');
        if (call.name === 'approve_source_items') { const a = approveResult(r.result); toast(a.text, { ms: 5000 }); if (!a.n) return; }
        items = items.filter(x => !ids.includes(x.id) || (call.name === 'approve_source_items' && (r.result?.skipped || []).some(s => s.id === x.id)));
        if (!items.length) return reload();
        paint(); ok?.();
      };
      const approveOne = it => { if (guard()) run(approveCall([it.id], opts()), [it.id]); };
      const card = it => {
        const sug = suggestOf(it), ans = String(it.answer ?? ''), bad = mcqBad(it);
        const flags = [it.needs_figure ? 'চিত্র লাগবে' : null, it.has_table ? 'ছক আছে' : null, it.qtype === 'math' || it.qtype === 'other' ? 'ধরন দেখে নিন' : null, bad && it.qtype === 'mcq' ? (ans ? 'উত্তর অপশনের সাথে মেলে না' : 'উত্তর নেই') : null].filter(Boolean);
        return h('li', { class: 'tc-q-card' },
          h('div', { class: 'tc-wrap' }, h('span', { class: 'de-chip', text: QT[it.qtype] || it.qtype }), it.marks != null ? h('span', { class: 'de-chip', text: `মান ${bn(it.marks)}` }) : null, ...flags.map(f => h('span', { class: 'de-chip de-chip--warn', text: f }))),
          it.review_note ? h('p', { class: 'tc-line is-warn', text: sug ? `AI-র পরামর্শ: ${sug.text}। পাতার সাথে মিলিয়ে নিন।` : it.review_note }) : null,
          h('p', { class: 'tc-q', text: it.body }),
          (it.options || []).length ? h('ol', { class: 'tc-opts' }, ...it.options.map((o, i) => h('li', { class: String(o) === ans ? 'is-ans' : sug?.idx === i ? 'is-sug' : '' }, h('span', { class: 'tc-lab', text: LAB[i] || bn(i + 1) }), h('span', { text: String(o) + (String(o) === ans ? ' ✓' : '') })))) : (ans ? h('p', { class: 'tc-cap', text: 'উত্তর: ' + ans }) : null),
          it.source_ref ? h('p', { class: 'tc-cap', text: it.source_ref }) : null,
          h('div', { class: 'tc-wrap' },
            sug ? h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: `AI-র উত্তর নিন (${sug.letter})`, onclick: async () => { const x = await patchItem(it.id, { answer: sug.text }); if (x === 'ok') { it.answer = sug.text; paint(); } else toast('হয়নি'); } }) : null,
            h('button', { class: 'de-btn de-btn--primary', type: 'button', text: 'অনুমোদন', disabled: bad || undefined, onclick: () => approveOne(it) }),
            h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: 'সম্পাদনা', onclick: () => editSheet(it, () => paint()) }),
            h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: 'বাতিল', onclick: () => run(rejectCall([it.id]), [it.id]) })));
      };
      function paint() {
        const s = splitItems(items);
        const shown = filter === 'look' ? s.look : filter === 'safe' ? s.safe : items;
        head.replaceChildren(chipRow('কোন প্রশ্ন', [chip(`সব (${bn(items.length)})`, filter === 'all', () => { filter = 'all'; paint(); }), chip(`দেখা দরকার (${bn(s.look.length)})`, filter === 'look', () => { filter = 'look'; paint(); }), chip(`নিরাপদ (${bn(s.safe.length)})`, filter === 'safe', () => { filter = 'safe'; paint(); })]),
          s.safe.length ? h('button', { class: 'de-btn de-btn--primary', type: 'button', text: `নিরাপদ ${bn(s.safe.length)}টা একসাথে অনুমোদন`, onclick: async () => { if (!guard()) return; if (await confirmBox({ title: 'একসাথে অনুমোদন', text: `${bn(s.safe.length)}টা প্রশ্ন ব্যাংকে যাবে। এগুলোতে কোনো সন্দেহের চিহ্ন নেই। আপনি কি দেখে নিয়েছেন?`, ok: 'হ্যাঁ, অনুমোদন' })) run(approveCall(s.safe.map(x => x.id), opts()), s.safe.map(x => x.id)); } }) : null);
        listBox.replaceChildren(shown.length ? h('ul', { class: 'tc-qlist' }, ...shown.map(card)) : h('p', { class: 'tc-sub', text: 'এই ভাগে কোনো প্রশ্ন নেই।' }));
      }
      const chSel = h('select', { class: 'de-field__input', 'aria-label': 'অধ্যায়', onchange: e => { chapterId = e.target.value; } }, h('option', { value: '', text: 'অধ্যায় ঠিক করা হবে না' }),
        ...chapters.filter(c => !source.subject_name || c.subject === source.subject_name || c.subject === (source.subject?.name || '')).map(c => h('option', { value: c.id, text: `${c.subject} · ${bn(c.number)}. ${c.title}`, selected: c.id === chapterId ? true : null })));
      const subj = needSubject ? field({ label: 'বিষয় (এই উৎসে বিষয় নেই)', maxlength: 60, oninput: e => { subjectText = e.target.value; } }) : null;
      paint();
      return [h('section', { class: 'de-card tc-card' }, h('h2', { class: 'tc-h', text: source.title }), h('p', { class: 'tc-sub', text: `${KIND_BN[source.kind] || ''} · ক্লাস ${bn(source.class_level || '—')}${source.subject_name ? ' · ' + source.subject_name : ''}` }),
        chipRow('কারা পাবে', [chip('ছাত্ররাও অনুশীলনে পাবে', visibility === 'practice', () => { visibility = 'practice'; reload(); }), chip('শুধু শিক্ষকরা', visibility === 'reserved', () => { visibility = 'reserved'; reload(); })]),
        subj?.el, chapters.length ? chSel : null, h('p', { class: 'tc-cap', text: 'অধ্যায় আর কারা পাবে, এই একই পছন্দ সব অনুমোদনে লাগবে।' })), head, listBox];
    },
  });
}

// ---- edit one question ----
function editSheet(it, done) {
  const body = field({ label: 'প্রশ্ন', multiline: true, rows: 4, value: it.body, maxlength: 4000 });
  const optBox = it.qtype === 'mcq' ? field({ label: 'অপশন (প্রতি লাইনে একটা)', multiline: true, rows: 5, value: (it.options || []).join('\n') }) : null;
  const ansBox = h('div'), go = h('button', { class: 'de-btn de-btn--primary', type: 'button', text: 'সংরক্ষণ' }), err = h('p', { class: 'tc-err', role: 'status' });
  let answer = String(it.answer ?? '');
  const optList = () => (optBox ? optBox.input.value.split('\n').map(x => x.trim()).filter(Boolean) : []);
  const drawAns = () => { if (!optBox) return; const o = optList(); if (!o.includes(answer)) answer = ''; ansBox.replaceChildren(chipRow('সঠিক উত্তর', o.map((x, i) => chip(`${LAB[i] || bn(i + 1)}. ${x}`, x === answer, () => { answer = x; drawAns(); })))); };
  optBox?.input.addEventListener('input', drawAns); drawAns();
  const sheet = openSheet({ title: 'প্রশ্ন সম্পাদনা', content: h('div', { class: 'sheet-col' }, body.el, optBox?.el, ansBox, err, go) });
  go.addEventListener('click', async () => {
    const r = editPatch(it, { body: body.input.value, options: optList(), answer });
    if (!r.ok) { err.textContent = r.error; return; }
    if (!Object.keys(r.patch).length) return sheet.close();
    go.disabled = true; const x = await patchItem(it.id, r.patch); go.disabled = false;
    if (x !== 'ok') { err.textContent = x === 'offline' ? 'নেট নেই' : 'হয়নি, আবার চেষ্টা করুন'; return; }
    Object.assign(it, r.patch); sheet.close(); done();
  });
}

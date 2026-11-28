// "প্রশ্ন ব্যাংক": every approved question, by class and subject. Read, filter by type or chapter, search, and take a wrong one out.
import { h } from '../../ui/dom.js';
import { chip, chipRow } from '../../ui/chip.js';
import { confirmBox } from '../../ui/dialog.js';
import { toast } from '../../ui/toast.js';
import { field } from '../../ui/field.js';
import { openSheet } from '../../ui/sheet.js';
import { dataPage } from '../../ui/datapage.js';
import { stateCard } from '../../ui/states.js';
import { request } from '../../core/api.js';
import { bn } from '../../core/bn.js';
import { QT, LAB, bankTree, bankFilter, chaptersOf } from './logic.js';
import { loadBankCounts, loadBank } from './data.js';

export function qbankPage(ctx, query = {}) {
  let level = Number(query.level) || null, subject = query.subject || null;
  const root = h('div', { class: 'tc-page' });
  let inner = null;
  const show = () => {
    inner?.destroy();
    inner = level && subject ? questions() : overview();
    root.replaceChildren(inner.node);
  };
  function overview() {
    return dataPage({
      key: 'qbank.counts', load: loadBankCounts, isEmpty: d => !d.length,
      empty: () => stateCard({ kind: 'empty', title: 'ব্যাংকে এখনো কোনো প্রশ্ন নেই', text: 'বইয়ের পাতা জমা দিয়ে প্রশ্ন অনুমোদন করলে এখানে জমা হবে।', action: 'প্রশ্ন জমা দিন', onAction: () => ctx.go('/more/upload') }),
      draw: d => { const t = bankTree(d); return [h('p', { class: 'tc-sub', text: `মোট ${bn(d.length)}টা প্রশ্ন` }), h('div', { class: 'de-card' }, h('ul', { class: 'tc-list' }, ...t.map(x => h('li', {}, h('button', { class: 'de-row more-row', type: 'button', onclick: () => { level = x.class_level; subject = x.subject; show(); } },
        h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: `ক্লাস ${bn(x.class_level)} · ${x.subject}` }), h('span', { class: 'de-row__sub', text: `বহুনির্বাচনী ${bn(x.mcq)} · সংক্ষিপ্ত ${bn(x.short)} · সৃজনশীল ${bn(x.creative)}` })), h('span', { class: 'de-chip', text: bn(x.n) }))))))]; },
    });
  }
  function questions() {
    let qtype = null, chapter = null, q = '';
    return dataPage({
      key: `qbank.${level}`, load: () => loadBank(level), isEmpty: d => !d.some(x => x.subject === subject),
      empty: () => stateCard({ kind: 'empty', title: 'এই বিষয়ে কোনো প্রশ্ন নেই', action: 'পিছনে', onAction: () => { level = subject = null; show(); } }),
      draw: (all, reload) => {
        const rows = all.filter(x => x.subject === subject), box = h('div', { class: 'tc-page' }), chips = h('div');
        const search = h('input', { class: 'de-field__input', type: 'search', placeholder: 'প্রশ্নে খুঁজুন', 'aria-label': 'প্রশ্নে খুঁজুন', oninput: e => { q = e.target.value; paint(); } });
        const paint = () => {
          chips.replaceChildren(chipRow('ধরন', [chip('সব', !qtype, () => { qtype = null; paint(); }), ...Object.keys(QT).slice(0, 3).map(k => chip(QT[k], qtype === k, () => { qtype = qtype === k ? null : k; paint(); }))]),
            chaptersOf(rows).length ? chipRow('অধ্যায়', [chip('সব অধ্যায়', !chapter, () => { chapter = null; paint(); }), ...chaptersOf(rows).map(c => chip(c, chapter === c, () => { chapter = chapter === c ? null : c; paint(); }))]) : '');
          const shown = bankFilter(rows, { qtype, chapter, q });
          box.replaceChildren(h('p', { class: 'tc-cap', text: `${bn(shown.length)}টা প্রশ্ন` }), ...shown.slice(0, 100).map(x => h('div', { class: 'de-card tc-card' },
            h('div', { class: 'tc-wrap' }, h('span', { class: 'de-chip', text: QT[x.qtype] || x.qtype }), x.chapter_name ? h('span', { class: 'de-chip', text: x.chapter_name }) : null),
            h('p', { class: 'tc-q', text: x.body }),
            (x.options || []).length ? h('ol', { class: 'tc-opts' }, ...x.options.map((o, i) => h('li', { class: String(o) === x.answer ? 'is-ans' : '' }, h('span', { class: 'tc-lab', text: LAB[i] || bn(i + 1) }), h('span', { text: String(o) + (String(o) === x.answer ? ' ✓' : '') })))) : (x.answer ? h('p', { class: 'tc-cap', text: 'উত্তর: ' + x.answer }) : null),
            x.qtype !== 'mcq' ? h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: x.answer ? 'নমুনা উত্তর বদলান' : 'নমুনা উত্তর লিখুন', onclick: () => {
              const f = field({ label: 'নমুনা উত্তর (ছাত্ররা "উত্তর দেখি" চাপলে এটা দেখবে)', value: x.answer || '', multiline: true, rows: 6 });
              const save = h('button', { class: 'de-btn de-btn--primary', type: 'button', text: 'সংরক্ষণ', onclick: async () => {
                const v = f.input.value.trim(); if (v.length > 4000) return f.error('৪০০০ অক্ষরের মধ্যে লিখুন');
                const r = await request('PATCH', `/rest/v1/question_bank?id=eq.${x.id}`, { answer: v }, { prefer: 'return=minimal' });
                if (r.kind === 'ok') { x.answer = v; document.querySelector('.de-sheet')?.remove(); document.querySelector('.de-sheet-scrim')?.remove(); toast('উত্তর সংরক্ষণ হয়েছে'); paint(); } else toast(r.kind === 'offline' ? 'নেট নেই' : 'হয়নি');
              } });
              openSheet({ title: 'নমুনা উত্তর', content: h('div', { class: 'sheet-col' }, f.el, save) });
            } }) : null,
            h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: 'ব্যাংক থেকে বাদ দিন', onclick: async () => {
              if (!await confirmBox({ title: 'প্রশ্ন বাদ', text: 'এই প্রশ্ন ব্যাংক থেকে চলে যাবে। কুইজে আর আসবে না।', ok: 'বাদ দিন', danger: true })) return;
              const r = await request('DELETE', `/rest/v1/question_bank?id=eq.${x.id}`, undefined, { prefer: 'return=minimal' });
              if (r.kind === 'ok') { const i = all.indexOf(x); if (i >= 0) all.splice(i, 1); rows.splice(rows.indexOf(x), 1); toast('বাদ দেওয়া হয়েছে'); paint(); } else toast(r.kind === 'offline' ? 'নেট নেই' : 'হয়নি');
            } }))), shown.length > 100 ? h('p', { class: 'tc-cap', text: 'প্রথম ১০০টা দেখানো হলো। ধরন, অধ্যায় বা খোঁজা দিয়ে কমান।' }) : null);
        };
        paint();
        return [h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: '← সব বিষয়', onclick: () => { level = subject = null; show(); } }), h('h2', { class: 'tc-h', text: `ক্লাস ${bn(level)} · ${subject}` }), search, chips, box];
      },
    });
  }
  show();
  return { node: root, destroy() { inner?.destroy(); } };
}

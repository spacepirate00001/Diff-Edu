// "বাড়ির কাজ": post homework for a class (table homework, one insert with a client id so a retry is the same homework) and see what was posted
// with how many students ticked it done (homework_done). How well the homework was done is the "হোমওয়ার্ক" step of the class rating.
import { h } from '../../ui/dom.js';
import { chip, chipRow } from '../../ui/chip.js';
import { field } from '../../ui/field.js';
import { toast } from '../../ui/toast.js';
import { saveBar } from '../../ui/savebar.js';
import { dataPage } from '../../ui/datapage.js';
import { stateCard } from '../../ui/states.js';
import { session } from '../../core/session.js';
import { store } from '../../core/store.js';
import { bn, shortDate } from '../../core/bn.js';
import { validateHomework, TITLE_MAX, DETAIL_MAX } from './logic.js';
import { loadHomework, loadRoutine, postHomework, today } from './data.js';

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export function homeworkPage(ctx) {
  const uid = session.uid();
  let level = Number(store.get('de.next.hwlevel.' + uid)) || null;
  const root = h('div', { class: 'tc-page' });
  const listBox = h('div', { class: 'tc-page' });
  let mineLevels = [];
  const form = h('div', { class: 'de-card tc-card' });
  const title = field({ label: 'কী করতে হবে', maxlength: TITLE_MAX, help: 'যেমন: অনুশীলনী ৫.২, ১ থেকে ৮ নম্বর' });
  const details = field({ label: 'আরও কিছু বলার থাকলে (ঐচ্ছিক)', multiline: true, rows: 3, maxlength: DETAIL_MAX });
  const due = field({ label: 'কবে জমা দিতে হবে (ঐচ্ছিক)', type: 'date' });
  const post = h('button', { class: 'de-btn de-btn--primary', type: 'button', text: 'বাড়ির কাজ দিন' });
  const chipsBox = h('div');
  const drawChips = () => chipsBox.replaceChildren(chipRow('কোন ক্লাস', LEVELS.map(l => chip('ক্লাস ' + bn(l), l === level, () => { level = l; store.set('de.next.hwlevel.' + uid, String(l)); drawChips(); showList(); }))));
  form.append(h('h2', { class: 'tc-h', text: 'নতুন বাড়ির কাজ' }), chipsBox, title.el, details.el, due.el, post);
  let list = null;
  const item = x => h('li', { class: 'tc-rule' }, h('b', { text: x.title }), x.details ? h('p', { class: 'tc-sub', text: x.details }) : null,
    h('p', { class: 'tc-cap', text: `${x.due_date ? 'জমা: ' + shortDate(x.due_date + 'T00:00:00+06:00') + ' · ' : ''}দেওয়া হয়েছে ${shortDate(x.created_at)}${x.doneCount != null ? ' · ' + bn(x.doneCount) + ' জন "করেছি" বলেছে' : ''}` }));
  function showList() {
    list?.destroy();
    if (!level) { listBox.replaceChildren(stateCard({ kind: 'empty', title: 'আগে ক্লাস বেছে নিন', text: 'ক্লাস বাছলে সেই ক্লাসের দেওয়া বাড়ির কাজ এখানে দেখা যাবে।' })); return; }
    list = dataPage({ key: 'hw.' + level, load: () => loadHomework(level), isEmpty: d => !d.length,
      empty: () => stateCard({ kind: 'empty', title: 'এই ক্লাসে এখনো বাড়ির কাজ দেওয়া হয়নি', text: 'উপরের ফর্মে লিখে দিন।' }),
      draw: d => [h('h2', { class: 'tc-h', text: `ক্লাস ${bn(level)}: দেওয়া বাড়ির কাজ` }), h('div', { class: 'de-card' }, h('ul', { class: 'tc-list' }, ...d.map(item))) ],
    });
    listBox.replaceChildren(list.node);
  }
  post.addEventListener('click', async () => {
    const v = validateHomework({ class_level: level, title: title.input.value, details: details.input.value, due_date: due.input.value }, today());
    title.error(v.errors.title || ''); details.error(v.errors.details || ''); due.error(v.errors.due_date || '');
    if (!v.ok) { if (v.errors.class_level) toast(v.errors.class_level); return; }
    post.disabled = true; post.textContent = 'একটু অপেক্ষা…';
    const state = await postHomework(v.value);
    post.disabled = false; post.textContent = 'বাড়ির কাজ দিন';
    if (state === 'failed' || state === 'rejected') return saveBar.show(state, { onRetry: () => post.click() });
    saveBar.show(state, { text: state === 'saved' ? 'বাড়ির কাজ দেওয়া হয়েছে' : undefined });
    title.input.value = ''; details.input.value = ''; due.input.value = '';
    if (state === 'saved') showList();
  });
  loadRoutine(uid).then(r => { if (r.kind === 'ok') { mineLevels = [...new Set(r.data.periods.flatMap(p => p.levels || []))]; if (!level && mineLevels.length === 1) { level = mineLevels[0]; drawChips(); showList(); } } });
  drawChips(); showList();
  root.append(form, listBox);
  return { node: root, destroy() { list?.destroy(); } };
}

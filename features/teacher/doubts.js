// "শিক্ষার্থীদের প্রশ্ন": the doubts students send to the teacher (table doubts: anonymous, the teacher cannot see who asked). List by status and class, answer, or remove one
// that was explained in class. Answering and removing need the net (the server answers at once), and say so when it is down.
import { h } from '../../ui/dom.js';
import { chip, chipRow } from '../../ui/chip.js';
import { openSheet } from '../../ui/sheet.js';
import { toast } from '../../ui/toast.js';
import { confirmBox } from '../../ui/dialog.js';
import { stateCard } from '../../ui/states.js';
import { dataPage } from '../../ui/datapage.js';
import { bn, shortDate } from '../../core/bn.js';
import { filterDoubts, validateAnswer, answerPatch, doubtStatus, openDoubts } from './logic.js';
import { loadDoubts, patchDoubt } from './data.js';

const NET = 'নেট নেই। উত্তর পাঠাতে নেট লাগে।';
export function doubtsPage() {
  let status = 'open', cls = null;
  const chipsBox = h('div'), list = h('div', { class: 'tc-page' });
  return dataPage({
    key: 'doubts', load: loadDoubts, isEmpty: d => !d.length,
    empty: () => stateCard({ kind: 'empty', title: 'এখনো কোনো প্রশ্ন আসেনি', text: 'শিক্ষার্থীরা "শিক্ষককে পাঠাও" চাপলে এখানে আসবে।' }),
    draw: (all, reload) => {
      const levels = [...new Set(all.map(d => d.class_level))].sort((a, b) => a - b);
      const paint = () => {
        chipsBox.replaceChildren(chipRow('অবস্থা', [['open', `বাকি (${bn(openDoubts(all))})`], ['done', 'উত্তর দেওয়া'], ['all', 'সব']].map(([k, l]) => chip(l, status === k, () => { status = k; paint(); }))),
          ...(levels.length > 1 ? [chipRow('ক্লাস', [chip('সব ক্লাস', cls == null, () => { cls = null; paint(); }), ...levels.map(l => chip('ক্লাস ' + bn(l), cls === l, () => { cls = l; paint(); }))])] : []));
        const shown = filterDoubts(all, { cls, status });
        list.replaceChildren(...(shown.length ? shown.map(card) : [stateCard({ kind: 'empty', title: status === 'open' ? 'কোনো প্রশ্ন বাকি নেই' : 'কিছু পাওয়া যায়নি', text: status === 'open' ? 'সব প্রশ্নের উত্তর দেওয়া হয়ে গেছে।' : 'অন্য অবস্থা বা ক্লাস বেছে দেখুন।' })]));
      };
      const card = d => h('section', { class: 'de-card tc-card' }, h('p', { class: 'tc-cap', text: `ক্লাস ${bn(d.class_level)}${d.subject ? ' · ' + d.subject : ''} · ${shortDate(d.created_at)}` }), h('p', { class: 'tc-q', text: d.body }),
        d.answer ? h('p', { class: 'tc-a' }, h('b', { text: 'আপনার উত্তর: ' }), d.answer) : null,
        h('div', { class: 'tc-wrap' }, h('button', { class: 'de-btn ' + (doubtStatus(d) === 'open' ? 'de-btn--primary' : 'de-btn--secondary'), type: 'button', text: d.answer ? 'উত্তর বদলান' : 'উত্তর দিন', onclick: () => answer(d) }),
          h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: 'সরিয়ে দিন', onclick: () => remove(d) })));
      function answer(d) {
        const ta = h('textarea', { class: 'de-field__input tc-ta', rows: '4', maxlength: '1000', 'aria-label': 'উত্তর', value: d.answer || '' }), go = h('button', { class: 'de-btn de-btn--primary', type: 'button', text: 'উত্তর পাঠান' });
        const sh = openSheet({ title: 'উত্তর লিখুন', content: h('div', { class: 'sheet-col' }, h('p', { class: 'tc-q', text: d.body }), ta, go) });
        go.addEventListener('click', async () => {
          const v = validateAnswer(ta.value); if (!v.ok) return toast(v.why === 'long' ? 'উত্তরটা একটু ছোট করুন।' : 'আগে উত্তর লিখুন।');
          go.disabled = true; const r = await patchDoubt(d.id, answerPatch(v.text)); go.disabled = false;
          if (r === 'offline') return toast(NET);
          if (r !== 'ok') return toast('উত্তর যায়নি, আবার চেষ্টা করুন।');
          sh.close(); toast('উত্তর পাঠানো হয়েছে।'); d.answer = v.text; reload();
        });
      }
      async function remove(d) {
        if (!await confirmBox({ title: 'প্রশ্নটা সরিয়ে দেবেন?', text: 'ক্লাসে বুঝিয়ে দিয়ে থাকলে সরিয়ে দিন। শিক্ষার্থীদের তালিকা থেকেও সরে যাবে।', ok: 'সরিয়ে দিন', cancel: 'না, থাক' })) return;
        const r = await patchDoubt(d.id, { hidden: true });
        if (r === 'offline') return toast(NET);
        if (r !== 'ok') return toast('সরানো যায়নি, আবার চেষ্টা করুন।');
        toast('প্রশ্নটা সরানো হয়েছে।'); reload();
      }
      paint();
      return [chipsBox, list];
    },
  });
}

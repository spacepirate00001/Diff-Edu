// The weekly report card page of a guardian: published cards of the chosen child, how the score is made (60% marks + 40% class rating),
// "দেখেছি", and a print / PDF page (print.html, the black-and-white A5 card of the live app). Score, rank and award are written by the server
// (compute_report_scores); the app only shows them and never changes them.
import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { emptyState } from '../../ui/states.js';
import { toast } from '../../ui/toast.js';
import { childPage } from '../../ui/datapage.js';
import { bn } from '../../core/bn.js';
import { store } from '../../core/store.js';
import { session } from '../../core/session.js';
import { outbox } from '../../core/outbox-app.js';
import { cardFacts, grade, rankBn, d1, W_MARKS, W_RATING, reportScore } from './calc.js';
import { loadReports, markSeen } from './data.js';
import { dayText } from './pages.js';

const RANK_KEY = 'de.next.showRank';
const isStudent = () => session.me()?.role === 'student';
// a student's own card shows the class position only when they switch it on (a guardian's: on unless switched off); "দেখেছি" belongs to the guardian
const showRank = () => { const v = store.get(RANK_KEY); return v == null ? !isStudent() : v !== '0'; };
const KIND = { weekly: 'সাপ্তাহিক রিপোর্ট কার্ড', series: 'মডেল টেস্ট সিরিজ' };

export function openPrint(cards, title) {
  store.setJson('de.next.print', { cards, title, noRank: !showRank() });
  if (!window.open('print.html', '_blank')) toast('নতুন পাতা খুলতে দিন, তারপর আবার চাপুন।');
}
// "দেখেছি": online it goes straight to the server; with no net it waits on the phone (outbox) and goes later.
export async function sawIt(card) {
  const r = await markSeen(card.id);
  if (r.kind === 'ok') return 'sent';
  if (r.kind === 'offline' || r.kind === 'server' || r.kind === 'rate') {
    const row = await outbox.add({ uid: session.uid(), method: 'POST', path: '/rest/v1/rpc/mark_report_seen', body: { p_id: card.id }, label: 'রিপোর্ট কার্ড দেখেছি' });
    return row ? 'kept' : 'failed';
  }
  return 'failed';
}

// How the score is made, in numbers a parent can follow.
export function breakdown(f) {
  const marks = f.pct == null ? null : W_MARKS * f.pct, rate = f.rating == null ? null : W_RATING * f.rating * 10;
  return h('div', { class: 'gx-formula', role: 'group', 'aria-label': 'স্কোর কীভাবে হলো' },
    h('span', { class: 'gx-formula__t', text: 'স্কোর = পরীক্ষার নম্বর ৬০% + ক্লাস রেটিং ৪০%' }),
    h('span', { class: 'gx-formula__n', text: f.pct == null ? 'নম্বর: এই সপ্তাহে পরীক্ষা হয়নি' : `নম্বর ${d1(f.pct)}% × ০.৬ = ${d1(marks)}` }),
    h('span', { class: 'gx-formula__n', text: f.rating == null ? 'রেটিং: এখনো নেই' : `রেটিং ${d1(f.rating)}/১০ → ${d1(f.rating * 10)}% × ০.৪ = ${d1(rate)}` }),
    h('b', { class: 'gx-formula__s', text: `স্কোর ${d1(f.score ?? reportScore(f.pct, f.rating))}` }));
}

function cardView(c, kid, rankOn, rerun) {
  const f = cardFacts(c), isNew = !c.seen_at;
  const seenBtn = h('button', { class: 'de-btn de-btn--primary', type: 'button', text: 'দেখেছি' });
  seenBtn.addEventListener('click', async () => {
    seenBtn.disabled = true;
    const r = await sawIt(c);
    if (r === 'failed') { seenBtn.disabled = false; return toast('জানানো যায়নি, আবার চেষ্টা করুন।'); }
    toast(r === 'kept' ? 'নেট এলে জানানো হবে।' : 'জানানো হয়েছে, ধন্যবাদ।');
    if (r === 'sent') rerun();
    else seenBtn.replaceWith(h('span', { class: 'de-chip de-chip--plain', text: 'পাঠানো বাকি' }));
  });
  return h('article', { class: 'de-card gx-card gx-report' + (isNew && !isStudent() ? ' is-new' : ''), 'aria-label': `${c.title || KIND[c.kind]}, ${dayText(c.period_from)} থেকে ${dayText(c.period_to)}` },
    h('div', { class: 'gx-row' }, h('div', {}, h('span', { class: 'gx-cap', text: c.title || KIND[c.kind] || '' }), h('h2', { class: 'gx-h3', text: `${dayText(c.period_from)} – ${dayText(c.period_to)}` })),
      isStudent() ? null : isNew ? h('span', { class: 'de-chip de-chip--warn', text: 'নতুন' }) : h('span', { class: 'de-chip de-chip--good', text: 'দেখেছেন ✓' })),
    rankOn && f.rank ? h('div', { class: 'gx-rank' }, h('b', { text: rankBn(f.rank) }), h('span', { text: `ক্লাসে অবস্থান, ${bn(f.size)} জনের মধ্যে` }),
      f.award === 'topper' ? h('span', { class: 'de-chip de-chip--good', text: '★ ক্লাস টপার' }) : f.award === 'improved' ? h('span', { class: 'de-chip de-chip--good', text: '↑ সবচেয়ে উন্নতি' }) : null) : null,
    h('table', { class: 'gx-table' }, h('thead', {}, h('tr', {}, ...['বিষয়', 'পূর্ণমান', 'প্রাপ্ত', 'গ্রেড'].map(t => h('th', { scope: 'col', text: t })))),
      h('tbody', {}, ...f.lines.map(l => h('tr', {}, h('td', { text: l.s }), h('td', { text: bn(l.f) }), h('td', { class: 'gx-table__b', text: l.o == null ? 'আসেনি' : bn(l.o) }), h('td', { text: l.o == null ? '—' : grade(100 * l.o / l.f) }))),
        f.lines.length ? h('tr', { class: 'gx-table__tot' }, h('td', { text: 'মোট' }), h('td', { text: bn(f.full) }), h('td', { class: 'gx-table__b', text: bn(f.got) }), h('td', { text: f.grade })) : null)),
    breakdown(f),
    h('p', { class: 'de-row__sub', text: `উপস্থিতি ${bn(f.present)}/${bn(f.days)} দিন` }),
    h('div', { class: 'gx-actions' }, isNew && !isStudent() ? seenBtn : null,
      h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: () => openPrint([c], c.title || 'রিপোর্ট কার্ড') }, icon('file'), 'প্রিন্ট / PDF')));
}

export const reportPage = () => childPage({
  key: 'reports', load: k => loadReports(k.id), isEmpty: r => !r.length,
  empty: () => emptyState('এখনো কোনো রিপোর্ট কার্ড আসেনি', 'প্রতি সপ্তাহের শেষে কার্ড তৈরি হলে এখানে দেখা যাবে।'),
  draw: (cards, kid, go) => {
    const box = h('div', { class: 'gx-reports' });
    const paint = () => {
      const on = showRank();
      box.replaceChildren(
        h('button', { class: 'cswitch' + (on ? ' is-on' : ''), type: 'button', 'aria-pressed': String(on), onclick: () => { store.set(RANK_KEY, on ? '0' : '1'); paint(); } },
          h('span', { class: 'cswitch__t' }, h('b', { text: 'ক্লাস পজিশন দেখানো হবে' }), h('span', { class: 'cswitch__d', text: on ? 'কার্ডে ও প্রিন্টে অবস্থান থাকবে।' : 'অবস্থান ছাড়া দেখা ও প্রিন্ট হবে।' })),
          h('span', { class: 'cswitch__state', 'aria-hidden': 'true' }, on ? icon('check') : null, h('span', { text: on ? 'চালু' : 'বন্ধ' }))),
        ...cards.map(c => cardView(c, kid, on, go)));
    };
    paint();
    return box;
  },
});

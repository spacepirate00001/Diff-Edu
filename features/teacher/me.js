// "আমার প্রোফাইল ও সময়সূচি": who I am on this app, and my daily class routine (class_periods: shift, period, class; the server keeps no per-weekday routine).
import { h } from '../../ui/dom.js';
import { stateCard } from '../../ui/states.js';
import { dataPage } from '../../ui/datapage.js';
import { session } from '../../core/session.js';
import { bn } from '../../core/bn.js';
import { OFFICE_PHONE, OFFICE_PHONE_BN } from '../../core/config.js';
import { SHIFTS } from './logic.js';
import { loadRoutine } from './data.js';
import { periodName, periodSub, avatar } from './ui.js';

export function mePage(ctx) {
  const me = ctx.me;
  const card = h('section', { class: 'de-card tc-card' }, h('div', { class: 'tc-row' }, avatar(me.full_name), h('div', { class: 'tc-grow' }, h('h2', { class: 'tc-h', text: me.full_name }), h('p', { class: 'tc-cap', text: `শিক্ষক · আইডি ${bn(me.login_id)}` }))),
    me.phone ? h('p', { class: 'tc-sub', text: `ফোন: ${bn(me.phone)}` }) : null, h('p', { class: 'tc-cap', text: `নাম বা ফোন নম্বর বদলাতে অফিসে জানান: ${OFFICE_PHONE_BN}` }), h('a', { class: 'de-btn de-btn--secondary', href: 'tel:' + OFFICE_PHONE }, 'অফিসে ফোন করুন'));
  const sched = dataPage({
    key: 'routine', load: () => loadRoutine(session.uid()).then(r => (r.kind === 'ok' ? { kind: 'ok', data: r.data.periods } : r)), isEmpty: d => !d.length,
    empty: () => stateCard({ kind: 'empty', title: 'রুটিনে আপনার ক্লাস নেই', text: 'রুটিন ঠিক করেন অফিস। কিছু ভুল মনে হলে অফিসে জানান।' }),
    draw: periods => [h('h2', { class: 'tc-h', text: 'আমার ক্লাসের সময়সূচি' }), h('p', { class: 'tc-cap', text: 'প্রতিদিনের একই রুটিন। সময় ব্যাচের শুরু থেকে হিসাব করা, প্রতি ক্লাস ৪০ মিনিট।' }),
      ...SHIFTS.map(s => ({ s, list: periods.filter(p => p.shift === s.id) })).filter(x => x.list.length).map(x => h('section', { class: 'de-card tc-card' }, h('h3', { class: 'tc-h', text: x.s.name + ' ব্যাচ' }),
        h('ul', { class: 'tc-list' }, ...x.list.map(p => h('li', { class: 'tc-rule' }, h('b', { text: periodName(p) }), h('p', { class: 'tc-sub', text: periodSub(p) }))))))],
  });
  return { node: h('div', { class: 'tc-page' }, card, sched.node), destroy: () => sched.destroy() };
}

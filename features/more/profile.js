// "প্রোফাইল ও সন্তান" (guardian): who is signed in and the children linked to this account. Read-only: names and classes are changed by the office.
// Sources: the saved profile (core/account.js) and the children list (core/children.js); roll numbers come from table students (own children only).
import { h } from '../../ui/dom.js';
import { loading, emptyState } from '../../ui/states.js';
import { callOfficeButton } from '../auth/forgot.js';
import { sel, rows } from '../../core/api.js';
import { kids } from '../../core/children.js';
import { bn } from '../../core/bn.js';
import { initialsOf, classLabel } from '../today/today.js';

export function profilePage(ctx) {
  const me = ctx.me, box = h('div');
  const line = (k, v) => v ? h('div', { class: 'gx-row' }, h('span', { class: 'de-row__sub', text: k }), h('b', { text: v })) : null;
  const draw = async () => {
    const list = kids.list();
    let rolls = {};
    if (list.length) { const r = await sel('students', `select=id,roll&id=in.(${list.map(k => k.id).join(',')})`); rolls = Object.fromEntries(rows(r).map(s => [s.id, s.roll])); }
    if (!box.isConnected) return;
    box.replaceChildren(
      h('section', { class: 'de-card gx-card' }, h('div', { class: 'me-card' }, h('span', { class: 'de-avatar me-av', 'aria-hidden': 'true', text: initialsOf(me.full_name) }), h('span', { class: 'me-t' }, h('b', { text: me.full_name }), h('span', { text: 'অভিভাবক' }))),
        line('লগইন আইডি', bn(me.login_id)), line('ফোন', me.phone ? bn(me.phone) : '')),
      h('h2', { class: 'inbox-group__h', text: 'আমার সন্তান' }),
      list.length ? h('div', { class: 'de-card more-card' }, ...list.map(k => h('div', { class: 'de-row gx-line' }, h('span', { class: 'de-avatar kid-av', 'aria-hidden': 'true', text: initialsOf(k.name) }),
        h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: k.name }), h('span', { class: 'de-row__sub', text: [classLabel(k.class_level), k.shift, rolls[k.id] ? `রোল ${bn(rolls[k.id])}` : ''].filter(Boolean).join(' · ') }))))) : emptyState('কোনো সন্তান যুক্ত নেই', 'অফিসে জানালে সন্তানকে আপনার অ্যাকাউন্টে যুক্ত করে দেবে।', callOfficeButton('অফিসে ফোন করুন')),
      h('p', { class: 'de-row__sub gx-note', text: 'নাম, শ্রেণি বা ফোন নম্বর বদলাতে অফিসে জানান।' }));
  };
  box.append(loading(2));
  kids.load({ maxAge: 15000 }).then(draw);
  return { node: box };
}

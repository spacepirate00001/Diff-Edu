// "আমার প্রোফাইল" (student): avatar (the shop avatar, else the placed mascot, else the first letter), name, class, roll. Photos are not shown here at all.
// Other children only ever see first name + class + this avatar (the live rpc student_card / class lists); the page says so in one line.
import { h } from '../../ui/dom.js';
import { navRow } from '../../ui/navrow.js';
import { loading } from '../../ui/states.js';
import { callOfficeButton } from '../auth/forgot.js';
import { sel, rows } from '../../core/api.js';
import { bn } from '../../core/bn.js';
import { initialsOf, classLabel } from '../today/today.js';
import { me, noRecState, progressCard, section } from './common.js';
import { shopItem } from './logic.js';

export function profilePage(ctx) {
  const root = h('div', { class: 'st-page' });
  let dead = false;
  (async () => {
    root.append(loading(2));
    const rec = await me();
    if (!rec) return root.replaceChildren(noRecState());
    const [d, c] = await Promise.all([sel('student_decor', `select=mascot&student_id=eq.${rec.id}`), sel('sticker_catalog', 'select=key,emoji&active=is.true')]);
    if (dead) return;
    const mascot = rows(c).find(x => x.key === rows(d)[0]?.mascot)?.emoji, face = shopItem(rec.avatar)?.[2] || mascot || null, me0 = ctx.me;
    root.replaceChildren(
      h('section', { class: 'de-card st-who' }, h('span', { class: 'de-avatar de-avatar--lg st-who__av', 'aria-hidden': 'true', text: face || initialsOf(rec.name) }), h('b', { class: 'st-who__n', text: rec.name }),
        h('span', { class: 'de-row__sub', text: [classLabel(rec.class_level), rec.roll ? `রোল ${bn(rec.roll)}` : '', rec.shift === 'morning' ? 'সকাল' : rec.shift === 'afternoon' ? 'বিকেল' : ''].filter(Boolean).join(' · ') }),
        h('span', { class: 'de-row__sub', text: `লগইন আইডি ${bn(me0.login_id)}` })),
      progressCard(rec),
      section('সাজাও ও দেখো'),
      h('div', { class: 'de-card more-card' }, navRow({ ic: 'star', text: 'সাজঘর', sub: 'মাসকট, ফ্রেম ও স্টিকার', onclick: () => ctx.go('/play/decor') }), navRow({ ic: 'gift', text: 'পয়েন্টের দোকান', sub: 'স্টার দিয়ে অবতার', onclick: () => ctx.go('/play/shop') }),
        navRow({ ic: 'file', text: 'আমার সার্টিফিকেট', sub: 'যা যা অর্জন হয়েছে', onclick: () => ctx.go('/learn/certs') }), navRow({ ic: 'check', text: 'আমার লক্ষ্য', onclick: () => ctx.go('/learn/goals') })),
      h('p', { class: 'de-row__sub gx-note', text: 'অন্য বন্ধুরা শুধু তোমার প্রথম নাম, ক্লাস আর অবতার দেখে। তোমার ছবি, ফোন নম্বর বা ঠিকানা কেউ দেখে না।' }),
      h('p', { class: 'de-row__sub gx-note', text: 'নাম, ক্লাস বা ছবি বদলাতে চাইলে অফিসে বলো।' }), callOfficeButton('অফিসে ফোন করো'));
  })();
  return { node: root, destroy() { dead = true; } };
}

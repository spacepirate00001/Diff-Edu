// P12: the "আরও" tab. Features that did not fit the four tabs, grouped per role, then "আমার" (profile, settings, help, logout).
// All of it works from what is already on the phone, so it works offline too.
import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { MORE_GROUPS, ROLE_BN } from '../../roles/tabs.js';
import { byId, visible, featureRoute, routeOf, LIVE_ROUTES } from '../search/registry.js';
import { navRow } from '../../ui/navrow.js';
import { features } from '../../core/features.js';
import { outbox } from '../../core/outbox-app.js';
import { session } from '../../core/session.js';
import { bn } from '../../core/bn.js';
import { flags } from '../../core/flags.js';
import { VERSION, OFFICE_PHONE, OFFICE_PHONE_BN } from '../../core/config.js';
import { initialsOf } from '../today/today.js';
import { openPending } from '../offline/pending-sheet.js';
import { refreshApp } from '../update/update-banner.js';
import { confirmBox } from '../../ui/dialog.js';
import { canGetApk, openApkSheet } from '../update/apk-nudge.js';

const row = navRow;
export function moreTab(ctx) {
  const me = ctx.me, role = me.role;
  const root = h('div', { class: 'more' });
  root.append(h('button', { class: 'search-fake', type: 'button', onclick: () => ctx.go('/search'), 'aria-label': 'খোঁজা' }, icon('search'), h('span', { text: role === 'teacher' || role === 'admin' ? 'ফিচার বা শিক্ষার্থী খুঁজুন' : 'ফিচার খুঁজুন' })));
  for (const g of MORE_GROUPS[role] || []) {
    const items = g.ids.map(id => byId[id]).filter(f => f && visible(f, features));
    if (!items.length) continue;
    root.append(h('section', { class: 'more-group' }, h('h2', { class: 'inbox-group__h', text: g.title }), h('div', { class: 'de-card more-card' },
      ...items.map(f => routeOf(f, role) ? row({ ic: LIVE_ROUTES[f.id][1], text: f.name, onclick: () => ctx.go(routeOf(f, role)) })
        : row({ ic: 'file', text: f.name, sub: `ধাপ ${bn(f.step)}-এ আসছে`, disabled: true, onclick: () => ctx.go(featureRoute(f.id)) })))));
  }
  const pendingRow = row({ ic: 'clock', text: 'অফলাইন পেন্ডিং কাজ', onclick: () => openPending() });
  outbox.list(session.uid()).then(rs => { if (rs.length) pendingRow.querySelector('.de-row__main').after(h('span', { class: 'de-chip de-chip--warn', text: bn(rs.length) })); });
  root.append(h('section', { class: 'more-group' }, h('h2', { class: 'inbox-group__h', text: 'আমার' }), h('div', { class: 'de-card more-card' },
    h('div', { class: 'me-card' }, h('span', { class: 'de-avatar me-av', 'aria-hidden': 'true', text: initialsOf(me.full_name) }), h('span', { class: 'me-t' }, h('b', { text: me.full_name }), h('span', { text: `${ROLE_BN[role]} · আইডি ${bn(me.login_id)}` }))),
    row({ ic: 'text', text: 'থিম ও লেখার সাইজ', sub: 'লেখার মাপ ও রং', onclick: () => ctx.go('/more/display') }),
    row({ ic: 'lock', text: 'পিন বদলান', onclick: () => ctx.go('/more/pin') }),
    flags.on('web_push') ? row({ ic: 'bell', text: 'অ্যাপ নোটিফিকেশন', sub: 'নোটিফিকেশন চালু বা বন্ধ করুন', onclick: () => ctx.go('/more/push') }) : null,
    role === 'guardian' ? row({ ic: 'user', text: 'প্রোফাইল ও সন্তান', sub: 'আপনার ও সন্তানদের তথ্য', onclick: () => ctx.go('/more/profile') }) : null,
    role === 'guardian' ? row({ ic: 'info', text: 'গোপনীয়তা', sub: 'সন্তানের সম্মতি, তথ্য মুছে ফেলা', onclick: () => ctx.go('/more/privacy') }) : null,
    pendingRow,
    canGetApk() ? row({ ic: 'down', text: 'অ্যান্ড্রয়েড অ্যাপ ডাউনলোড', sub: 'নোটিফিকেশন ও নেট ছাড়া কাজের জন্য', onclick: () => openApkSheet() }) : null,
    row({ ic: 'phone', text: 'অফিসে ফোন করুন', sub: OFFICE_PHONE_BN, href: 'tel:' + OFFICE_PHONE }),
    row({ ic: 'chat', text: 'মতামত দিন', sub: 'সমস্যা, পরামর্শ বা ভালো লাগার কথা', onclick: async () => (await import('../feedback/feedback.js')).openFeedback('আরও') }),
    row({ ic: 'help', text: 'সাহায্য', onclick: () => ctx.go('/more/help') }),
    row({ ic: 'file', text: 'ওপেন-সোর্স লাইসেন্স', sub: 'আইকনের জন্য ধন্যবাদ', onclick: () => ctx.go('/more/licenses') }),
    row({ ic: 'refresh', text: 'অ্যাপ রিফ্রেশ করুন', sub: 'আটকে গেলে এটা চাপুন', onclick: async () => { if (await confirmBox({ title: 'অ্যাপ রিফ্রেশ', text: 'অ্যাপ নতুন করে খুলবে। অফলাইন পেন্ডিং কাজ থেকে যাবে।', ok: 'রিফ্রেশ করুন' })) refreshApp(); } }))));
  root.append(h('button', { class: 'de-btn de-btn--secondary logout-btn', type: 'button', onclick: () => ctx.confirmLogout() }, icon('logout'), 'লগআউট'), h('p', { class: 'more-ver', text: VERSION }));
  return { node: root };
}

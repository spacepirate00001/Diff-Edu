// P13: search on the phone. Features (everybody) and students (teacher and admin only), with the old phonetic name matching.
// Nothing about past searches is remembered (shared phones).
import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { openSheet } from '../../ui/sheet.js';
import { announce } from '../../ui/dom.js';
import { sel, rows } from '../../core/api.js';
import { cache } from '../../core/cache.js';
import { session } from '../../core/session.js';
import { features } from '../../core/features.js';
import { flags } from '../../core/flags.js';
import { net } from '../../core/net.js';
import { filter, normalize } from '../../core/name-search.js';
import { bn, agoText, ascii } from '../../core/bn.js';
import { FEATURES, LIVE, visible, featureRoute, routeOf } from './registry.js';
import { CLASS_BN } from '../today/today.js';

const MAX = 20;
// Pure part (tested): feature matches for a role and a query.
export function searchFeatures(role, query, feat = features) {
  const pool = [...LIVE.filter(x => x.roles.includes(role) && (!x.flag || flags.on(x.flag))).map(x => ({ id: x.id, name: x.name, syn: x.syn, route: x.route })),
    ...FEATURES.filter(f => f.roles.includes(role) && visible(f, feat)).map(f => ({ id: f.id, name: f.name, syn: f.syn, route: routeOf(f, role) || featureRoute(f.id), step: routeOf(f, role) ? undefined : f.step }))];
  return filter(pool, query, f => ({ name: [f.name, ...f.syn].join(' '), login: '', roll: null })).slice(0, MAX);
}
export function searchStudents(list, query) {
  const digits = ascii(query).replace(/\D/g, '');
  const byName = filter(list, query, s => ({ name: s.profile?.full_name, login: s.profile?.login_id, roll: s.roll }));
  if (digits.length < 4) return byName.slice(0, MAX);
  const byPhone = list.filter(s => (s.profile?.phone || '').includes(digits) && !byName.includes(s));
  return [...byName, ...byPhone].slice(0, MAX);
}
const STUDENT_Q = 'select=id,class_level,roll,active,profile:profiles!students_profile_id_fkey(full_name,login_id,phone)&active=is.true&order=class_level,roll';

export function searchPage(ctx) {
  const role = ctx.me.role, staff = role === 'teacher' || role === 'admin';
  const input = h('input', { class: 'search-input', type: 'search', role: 'searchbox', 'aria-label': 'ফিচার বা শিক্ষার্থী খুঁজুন', placeholder: staff ? 'ফিচার, শিক্ষার্থীর নাম বা রোল' : 'ফিচারের নাম', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'search' });
  const out = h('div', { class: 'search-out', 'aria-live': 'polite' });
  const count = h('span', { class: 'sr-only', 'aria-live': 'polite' });
  let students = null, sKind = staff ? 'loading' : 'none', sAt = null, timer = null;
  const node = h('div', { class: 'de-screen full full--cream search', role: 'search', 'data-page': 'search' },
    h('div', { class: 'search-bar' }, h('button', { class: 'de-appbar__back search-back', type: 'button', 'aria-label': 'পিছনে যান', onclick: () => ctx.back() }, icon('back')), input), count, out);

  function render() {
    const q = input.value;
    const empty = !normalize(q);
    const f = empty ? [] : searchFeatures(role, q);
    const s = empty || !staff || !students ? [] : searchStudents(students, q);
    const parts = [];
    if (empty) parts.push(h('p', { class: 'search-hint', text: staff ? 'ফিচারের নাম, শিক্ষার্থীর নাম, রোল বা ফোন নম্বর লিখুন।' : 'যে ফিচার খুঁজছেন তার নাম লিখুন, যেমন "ফি" বা "ফল"।' }));
    if (f.length) parts.push(h('section', null, h('h2', { class: 'inbox-group__h', text: 'ফিচার' }), h('div', { class: 'de-rows' }, ...f.map(x => h('button', { class: 'de-row search-row', type: 'button', onclick: () => ctx.go(x.route) },
      h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: x.name }), x.step ? h('span', { class: 'de-row__sub', text: `ধাপ ${bn(x.step)}-এ আসছে` }) : null), icon('chev'))))));
    if (staff && !empty) {
      const body = [];
      if (sKind === 'loading') body.push(h('p', { class: 'de-row__sub', text: 'শিক্ষার্থীর তালিকা আনা হচ্ছে…' }));
      else if (sKind === 'offline') body.push(h('p', { class: 'de-row__sub', text: 'শিক্ষার্থী খুঁজতে নেট লাগবে।' }));
      else if (sKind === 'error') body.push(h('p', { class: 'de-row__sub', text: 'শিক্ষার্থীর তালিকা আনা যায়নি।' }), h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: loadStudents, text: 'আবার চেষ্টা করুন' }));
      else {
        if (sAt) body.push(h('p', { class: 'de-row__sub', text: `নেট নেই। শিক্ষার্থীর তালিকা ${agoText(sAt)}।` }));
        body.push(...s.map(x => h('button', { class: 'de-row search-row', type: 'button', onclick: () => studentSheet(x) },
          h('span', { class: 'de-avatar kid-av', 'aria-hidden': 'true', text: Array.from(x.profile?.full_name || '?')[0] }),
          h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: x.profile?.full_name || '—' }), h('span', { class: 'de-row__sub', text: `${CLASS_BN[x.class_level] || ''} শ্রেণি · রোল ${bn(x.roll ?? '')}` })), icon('chev'))));
      }
      if (body.length) parts.push(h('section', null, h('h2', { class: 'inbox-group__h', text: 'শিক্ষার্থী' }), h('div', { class: 'de-rows' }, ...body)));
    }
    if (!empty && !f.length && !s.length && sKind !== 'loading' && sKind !== 'offline' && sKind !== 'error') parts.push(h('p', { class: 'search-hint', text: 'কিছু পাওয়া যায়নি। নামের অংশ বা রোল লিখুন।' }));
    out.replaceChildren(...parts);
    count.textContent = empty ? '' : `${bn(f.length + s.length)}টা ফল`;
  }
  async function loadStudents() {
    const uid = session.uid();
    const old = cache.get(uid, 'students');
    if (old) { students = old.v; sKind = 'ok'; sAt = null; render(); }
    else { sKind = 'loading'; render(); }
    const res = await sel('students', STUDENT_Q);
    if (res.kind === 'ok') { students = rows(res); cache.set(uid, 'students', students); sKind = 'ok'; sAt = null; }
    else if (old) { sKind = 'ok'; sAt = res.kind === 'offline' ? old.at : null; }
    else sKind = res.kind === 'offline' ? 'offline' : 'error';
    render();
  }
  function studentSheet(x) {
    const sh = openSheet({ title: x.profile?.full_name || 'শিক্ষার্থী', content: h('div', { class: 'sheet-col' },
      h('p', { class: 'detail__meta', text: `${CLASS_BN[x.class_level] || ''} শ্রেণি · রোল ${bn(x.roll ?? '')}` }), h('p', { class: 'detail__body', text: `লগইন আইডি: ${x.profile?.login_id || '—'}` }),
      h('p', { class: 'de-row__sub', text: 'পূর্ণ কার্ড ধাপ ৪-এ আসছে।' }), h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: () => sh.close(), text: 'বন্ধ করুন' })) });
  }
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(render, 120); });
  input.addEventListener('keydown', e => {
    const items = [...out.querySelectorAll('button.search-row')];
    if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); items[0].focus(); }
  });
  out.addEventListener('keydown', e => {
    const items = [...out.querySelectorAll('button.search-row')]; const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[Math.min(i + 1, items.length - 1)]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); (i <= 0 ? input : items[i - 1]).focus(); }
  });
  render();
  if (staff) loadStudents();
  return { node, onMount: () => input.focus(), destroy() { clearTimeout(timer); } };
}
export { net };

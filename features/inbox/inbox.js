// P14: the inbox. Notices, messages, daily notes, director's messages, staff notes in one list, newest first, with chips on top.
// Guardians open it as the "যোগাযোগ" tab; everyone else from the bell.
import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { chip, chipRow } from '../../ui/chip.js';
import { loading, stateCard, errorState, offlineState, staleBanner } from '../../ui/states.js';
import { announce } from '../../ui/dom.js';
import { net } from '../../core/net.js';
import { bn, shortDate, clockText, dhakaDay } from '../../core/bn.js';
import { inbox } from './store.js';
import { here } from '../../core/router.js';
import { CHIPS, EMPTY_TEXT, KIND_LABEL, filterRows, groupByDay, isNew } from './model.js';
import { openDetail } from './detail.js';

const ICON = { notice: 'bell', message: 'chat', daily: 'file', director: 'user', staff: 'file', todo: 'alert' };
export function inboxPage(ctx) {
  const role = ctx.me.role;
  const want = here().query.kind;
  let current = (CHIPS[role] || []).some(([k]) => k === want) ? want : 'all';
  const wantOpen = here().query.open; let opened = false;   // a tapped push notification opens its item
  const seenBefore = inbox.visit();       // "new" for this visit = newer than the last visit; the visit time moves to now
  const root = h('div', { class: 'inbox' });
  const chipsBox = h('div', { class: 'inbox-chips' });
  const list = h('div', { class: 'inbox-list', 'aria-live': 'polite' });
  root.append(chipsBox, list);

  const when = r => (dhakaDay(r.at) === dhakaDay(Date.now()) ? 'আজ, ' + clockText(r.at) : shortDate(r.at));
  const rowEl = r => {
    const fresh = isNew(r, seenBefore);
    return h('button', { class: 'de-row inbox-row' + (fresh ? ' is-new' : ''), type: 'button', onclick: () => openDetail(r), 'aria-label': `${fresh ? 'নতুন, ' : ''}${KIND_LABEL[r.source]}: ${r.title}` },
      h('span', { class: 'inbox-ic', 'aria-hidden': 'true' }, icon(ICON[r.source])),
      h('span', { class: 'de-row__main' }, h('span', { class: 'inbox-kind' }, KIND_LABEL[r.source], fresh ? h('span', { class: 'inbox-new', text: ' · নতুন' }) : null),
        h('span', { class: 'de-row__title inbox-title', text: r.title }), h('span', { class: 'de-row__sub', text: r.source === 'todo' ? `${bn(r.who)}টা` : [r.who, when(r)].filter(Boolean).join(' · ') })),
      fresh ? h('i', { class: 'de-badge de-badge--dot', 'aria-hidden': 'true' }) : null);
  };
  function paint() {
    const st = inbox.get();
    chipsBox.replaceChildren(chipRow('খবরের ধরন', (CHIPS[role] || CHIPS.student).map(([k, label]) => chip(label, k === current, () => { current = k; paint(); announce(label); }))));
    const rows = filterRows(st.rows, current);
    const out = [];
    if (st.status === 'offline' && st.rows.length) out.push(staleBanner('offline', st.staleAt || net.lastOkAt() || null));
    else if (st.status === 'error' && st.rows.length) out.push(staleBanner('error'));
    if (st.status === 'cached' && net.isOffline()) out.push(staleBanner('offline', st.staleAt));
    if (st.failed.length && st.status === 'partial') out.push(h('div', { class: 'de-banner de-banner--warn', role: 'status' }, h('span', { class: 'de-banner__text', text: 'কিছু খবর আনা যায়নি।' })));
    if (!rows.length) {
      if (st.loading || st.status === 'idle') out.push(loading(3));
      else if (st.status === 'offline' && !st.rows.length) out.push(offlineState(() => inbox.load()));
      else if (st.status === 'error' && !st.rows.length) out.push(errorState(() => inbox.load()));
      else out.push(stateCard({ kind: 'empty', title: EMPTY_TEXT[current] || EMPTY_TEXT.all, text: 'নতুন খবর এলে এখানে দেখা যাবে।' }));
    } else {
      for (const [label, items] of groupByDay(rows)) out.push(h('section', { class: 'inbox-group' }, h('h2', { class: 'inbox-group__h', text: label }), h('div', { class: 'de-rows' }, ...items.map(rowEl))));
      if (st.more) out.push(h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: () => inbox.load({ more: true }), text: st.loading ? 'আনা হচ্ছে…' : 'আরও দেখুন' }));
    }
    list.replaceChildren(...out);
  }
  const off = inbox.on(paint);
  paint(); inbox.load();
  return { node: root, destroy: off };
}

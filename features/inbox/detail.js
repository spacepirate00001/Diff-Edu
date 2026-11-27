// Opening one inbox row: the whole text, read-aloud, and (for daily / staff notes) the read mark on the server.
import { h } from '../../ui/dom.js';
import { openSheet } from '../../ui/sheet.js';
import { rpc } from '../../core/api.js';
import { bn, dhakaDate, clockText } from '../../core/bn.js';
import { speak } from './speak.js';
import { KIND_LABEL } from './model.js';
import { inbox } from './store.js';

export function openDetail(row) {
  const when = `${dhakaDate(row.at)}${row.source === 'director' ? '' : ', ' + clockText(row.at)}`;
  const body = row.body && row.body !== row.title ? row.body : '';
  const sheet = openSheet({ title: row.source === 'message' ? 'বার্তা' : row.title, content: h('div', { class: 'sheet-col detail' },
    h('span', { class: 'de-chip de-chip--plain', text: KIND_LABEL[row.source] }),
    h('p', { class: 'detail__meta', text: [row.who, when].filter(Boolean).join(' · ') }),
    row.source === 'message' ? h('p', { class: 'detail__body', text: row.body }) : body ? h('p', { class: 'detail__body', text: body }) : null,
    row.video ? h('a', { class: 'de-btn de-btn--secondary', href: row.video, target: '_blank', rel: 'noopener', text: 'ভিডিও দেখুন' }) : null,
    h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: () => speak(`${row.title}। ${row.body || ''}`), text: 'পড়ে শোনাও' }),
    row.source === 'message' ? h('button', { class: 'de-btn de-btn--secondary', type: 'button', disabled: true, 'aria-disabled': 'true', text: 'উত্তর দিন (ধাপ ২-এ আসছে)' }) : null,
    h('button', { class: 'de-btn de-btn--text', type: 'button', onclick: () => sheet.close(), text: 'বন্ধ করুন' })) });
  // Reading a daily / staff note marks it read. Never queued: if it fails, it is marked again next time.
  if ((row.source === 'daily' || row.source === 'staff') && row.read === false) {
    rpc(row.source === 'daily' ? 'mark_notes_read' : 'mark_staff_notes_read', { p_ids: [row.raw] }).then(r => { if (r.kind === 'ok') inbox.markRead(row.id); });
  }
  return sheet;
}
export { bn };

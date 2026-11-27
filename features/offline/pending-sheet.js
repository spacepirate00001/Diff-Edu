// P15: the "ফোনে রাখা কাজ" sheet. Every waiting or refused write is listed; nothing is dropped without being asked.
import { h } from '../../ui/dom.js';
import { openSheet } from '../../ui/sheet.js';
import { confirmBox } from '../../ui/dialog.js';
import { toast } from '../../ui/toast.js';
import { outbox, flushNow } from '../../core/outbox-app.js';
import { session } from '../../core/session.js';
import { agoText } from '../../core/bn.js';
import { callOfficeButton } from '../auth/forgot.js';

export async function openPending() {
  const body = h('div', { class: 'sheet-col pending' });
  const sheet = openSheet({ title: 'ফোনে রাখা কাজ', content: body });
  const paint = async () => {
    const rows = await outbox.list(session.uid());
    if (!rows.length) return body.replaceChildren(h('p', { class: 'sheet-text', text: 'ফোনে কোনো কাজ জমা নেই।' }), h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: () => sheet.close(), text: 'বন্ধ করুন' }));
    const items = rows.map(r => h('li', { class: 'pending-row' },
      h('span', { class: 'de-row__main' }, h('b', { class: 'de-row__title', text: r.label || 'কাজ' }), h('span', { class: 'de-row__sub', text: `${agoText(r.at)} · ${r.state === 'rejected' ? 'সার্ভার নেয়নি: ' + (r.why || '') : 'অপেক্ষায়'}` })),
      h('button', { class: 'de-btn de-btn--text', type: 'button', text: 'বাদ দিন', onclick: async () => { if (await confirmBox({ title: 'কাজটা বাদ দেবেন?', text: 'এটা বাদ দিলে সার্ভারে যাবে না।', ok: 'বাদ দিন', danger: true })) { await outbox.remove(r.key); paint(); } } })));
    body.replaceChildren(...[h('ul', { class: 'pending-list' }, ...items),
      h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: async () => { const r = await flushNow(); toast(r.sent ? 'পাঠানো হয়েছে' : r.stopped === 'offline' ? 'নেট নেই' : 'এখনো যায়নি'); paint(); }, text: 'এখনই পাঠান' }),
      rows.some(r => r.state === 'rejected') ? h('div', { class: 'sheet-col' }, h('p', { class: 'sheet-text', text: 'যেগুলো সার্ভার নেয়নি, সেগুলো অফিসে জানান।' }), callOfficeButton('অফিসে জানান')) : null,
      h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: () => sheet.close(), text: 'বন্ধ করুন' })].filter(Boolean));
  };
  const off = outbox.on(paint);
  paint();
  return { sheet, off };
}

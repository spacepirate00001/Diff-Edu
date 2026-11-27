// P15: the offline banner and the "work waiting on the phone" line. "Offline" is the browser's word OR a failed last call (core/net.js).
import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { net } from '../../core/net.js';
import { outbox, flushNow } from '../../core/outbox-app.js';
import { session } from '../../core/session.js';
import { agoText, bn } from '../../core/bn.js';
import { openPending } from './pending-sheet.js';

export function mountBanner(root) {
  let count = 0, failed = 0;
  const paint = () => {
    const off = net.isOffline();
    if (!off && !count && !failed) return root.replaceChildren();
    const last = net.lastOkAt();
    const parts = [];
    if (off) parts.push(`নেট নেই।${last ? ` শেষ দেখা তথ্য, ${agoText(last)}।` : ' শেষ দেখা তথ্য দেখানো হচ্ছে।'}`);
    if (count) parts.push(off ? `${bn(count)}টা কাজ ফোনে রাখা আছে, নেট এলে যাবে।` : `${bn(count)}টা কাজ ফোনে রাখা আছে।`);
    if (failed) parts.push(`${bn(failed)}টা কাজ সার্ভার নেয়নি।`);
    root.replaceChildren(h('div', { class: 'de-banner de-banner--warn offline-banner', role: 'status' }, h('span', { class: 'offline-banner__row' }, icon(off ? 'wifioff' : 'clock'), h('span', { class: 'de-banner__text', text: parts.join(' ') })),
      count || failed ? h('span', { class: 'offline-banner__acts' },
        !off && count ? h('button', { class: 'de-savebar__action', type: 'button', onclick: () => flushNow(), text: 'এখনই পাঠান' }) : null,
        h('button', { class: 'de-savebar__action', type: 'button', onclick: () => openPending(), text: 'দেখুন' })) : null));
  };
  const recount = async () => { const rows = await outbox.list(session.uid()); count = rows.filter(r => r.state === 'waiting').length; failed = rows.filter(r => r.state === 'rejected').length; paint(); };
  const o1 = net.on(paint), o2 = outbox.on(recount);
  recount();
  return () => { o1(); o2(); };
}

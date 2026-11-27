// The teacher's "যোগাযোগ" tab: the ways to talk (guardians' messages, students' questions, notices, the office) above the inbox from step 1.
import { h } from '../../ui/dom.js';
import { navRow } from '../../ui/navrow.js';
import { bn } from '../../core/bn.js';
import { OFFICE_PHONE, OFFICE_PHONE_BN } from '../../core/config.js';
import { features } from '../../core/features.js';
import { inboxPage } from '../inbox/inbox.js';
import { loadDoubts } from './data.js';
import { openDoubts } from './logic.js';

export function teacherContact(ctx) {
  const doubtsRow = navRow({ ic: 'help', text: 'শিক্ষার্থীদের প্রশ্ন', sub: 'উত্তর দিন', onclick: () => ctx.go('/contact/doubts') });
  const top = h('div', { class: 'de-card more-card' },
    features.has('chat') ? navRow({ ic: 'chat', text: 'অভিভাবকদের সাথে বার্তা', sub: 'শিক্ষার্থী বেছে কথা বলুন', onclick: () => ctx.go('/contact/guardians') }) : null,
    doubtsRow,
    features.has('notices') ? navRow({ ic: 'bell', text: 'নোটিশ পাঠান', sub: 'অভিভাবক, শিক্ষার্থী বা শিক্ষকদের জানান', onclick: () => ctx.go('/contact/notice') }) : null,
    navRow({ ic: 'phone', text: 'অফিসে ফোন করুন', sub: OFFICE_PHONE_BN, href: 'tel:' + OFFICE_PHONE }));
  let gone = false;
  loadDoubts().then(r => {
    if (gone || r.kind !== 'ok') return;
    const n = openDoubts(r.data);
    if (n) doubtsRow.querySelector('.de-row__main').after(h('span', { class: 'de-chip de-chip--warn', text: `${bn(n)}টা বাকি` }));
  });
  const inbox = inboxPage(ctx);
  return { node: h('div', { class: 'contact' }, top, inbox.node), destroy() { gone = true; inbox.destroy?.(); } };
}

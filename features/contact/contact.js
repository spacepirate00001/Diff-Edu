// The "যোগাযোগ" tab of a guardian: ways to reach the coaching (teachers' chat for the chosen child, call or WhatsApp the office) above the inbox
// (notices, messages, daily notes, director's messages from step 1).
import { h } from '../../ui/dom.js';
import { navRow } from '../../ui/navrow.js';
import { icon } from '../../ui/icons.js';
import { kids } from '../../core/children.js';
import { features } from '../../core/features.js';
import { OFFICE_PHONE, OFFICE_PHONE_BN } from '../../core/config.js';
import { inboxPage } from '../inbox/inbox.js';

// wa.me wants the number with the country code and no plus sign
export const whatsappLink = phone => 'https://wa.me/88' + String(phone).replace(/\D/g, '').replace(/^88/, '');

export function contactTab(ctx) {
  const top = h('div', { class: 'contact-top' });
  const draw = () => {
    const kid = kids.current();
    top.replaceChildren(h('div', { class: 'de-card more-card' },
      kid ? navRow({ ic: 'chat', text: 'শিক্ষকদের সাথে কথা', sub: `${kid.name}-এর বিষয়ে বার্তা লিখুন`, onclick: () => ctx.go('/contact/chat') }) : null,
      kid && features.has('chat') ? navRow({ ic: 'people', text: 'বন্ধুদের সাথে সন্তানের চ্যাট', sub: 'পড়ুন, ঠিক না লাগলে জানান', onclick: () => ctx.go('/contact/friends') }) : null,
      navRow({ ic: 'phone', text: 'অফিসে ফোন করুন', sub: OFFICE_PHONE_BN, href: 'tel:' + OFFICE_PHONE }),
      h('a', { class: 'de-row more-row', href: whatsappLink(OFFICE_PHONE), target: '_blank', rel: 'noopener' }, h('span', { class: 'more-ic', 'aria-hidden': 'true' }, icon('chat')), h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: 'অফিসে WhatsApp করুন' }), h('span', { class: 'de-row__sub', text: 'বার্তা পাঠান, অফিস সময়মতো উত্তর দেবে' })), icon('chev'))));
  };
  draw();
  const off = kids.on(() => { if (top.isConnected) draw(); });
  if (!kids.list().length) kids.load({ maxAge: 15000 });
  const inbox = inboxPage(ctx);
  return { node: h('div', { class: 'contact' }, top, inbox.node), destroy() { off(); inbox.destroy?.(); } };
}

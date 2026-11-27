// P7: forgot PIN. No self-reset: the office gives a new PIN (then the "set your own PIN" screen comes).
import { h } from '../../ui/dom.js';
import { openSheet } from '../../ui/sheet.js';
import { icon } from '../../ui/icons.js';
import { OFFICE_PHONE, OFFICE_PHONE_BN } from '../../core/config.js';

export function callOfficeButton(text = 'ফোন করুন') {
  return h('a', { class: 'de-btn de-btn--primary', href: 'tel:' + OFFICE_PHONE }, icon('phone'), text);
}
export function openForgot() {
  const sheet = openSheet({
    title: 'পিন ভুলে গেছেন?',
    content: h('div', { class: 'sheet-col' },
      h('p', { class: 'sheet-text', text: 'অফিসে ফোন করে আপনার আইডি বলুন। নতুন পিন পাবেন, তারপর নিজের পিন বানিয়ে নেবেন।' }),
      h('p', { class: 'big-phone', text: OFFICE_PHONE_BN }),
      callOfficeButton(),
      h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: () => sheet.close(), text: 'ঠিক আছে' })),
  });
  return sheet;
}

// A short help page: three things people really ask, and the office number.
import { h } from '../../ui/dom.js';
import { callOfficeButton } from '../auth/forgot.js';
import { OFFICE_PHONE_BN, VERSION } from '../../core/config.js';
import { session } from '../../core/session.js';

// what a student asks (the plan's student part); the other roles see the three general answers only
const STUDENT_Q = [
  ['স্টার কীভাবে পাব?', 'কুইজ প্রথমবার খেললে ঠিক উত্তর অনুযায়ী স্টার পাবে (সর্বোচ্চ ১০টা)। ২৫ মিনিটের ফোকাস টাইমার শেষ করলেও স্টার মেলে।'],
  ['ভুল হলে কী হবে?', 'কিছুই খারাপ হবে না। কুইজের ভুল প্রশ্নগুলো "ভুলের খাতায়" জমা থাকে, কয়েক দিন পরে আবার দেখলেই শেখা পাকা হয়।'],
  ['ডিফি কে?', 'ডিফি তোমার পড়ার সঙ্গী। ডিফি তোমার নাম বা ছবি কাউকে পাঠায় না, আর শুধু পড়ার প্রশ্নের উত্তর দেয়।'],
  ['কেউ খারাপ কিছু লিখলে?', 'চ্যাটে বার্তার নিচে "জানাও" চাপো। শিক্ষক দেখবেন, বন্ধুকে বকা হবে না। চাইলে বন্ধুকে ব্লকও করতে পারো।'],
];

export function helpPage() {
  const q = (t, a) => h('section', { class: 'de-card' }, h('h2', { class: 'de-row__title', text: t }), h('p', { class: 'de-row__sub help-a', text: a }));
  const student = session.me()?.role === 'student';
  return { node: h('div', { class: 'help' },
    ...(student ? STUDENT_Q.map(([t, a]) => q(t, a)) : []),
    q('পিন ভুলে গেছি', 'অফিসে ফোন করে আপনার আইডি বলুন। নতুন পিন পাবেন, তারপর নিজের পিন বানিয়ে নেবেন।'),
    q('নেট নেই, কাজ কি হারাবে?', 'না। যা করেছেন ফোনে রাখা থাকে, নেট এলে নিজে থেকে চলে যায়। "আরও → ফোনে রাখা কাজ"-এ দেখতে পারবেন।'),
    q('লেখা ছোট লাগছে', '"আরও → দেখার ধরন"-এ গিয়ে "বড় লেখা" বেছে নিন।'),
    h('section', { class: 'de-card' }, h('h2', { class: 'de-row__title', text: 'অফিসের নম্বর' }), h('p', { class: 'big-phone', text: OFFICE_PHONE_BN }), callOfficeButton()),
    h('p', { class: 'more-ver', text: VERSION })) };
}

// A short help page: three things people really ask, and the office number.
import { h } from '../../ui/dom.js';
import { callOfficeButton } from '../auth/forgot.js';
import { OFFICE_PHONE_BN, VERSION } from '../../core/config.js';
import { session } from '../../core/session.js';

// what a student asks (the plan's student part); the other roles see the three general answers only
const STUDENT_Q = [
  ['স্টার কীভাবে পাব?', 'কুইজ প্রথমবার খেললে ঠিক উত্তর অনুযায়ী স্টার পাবে (সর্বোচ্চ ১০টা)। ২৫ মিনিটের ফোকাস টাইমার শেষ করলেও স্টার মেলে।'],
  ['ভুল হলে কী হবে?', 'টেনশন নেই! ভুল হলে নম্বর কাটার বদলে শেখার সুযোগ বাড়ে। ভুলগুলো তোমার "ভুল শুধরে নেওয়ার খাতা"-য় জমা থাকবে।'],
  ['ডিফি কে?', 'ডিফি তোমার পড়ার সঙ্গী। ডিফি তোমার নাম বা ছবি কাউকে পাঠায় না, আর শুধু পড়ার প্রশ্নের উত্তর দেয়।'],
  ['কেউ খারাপ কিছু লিখলে?', 'কেউ বিরক্ত করলে বা বাজে কিছু লিখলে বার্তার নিচে "জানাও" চাপো। স্যার ব্যাপারটা সামলে নেবেন, কাউকে বকাঝকা করা হবে না। চাইলে ব্লকও করতে পারো।'],
];

export function helpPage() {
  const q = (t, a) => h('section', { class: 'de-card' }, h('h2', { class: 'de-row__title', text: t }), h('p', { class: 'de-row__sub help-a', text: a }));
  const student = session.me()?.role === 'student';
  return { node: h('div', { class: 'help' },
    ...(student ? STUDENT_Q.map(([t, a]) => q(t, a)) : []),
    q('পিন ভুলে গেছি', 'নিরাপত্তার কারণে অ্যাপ থেকে সরাসরি পিন বদলানো যায় না। আপনার নিবন্ধিত নম্বর থেকে অফিসে ফোন করুন বা সরাসরি অফিসে আসুন। নতুন পিন পেলে নিজের পিন বানিয়ে নেবেন।'),
    q('নেট নেই, কাজ কি হারাবে?', 'না। যা করেছেন ফোনে রাখা থাকে, নেট এলে নিজে থেকে চলে যায়। "আরও → অফলাইন পেন্ডিং কাজ"-এ দেখতে পারবেন।'),
    q('লেখা ছোট লাগছে', '"আরও → থিম ও লেখার সাইজ"-এ গিয়ে "বড় লেখা" বেছে নিন।'),
    h('section', { class: 'de-card' }, h('h2', { class: 'de-row__title', text: 'অফিসের নম্বর' }), h('p', { class: 'big-phone', text: OFFICE_PHONE_BN }), callOfficeButton()),
    h('p', { class: 'more-ver', text: VERSION })) };
}

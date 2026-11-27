// "ফোনে খবর" (আরও): turn phone notifications on or off. Behind flag web_push (OFF). The browser's own permission prompt comes only AFTER the explanation below was confirmed.
// In fake mode (localhost) there is no real prompt or server: a simulated permission, subscription and test notification, so every state can be seen.
import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { toast } from '../../ui/toast.js';
import { stateCard, loading, unavailableState } from '../../ui/states.js';
import '../teacher/css.js';   // the page uses the teacher.css pieces (tc-*) for every role
import { pushReduce, currentPushState, askPermission, subscribeNow, unsubscribeNow, routeForPush } from '../../core/push.js';

export function pushPage(ctx) {
  const root = h('div', { class: 'tc-page', 'aria-live': 'polite' });
  let state = null;
  const set = s => { state = s; draw(); };
  const fire = e => { state = pushReduce(state, e); return state; };
  async function enableFlow() {
    set(fire('confirm'));                                   // explaining -> asking
    const p = await askPermission();                        // the browser prompt: reached only through the explanation above
    if (p !== 'granted') return set(fire('denied'));
    set(fire('granted'));                                   // asking -> subscribing
    const r = await subscribeNow();
    if (r === 'ok') { set(fire('subscribed')); return toast('নোটিফিকেশন চালু হয়েছে।'); }
    set(fire('failed')); toast(r === 'offline' ? 'নেট নেই। নেট চালু করে আবার চেষ্টা করুন।' : 'চালু করা যায়নি। আবার চেষ্টা করুন।');
  }
  async function disable() {
    const r = await unsubscribeNow();
    if (r !== 'ok') return toast('বন্ধ করা যায়নি। আবার চেষ্টা করুন।');
    set(fire('tap_disable')); toast('নোটিফিকেশন বন্ধ করা হয়েছে।');
  }
  function draw() {
    const back = h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: 'আরও-তে ফিরুন', onclick: () => ctx.goTab('more') });
    const note = (title, text, extra) => root.replaceChildren(stateCard({ kind: 'empty', title, text, extra, mascot: false }));
    if (state === null) return root.replaceChildren(loading(2));
    if (state === 'off') return root.replaceChildren(unavailableState('এই সুবিধা এখনো চালু হয়নি', () => ctx.goTab('more')));
    if (state === 'unsupported') return note('এই ফোনে নোটিফিকেশন চলে না', 'ব্রাউজার নোটিফিকেশন না দিলে সব খবর অ্যাপের ইনবক্সে ঠিকই পাবেন।', back);
    if (state === 'blocked') return root.replaceChildren(h('section', { class: 'de-card tc-card' }, h('h2', { class: 'tc-h', text: 'নোটিফিকেশন বন্ধ করা আছে' }), h('p', { class: 'tc-sub', text: 'ব্রাউজারে এই সাইটের নোটিফিকেশন আটকানো আছে। চালু করতে:' }),
      h('ol', { class: 'tc-points' }, h('li', { text: 'ব্রাউজারের ঠিকানার পাশের তালা বা সেটিং চিহ্নে চাপুন।' }), h('li', { text: '"নোটিফিকেশন" খুঁজে "অনুমতি দিন" করুন।' }), h('li', { text: 'তারপর এখানে ফিরে আবার চেষ্টা করুন।' })),
      h('button', { class: 'de-btn de-btn--primary', type: 'button', text: 'আবার দেখুন', onclick: refresh })));
    if (state === 'on') return root.replaceChildren(h('section', { class: 'de-card tc-card' }, h('div', { class: 'tc-row' }, icon('bell'), h('h2', { class: 'tc-h', text: 'নোটিফিকেশন চালু আছে' })), h('p', { class: 'tc-sub', text: 'নতুন নোটিশ বা বার্তা এলে এই ফোনে খবর আসবে। চাপলে সেই খবর খুলবে।' }),
      window.DeFake ? h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: 'পরীক্ষামূলক খবর দেখুন (নকল)', onclick: () => toast('নতুন নোটিশ এসেছে। এখানে চাপুন।', { ms: 6000, action: 'খুলুন', onAction: () => ctx.go(routeForPush({ kind: 'notice' })) }) }) : null,
      h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: 'বন্ধ করুন', onclick: disable })));
    if (state === 'explaining' || state === 'asking' || state === 'subscribing') {
      const busy = state !== 'explaining';
      return root.replaceChildren(h('section', { class: 'de-card tc-card', 'aria-label': 'নোটিফিকেশন কী করে' }, h('h2', { class: 'tc-h', text: 'নোটিফিকেশন চালু করলে কী হবে' }),
        h('ul', { class: 'tc-points' }, h('li', { text: 'নতুন নোটিশ বা বার্তা এলে ফোনের স্ক্রিনে ছোট খবর আসবে। চাপলে সরাসরি সেই খবর খুলবে।' }), h('li', { text: 'এটা বিনামূল্যে।' }), h('li', { text: 'শুধু এই ফোনে, এই অ্যাপের জন্য। যখন ইচ্ছা "আরও" থেকে বন্ধ করতে পারবেন।' }),
          h('li', { text: 'সার্ভারে শুধু এই ফোনের একটা ঠিকানা রাখা হয়। আপনার নাম, নম্বর বা ছবি এতে যায় না।' })),
        h('p', { class: 'tc-cap', text: 'এরপর আপনার ফোন অনুমতি চাইবে। "অনুমতি দিন" বা "Allow" চাপুন।' }),
        h('button', { class: 'de-btn de-btn--primary', type: 'button', disabled: busy, text: busy ? 'একটু অপেক্ষা…' : 'হ্যাঁ, অনুমতি চাইব', onclick: enableFlow }),
        h('button', { class: 'de-btn de-btn--secondary', type: 'button', disabled: busy, text: 'না, এখন না', onclick: () => set(fire('cancel')) })));
    }
    if (state === 'error') return root.replaceChildren(stateCard({ kind: 'error', title: 'চালু করা যায়নি', text: 'নেট দেখে আবার চেষ্টা করুন।', action: 'আবার চেষ্টা করুন', onAction: () => set(fire('tap_enable')), mascot: false }));
    return root.replaceChildren(h('section', { class: 'de-card tc-card' }, h('h2', { class: 'tc-h', text: 'ফোনে খবর পান' }), h('p', { class: 'tc-sub', text: 'অ্যাপ বন্ধ থাকলেও নতুন নোটিশ বা বার্তার খবর ফোনের স্ক্রিনে আসবে। চালু করার আগে সব বুঝিয়ে বলা হবে।' }),
      h('button', { class: 'de-btn de-btn--primary', type: 'button', text: 'নোটিফিকেশন চালু করুন', onclick: () => set(fire('tap_enable')) })));
  }
  async function refresh() { state = await currentPushState(); draw(); }
  draw(); refresh();
  return { node: root };
}

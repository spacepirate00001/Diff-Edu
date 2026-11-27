// "অটোমেশনের নিয়ম" (read only): which messages the server sends by itself, to whom, when, and whether silent mode is holding them. The most important line comes
// first: what saving attendance does RIGHT NOW. Nothing on this screen can switch silent mode, SMS or anything else (the admin does that on the server).
import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { dataPage } from '../../ui/datapage.js';
import { loadAutomation, headline, rulesFor, STATE_CHIP } from '../../core/automation.js';

export function automationPage() {
  return dataPage({
    key: 'automation',
    load: async () => { const r = await loadAutomation(); return r.kind === 'ok' ? { kind: 'ok', data: r.status } : r.kind === 'offline' ? { kind: 'offline' } : { kind: 'ok', data: r.status }; },
    isEmpty: () => false,
    draw: s => {
      const hd = headline(s);
      return [h('section', { class: 'tc-big tc-big--' + hd.tone, 'aria-label': 'এখন কী হচ্ছে' }, h('b', { text: hd.title }), h('p', { text: hd.text })),
        h('section', { class: 'de-card tc-card' }, h('h2', { class: 'tc-h', text: 'হাজিরা নিলে কী হয়' }),
          h('ul', { class: 'tc-points' }, h('li', { text: 'আপনি হাজিরা সংরক্ষণ করলে সেটা শিক্ষার্থীর হাজিরায় লেখা হয় আর রিপোর্ট কার্ডে যোগ হয়।' }),
            h('li', { text: s.known && s.silent_mode === false ? 'চুপ মোড বন্ধ, তাই "এসেছে" খবর অভিভাবকের অ্যাপে যাবে।' : s.known ? 'চুপ মোড চালু, তাই অভিভাবকের কাছে খবর যাবে না। শুধু অফিস চুপ মোড বন্ধ করতে পারে।' : 'চুপ মোড জানা নেই, তাই ধরে নিন খবর যেতে পারে।' }),
            h('li', { text: 'এই পাতা থেকে চুপ মোড বা এসএমএস চালু বা বন্ধ করা যায় না। এটা শুধু দেখার জন্য।' }))),
        h('h2', { class: 'tc-h', text: 'কোন খবর কখন যায়' }),
        h('div', { class: 'de-card' }, h('ul', { class: 'tc-list' }, ...rulesFor(s).map(r => { const [tone] = STATE_CHIP[r.state];
          return h('li', { class: 'tc-rule' }, h('div', { class: 'tc-row' }, h('b', { class: 'tc-grow', text: r.title }), h('span', { class: 'de-chip de-chip--' + tone, text: r.stateText })),
            h('dl', null, h('dt', { text: 'কাকে' }), h('dd', { text: r.who }), h('dt', { text: 'কখন' }), h('dd', { text: r.when }), h('dt', { text: 'কীভাবে' }), h('dd', { text: r.how }))); }))),
        h('p', { class: 'tc-cap', text: 'নিয়মের সময়সীমা ও সীমা (যেমন ১৫ মিনিট) অফিস বদলায়, কোড বদলাতে হয় না। কোন খবর কখন গেল তার হিসাব সার্ভারে থাকে।' }),
        h('p', { class: 'tc-cap' }, icon('info'), ' সন্দেহ হলে অভিভাবকের কাছে খারাপ খবর ("আসেনি", "বের হয়ে গেছে") যায় না: আগে মানুষ দেখে।')];
    },
  });
}

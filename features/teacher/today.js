// The teacher's "আজ": the greeting, the class that is on now, what is left to do today, camera items waiting for a yes / no, who was absent (with the call sheet),
// then every class of the day. Real data (class_periods, period_attendance, class_ratings, attendance needs_review, homework); each part has its own states.
import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { toast } from '../../ui/toast.js';
import { saveBar } from '../../ui/savebar.js';
import { confirmBox } from '../../ui/dialog.js';
import { stateCard } from '../../ui/states.js';
import { dataPage } from '../../ui/datapage.js';
import { sky } from '../../core/sky.js';
import { session } from '../../core/session.js';
import { bn, dhakaDate } from '../../core/bn.js';
import { firstName } from '../../core/student-self.js';
import { currentPeriod, leftToDo, reviewCall } from './logic.js';
import { loadRoutine, loadDayState, loadReview, resolveReview, homeworkPostedToday } from './data.js';
import { periodCard, noRoutine } from './class.js';
import { periodUrl } from './attend.js';
import { openCallSheet } from './call.js';
import { silentLine, periodName } from './ui.js';

const WX = { clear: 'পরিষ্কার আকাশ', partly: 'আংশিক মেঘলা', overcast: 'মেঘলা', fog: 'কুয়াশা', drizzle: 'গুঁড়ি গুঁড়ি বৃষ্টি', rain: 'বৃষ্টি', storm: 'ঝড়-বৃষ্টি', hot: 'প্রচণ্ড গরম', cool: 'শীতল আবহাওয়া' };
const GREET = { dawn: 'শুভ সকাল', morning: 'শুভ সকাল', noon: 'শুভ দুপুর', afternoon: 'শুভ অপরাহ্ন', dusk: 'শুভ সন্ধ্যা', twilight: 'শুভ সন্ধ্যা', night: 'শুভ রাত্রি' };

function reviewCard(ctx, items, onChange) {
  const list = h('ul', { class: 'tc-list' });
  const draw = () => {
    list.replaceChildren(...items.map(it => h('li', { class: 'tc-review' },
      h('div', { class: 'tc-row' }, h('div', { class: 'tc-grow' }, h('b', { text: it.name }), h('p', { class: 'tc-cap', text: `${it.level ? 'ক্লাস ' + bn(it.level) + ' · ' : ''}${it.roll != null ? 'রোল ' + bn(it.roll) + ' · ' : ''}মিল ${bn(it.pct)}%` })), h('span', { class: 'de-chip de-chip--warn', text: 'যাচাই বাকি' })),
      h('div', { class: 'tc-wrap' },
        h('button', { class: 'de-btn de-btn--primary', type: 'button', 'aria-label': `${it.name}: ঠিক আছে, এসেছে`, text: 'ঠিক আছে', onclick: () => decide(it, true) }),
        h('button', { class: 'de-btn de-btn--secondary', type: 'button', 'aria-label': `${it.name}: ভুল শনাক্ত`, text: 'ভুল', onclick: () => decide(it, false) })))));
    if (!items.length) list.replaceChildren(h('li', null, h('p', { class: 'tc-sub', text: 'যাচাইয়ের কিছু নেই।' })));
  };
  async function decide(it, accept) {
    if (accept && !await confirmBox({ title: `${it.name}: ঠিক আছে?`, text: 'এসেছে বলে ধরা হবে। অফিস চুপ মোড বন্ধ করলে অভিভাবকের কাছে "এসেছে" খবর যাবে।', ok: 'হ্যাঁ, ঠিক আছে', cancel: 'না' })) return;
    const i = items.indexOf(it); items.splice(i, 1); draw(); onChange();
    const state = await resolveReview(reviewCall(it.id, accept));
    if (state === 'failed' || state === 'rejected') { items.splice(i, 0, it); draw(); onChange(); saveBar.show(state, { onRetry: () => decide(it, accept) }); return; }
    saveBar.show(state, { text: state === 'saved' ? (accept ? 'ঠিক আছে বলা হয়েছে' : 'ভুল বলা হয়েছে') : undefined });
  }
  draw();
  return h('section', { class: 'de-card tc-card', 'aria-label': 'ক্যামেরার সন্দেহ' }, h('h2', { class: 'tc-h', text: 'ক্যামেরা যাচাই' }), h('p', { class: 'tc-cap', text: 'মুখ পুরো মেলেনি। আপনি "ঠিক" বা "ভুল" না বলা পর্যন্ত অভিভাবকের কাছে কিছু যায় না।' }), list);
}

export function teacherToday(ctx) {
  const line = h('p', { class: 'staff-wx' }), hi = h('h2', { class: 'staff-hi' });
  const paint = () => {
    const t = sky.apply(); if (!t) return;
    hi.textContent = `${sky.greet(GREET[t.phase])}, ${firstName(ctx.me.full_name)}`;
    line.textContent = sky.hasReal() ? bn(`${WX[t.cls]} · ${Math.round(sky.input().temperature_c)}°সে.`) : ''; line.hidden = !line.textContent;
  };
  paint(); const off = sky.subscribe(paint);
  const body = dataPage({
    key: 'tday',
    load: async () => {
      const rt = await loadRoutine(session.uid()); if (rt.kind !== 'ok') return rt;
      const [ds, rv, hw] = await Promise.all([loadDayState(rt.data.periods), loadReview(), homeworkPostedToday()]);
      if (ds.kind !== 'ok') return ds;
      return { kind: 'ok', data: { periods: rt.data.periods, state: ds.data.state, absent: ds.data.absent, review: rv.kind === 'ok' ? rv.data : null, hw } };
    },
    isEmpty: () => false,
    draw: ({ periods, state, absent, review, hw }, reload) => {
      const cur = currentPeriod(periods, sky.minutes());
      const todo = leftToDo({ periods, state, review: review?.length || 0, homeworkToday: hw });
      const out = [silentLine(ctx)];
      if (!periods.length) out.push(noRoutine(ctx));
      else if (cur) out.push(h('div', { class: 'tc-page' }, h('h2', { class: 'tc-h', text: 'এখনকার ক্লাস' }), periodCard(ctx, cur, state[cur.key], periods)));
      const goFor = t => ctx.go(t.kind === 'attendance' ? periodUrl('/class/attend', t.p.shift, t.p.slot) : t.kind === 'rating' ? periodUrl('/class/rate', t.p.shift, t.p.slot) : t.kind === 'homework' ? '/class/homework' : '/today');
      out.push(h('section', { class: 'de-card tc-card', 'aria-label': 'আজ যা বাকি' }, h('h2', { class: 'tc-h', text: 'আজ যা বাকি' }),
        todo.length ? h('ul', { class: 'tc-list' }, ...todo.map(t => h('li', null, h('button', { class: 'de-row more-row', type: 'button', onclick: () => (t.kind === 'review' ? document.getElementById('tc-review')?.scrollIntoView({ block: 'start' }) : goFor(t)) },
          h('span', { class: 'more-ic', 'aria-hidden': 'true' }, icon(t.kind === 'review' ? 'alert' : t.kind === 'homework' ? 'book' : t.kind === 'rating' ? 'star' : 'check')), h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: t.text })), icon('chev')))))
          : h('p', { class: 'tc-sub', text: periods.length ? 'আজকের সব কাজ শেষ। ধন্যবাদ স্যার/ম্যাডাম।' : 'আজ রুটিনে আপনার ক্লাস নেই, তাই বাকি কিছু নেই।' })));
      if (review?.length) { const c = reviewCard(ctx, review, () => reload()); c.id = 'tc-review'; out.push(c); }
      else if (review === null) out.push(h('p', { class: 'tc-cap', text: 'ক্যামেরার যাচাই এখন আনা যায়নি।' }));
      if (absent.length) out.push(h('section', { class: 'de-card tc-card', 'aria-label': 'আজ অনুপস্থিত' }, h('h2', { class: 'tc-h', text: `আজ অনুপস্থিত (${bn(absent.length)} জন)` }), h('p', { class: 'tc-cap', text: 'চাপলে অভিভাবকের নম্বর খুলবে।' }),
        h('ul', { class: 'tc-list' }, ...absent.map(a => h('li', null, h('button', { class: 'de-row more-row', type: 'button', 'aria-label': `${a.name}: অভিভাবককে ফোন`, onclick: () => openCallSheet({ id: a.id, name: a.name }) },
          h('span', { class: 'more-ic', 'aria-hidden': 'true' }, icon('phone')), h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: a.name }), h('span', { class: 'de-row__sub', text: `${periodName(a.p)} · রোল ${bn(a.roll)}` })), icon('chev')))))));
      if (periods.length) out.push(h('div', { class: 'tc-page' }, h('h2', { class: 'tc-h', text: 'আজকের সব ক্লাস' }), ...periods.map(p => periodCard(ctx, p, state[p.key], periods))));
      return out;
    },
  });
  const root = h('div', { class: 'today-root staff' }, h('div', { class: 'staff-head' }, h('span', { class: 'sr-only', text: dhakaDate() }), hi, line, h('p', { class: 'staff-date', text: dhakaDate() })), h('div', { class: 'v6-cards staff-cards tc-page' }, body.node));
  return { node: root, chrome: 'bar', destroy() { off(); body.destroy(); } };
}
export { toast };

// The "আজ" tab. Guardian: the approved v7 screen (features/today/v7.js) on real data (rpc today_guardian) mapped to its shape.
// Student: features/student/today.js. Teacher / admin: a plain bar, one weather line, the day's counts.
import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { bn, dhakaDate, clockText, shortDate, dhakaDay } from '../../core/bn.js';
import { kids } from '../../core/children.js';
import { cache } from '../../core/cache.js';
import { rpc } from '../../core/api.js';
import { session } from '../../core/session.js';
import { sky } from '../../core/sky.js';
import { featuresFor, visible } from '../search/registry.js';
import { features } from '../../core/features.js';
import { tabById } from '../../roles/tabs.js';
import { stateCard } from '../../ui/states.js';
import { OFFICE_PHONE } from '../../core/config.js';
import { flags } from '../../core/flags.js';
import { loadExtras } from './extras.js';

export const CLASS_BN = ['', 'প্রথম', 'দ্বিতীয়', 'তৃতীয়', 'চতুর্থ', 'পঞ্চম', 'ষষ্ঠ', 'সপ্তম', 'অষ্টম', 'নবম', 'দশম'];
export const classLabel = n => (CLASS_BN[n] ? CLASS_BN[n] + ' শ্রেণি' : '');
export const firstName = full => String(full || '').trim().split(/\s+/)[0] || '';
// First letter with its vowel sign, e.g. "তা" for "তাসনিম".
export function initialsOf(name) {
  const cs = Array.from(String(name || '').trim());
  if (!cs.length) return '';
  return cs[1] && /[া-ৌৗঁ-ঃ]/.test(cs[1]) ? cs[0] + cs[1] : cs[0];
}
const whenLabel = (iso, now) => { const d = dhakaDay(iso), t = dhakaDay(now); return d === t ? 'আজ' : d === dhakaDay(new Date(now).getTime() - 864e5) ? 'গতকাল' : shortDate(iso); };

// The real contract (rpc today_guardian) -> the shape v7.js draws. Fields the server does not send are simply left out, and v7 hides those cards.
export function adapt(today, { me, unread = 0, now = Date.now(), extras = {} } = {}) {
  const children = (kids.list() || []).map(k => ({ id: k.id, name: k.name, initials: initialsOf(k.name), class_label: classLabel(k.class_level), photo_url: null, guardian_call: firstName(me?.full_name) }));
  const by_child = {};
  for (const k of children) {
    const c = today?.children?.find(x => x.student_id === k.id);
    const ex = extras[k.id] || {}, pv = { ...ex.preview, ...(ex.nudges ? { nudges: ex.nudges } : {}), ...(ex.homework ? { homework: ex.homework } : {}), ...(c?.preview || {}) };   // what the server sends wins; the rest fills in
    const status = !c ? 'none' : c.attendance === 'present' ? 'present' : c.attendance === 'absent' ? 'absent' : 'none';
    const info = { today: { status, arrived_at: status === 'present' && c?.checked_in_at ? clockText(c.checked_in_at) : null, score: pv.score ?? null, score_max: pv.score_max ?? null, teacher_note: pv.teacher_note || null } };
    for (const f of ['week', 'trend', 'streak_days', 'next_class', 'homework', 'nudges']) if (pv[f] !== undefined) info[f] = pv[f];
    if (c?.latest_notice) info.latest_notice = { id: c.latest_notice.id, text: c.latest_notice.title, when_label: whenLabel(c.latest_notice.created_at, now) };
    if (c?.fees_unpaid?.months > 0) info.fee = { month_label: `${bn(c.fees_unpaid.months)} মাসের ফি বাকি`, amount: Number(c.fees_unpaid.due), due_label: 'অফিসে জমা দিন', status: 'due' };
    if (ex.fee) info.fee = ex.fee;                // this month's fee with its due date, from the fee rows
    by_child[k.id] = info;
  }
  return { children, date_label: dhakaDate(now), unread_messages: unread, by_child };
}

// ---- the sky header (same markup as the approved screen) ----
const cloud = c => h('i', { class: 'v6-cloud v6-cloud--' + c, 'aria-hidden': 'true' });
export function skyHeader({ child, actions }) {
  return h('header', { class: 'v6-sky', id: 'v6-sky', 'data-phase': 'morning' },
    h('i', { class: 'v6-stars', 'aria-hidden': 'true' }), h('i', { class: 'v6-fog', 'aria-hidden': 'true' }), cloud('a'), cloud('b'), cloud('c'), cloud('d'),
    h('i', { class: 'v6-rain', 'aria-hidden': 'true' }), h('i', { class: 'v6-flash', 'aria-hidden': 'true' }),
    h('div', { class: 'v6-brand' },
      h('span', { class: 'v6-logo' }, h('img', { src: 'ui/assets/diff-edu-logo.svg', alt: '', width: '22', height: '29' })),
      h('span', { class: 'v6-brand__t' }, h('b', { text: 'Diff Edu' }), h('span', { text: 'SINCE ২০০৯' })),
      h('div', { class: 'sky-actions' }, ...actions)),
    child ? h('div', { class: 'v6-child' }, h('span', { class: 'de-avatar v6-avatar', id: 'tg-avatar', 'aria-hidden': 'true' }),
      h('div', { class: 'v6-child__t' }, h('button', { type: 'button', id: 'tg-child', class: 'tg-child v6-childbtn', disabled: true, text: 'লোড হচ্ছে…' }), h('span', { class: 'v6-child__sub', id: 'tg-sub' }))) : null,
    h('p', { class: 'v6-greet', id: 'v6-greet', tabindex: '-1' }), h('p', { class: 'v6-wx', id: 'v6-wx' }),
    h('div', { class: 'v7-stage', id: 'v7-stage', 'aria-hidden': 'true' },
      h('svg', { class: 'v7-track', viewBox: '0 0 100 132', preserveAspectRatio: 'none', focusable: 'false' }, h('path', { id: 'v7-track', 'vector-effect': 'non-scaling-stroke' })),
      h('i', { class: 'v6-orb v6-sun', id: 'v6-sun' }), h('i', { class: 'v6-orb v6-moon', id: 'v6-moon' })));
}
export function skyButtons(ctx) {
  return [
    h('button', { class: 'sky-btn', type: 'button', 'aria-label': 'খোঁজা', onclick: ctx.openSearch }, icon('search')),
    h('button', { class: 'sky-btn bell', type: 'button', 'aria-label': ctx.unread() ? `ইনবক্স, ${bn(ctx.unread())}টা নতুন` : 'ইনবক্স', onclick: ctx.openInbox }, icon('bell'),
      ctx.unread() ? h('span', { class: 'de-badge bell__n', 'aria-hidden': 'true', text: bn(ctx.unread()) }) : null),
  ];
}
const comingCard = (ctx, tab) => {
  const list = featuresFor(ctx.me.role, tab).filter(f => visible(f, features));
  const step = Math.min(...list.map(f => f.step), 9);
  return h('section', { class: 'v6-card coming' }, h('span', { class: 'de-row__title', text: 'আজকের পাতা আসছে' }),
    h('span', { class: 'de-row__sub', text: list.length ? `ধাপ ${bn(step)}-এ এখানে আসবে:` : 'এই অংশ শিগগিরই আসছে।' }),
    list.length ? h('ul', { class: 'coming__list' }, ...list.map(f => h('li', { 'aria-disabled': 'true', text: f.name }))) : null);
};

// ---- guardian ----
export function guardianToday(ctx) {
  let extras = {};
  const root = h('div', { class: 'today-root' });
  const wrapCards = h('div', { class: 'v6-cards', id: 'tg-cards', 'aria-live': 'polite' });
  root.append(skyHeader({ child: true, actions: skyButtons(ctx) }), wrapCards);
  window.DeToday = {
    // -> { kind: 'ok', data } | { kind: 'offline' | 'error' }
    async load() {
      const r = await kids.load({ maxAge: 15000 });
      if (r.kind !== 'ok' && !kids.list().length) return { kind: r.kind === 'offline' ? 'offline' : 'error' };
      extras = r.stale ? extras : await loadExtras(kids.list()).catch(() => extras);
      const d = adapt(kids.today(), { me: ctx.me, unread: ctx.unread(), extras });
      if (r.stale) { d.stale = true; return { kind: r.kind === 'offline' ? 'offline' : 'error', data: d }; }
      return { kind: 'ok', data: d };
    },
    cached() { return kids.today() || kids.list().length ? adapt(kids.today(), { me: ctx.me, unread: ctx.unread(), extras }) : null; },
    store() { /* the copy is kept by core/children.js */ },
    childId: () => kids.current()?.id || null,
    openSwitcher: ctx.openSwitcher,
    officePhone: OFFICE_PHONE,
    unread: n => ctx.setUnread?.(n),
    // the fee card opens the fees page; the ask-ডিফি button shows only when the chat is on (flag diffy_chat, or fake mode)
    openFees: () => ctx.go('/more/fees'),
    askDiffy: null,
  };
  import('../diffy/diffy-chat.js').then(m => { if (m.diffyAvailable()) { window.DeToday.askDiffy = opener => m.openDiffy({ ctx, kid: kids.current(), opener }); window.TodayV7?.refresh?.(); } });
  const offKids = kids.on(id => window.TodayV7?.setChild(id));
  return { node: root, chrome: 'sky', onMount: () => window.TodayV7.start(), destroy() { window.TodayV7.stop(); offKids(); } };
}

// ---- teacher / admin: no stage, one weather line, counts for the admin ----
const WX = { clear: 'পরিষ্কার আকাশ', partly: 'আংশিক মেঘলা', overcast: 'মেঘলা', fog: 'কুয়াশা', drizzle: 'গুঁড়ি গুঁড়ি বৃষ্টি', rain: 'বৃষ্টি', storm: 'ঝড়-বৃষ্টি', hot: 'প্রচণ্ড গরম', cool: 'শীতল আবহাওয়া' };
export function staffToday(ctx) {
  const line = h('p', { class: 'staff-wx' });
  const hi = h('h2', { class: 'staff-hi' });
  const paint = () => {
    const t = sky.apply(); if (!t) return;
    hi.textContent = `${sky.greet(({ dawn: 'শুভ সকাল', morning: 'শুভ সকাল', noon: 'শুভ দুপুর', afternoon: 'শুভ অপরাহ্ন', dusk: 'শুভ সন্ধ্যা', twilight: 'শুভ সন্ধ্যা', night: 'শুভ রাত্রি' })[t.phase])}, ${firstName(ctx.me.full_name)}`;
    line.textContent = sky.hasReal() ? bn(`${WX[t.cls]} · ${Math.round(sky.input().temperature_c)}°সে.`) : '';
    line.hidden = !line.textContent;
  };
  paint();
  const off = sky.subscribe(paint);
  const todo = h('div', { class: 'staff-todo' });
  const root = h('div', { class: 'today-root staff' }, h('div', { class: 'staff-head' }, h('span', { class: 'sr-only', text: dhakaDate() }), hi, line, h('p', { class: 'staff-date', text: dhakaDate() })),
    h('div', { class: 'v6-cards staff-cards' }, todo, comingCard(ctx, 'today')));
  if (ctx.me.role === 'admin') adminCounts(todo);
  return { node: root, chrome: 'bar', destroy: off };
}
async function adminCounts(box) {
  const uid = session.uid();
  const res = await rpc('today_admin');
  let d = res.kind === 'ok' ? res.data : null;
  if (d) cache.set(uid, 'today_admin', d); else d = cache.get(uid, 'today_admin')?.v;
  if (!d) return;
  const row = (n, text) => h('li', { class: 'todo-row' }, h('span', { class: 'de-chip ' + (n ? 'de-chip--warn' : 'de-chip--plain'), text: bn(n) }), h('span', { text }));
  box.append(h('section', { class: 'v6-card' }, h('span', { class: 'de-row__title', text: 'আজকের করণীয়' }), h('ul', { class: 'todo' },
    row(d.needs_review || 0, 'অনুমোদনের অপেক্ষায়'), row(d.early_leave_open || 0, 'আগে ছুটির খবর খোলা'), row(d.fee_call || 0, 'ফি তাগাদা তালিকা'),
    row(d.chat_reports_open || 0, 'চ্যাট রিপোর্ট'), row(d.report_drafts || 0, 'রিপোর্ট কার্ড খসড়া'))));
}
export { stateCard, tabById };

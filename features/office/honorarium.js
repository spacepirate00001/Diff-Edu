// "সম্মানী": the admin sees every teacher's month (classes taken x rate), sets the rate and pays; a teacher logs the classes taken (one tap) and watches their own month.
// A paid month is locked for the teacher. The admin pays with the numbers on the screen (the row is written once per teacher and month).
import { h } from '../../ui/dom.js';
import { chip, chipRow } from '../../ui/chip.js';
import { field } from '../../ui/field.js';
import { openSheet } from '../../ui/sheet.js';
import { confirmBox } from '../../ui/dialog.js';
import { toast } from '../../ui/toast.js';
import { saveBar } from '../../ui/savebar.js';
import { dataPage } from '../../ui/datapage.js';
import { stateCard } from '../../ui/states.js';
import { icon } from '../../ui/icons.js';
import { bn, money, shortDate } from '../../core/bn.js';
import { avatar } from '../teacher/ui.js';
import { loadRoutine } from '../teacher/data.js';
import { shiftName, slotName } from '../teacher/logic.js';
import { session } from '../../core/session.js';
import { honorCards, payableTotal, validateRate, validateLabel, periodLabel, canEditLog, logDays, monthName, LOG_BACK_DAYS } from './logic.js';
import { loadHonor, saveRate, payTeacher, loadMyHonor, addClassLog, removeClassLog, today } from './data.js';
import { monthBar, nowKey } from './ui.js';

// ---------- admin ----------
export function adminHonorPage() {
  let key = nowKey();
  const page = dataPage({
    key: null,
    load: () => loadHonor(key),
    isEmpty: d => !d.teachers.length,
    empty: () => stateCard({ kind: 'empty', title: 'কোনো শিক্ষক পাওয়া যায়নি', text: 'অ্যাকাউন্ট তৈরি হলে এখানে আসবে।' }),
    draw: (d, reload) => {
      const cards = honorCards(d), tot = payableTotal(cards);
      const card = c => h('section', { class: 'de-card tc-card' },
        h('div', { class: 'tc-row' }, avatar(c.name), h('div', { class: 'tc-grow' }, h('h2', { class: 'tc-h', text: c.name }),
          h('p', { class: 'tc-cap', text: c.paid ? `পরিশোধিত: ${bn(c.paid.classes)} ক্লাস, ${money(c.paid.amount)}` : c.noRate ? `${bn(c.classes)} ক্লাস নিয়েছেন, হার ঠিক করা নেই` : c.rate > 0 ? `${bn(c.classes)} ক্লাস × ${money(c.rate)} = ${money(c.amount)}` : 'এ মাসে কোনো ক্লাস নেই' })),
          h('span', { class: 'de-chip ' + (c.paid ? 'de-chip--good' : c.canPay ? 'de-chip--warn' : ''), text: c.paid ? 'পরিশোধিত' : c.canPay ? 'বাকি' : '—' })),
        h('div', { class: 'tc-actions' },
          c.paid ? null : h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: () => rateSheet(c, reload) }, c.rate > 0 ? `হার: ${money(c.rate)}` : 'হার দিন'),
          c.canPay ? h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: () => payOne(c, key, reload) }, `${money(c.amount)} পরিশোধ`) : null));
      return h('div', { class: 'tc-page' }, monthBar(key, k => { key = k; reload(); }),
        h('section', { class: 'de-card tc-card' }, h('p', { class: 'tc-big tc-big--' + (tot.n ? 'warn' : 'good'), text: tot.n ? `${money(tot.amount)} দেওয়া বাকি` : 'এ মাসের সব সম্মানী মিটেছে' }),
          h('p', { class: 'tc-cap', text: tot.n ? `${bn(tot.n)} জন শিক্ষকের` : 'দেওয়ার মতো কিছু বাকি নেই' }),
          tot.n > 1 ? h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: () => payAll(cards, key, reload) }, `সবাইকে পরিশোধ (${bn(tot.n)} জন)`) : null),
        d.partial ? h('p', { class: 'tc-cap', text: 'হার বা পরিশোধের তথ্য পুরো আনা যায়নি।' }) : null,
        ...cards.map(card),
        h('p', { class: 'tc-cap', text: 'নেওয়া ক্লাসের হিসাব অনুযায়ী সম্মানী নির্ধারিত হয়। হিসাব পরিশোধ হয়ে গেলে ওই মাসের এন্ট্রি আর পরিবর্তন করা যাবে না।' }));
    },
  });
  return page;
}
function rateSheet(c, reload) {
  const rate = field({ label: 'প্রতি ক্লাসের টাকা', inputmode: 'decimal', value: c.rate > 0 ? String(c.rate) : '' }), go = h('button', { class: 'de-btn de-btn--primary', type: 'button', text: 'হার সংরক্ষণ করুন' });
  const sheet = openSheet({ title: `${c.name}-এর সম্মানীর হার`, content: h('div', { class: 'sheet-col' }, rate.el, go) });
  go.addEventListener('click', async () => {
    const v = validateRate(rate.input.value); rate.error(v.ok ? '' : v.why); if (!v.ok) return;
    go.disabled = true; const st = await saveRate(c.id, v.value); go.disabled = false;
    if (st === 'failed' || st === 'rejected') return saveBar.show(st, { onRetry: () => go.click() });
    sheet.close(); saveBar.show(st, { text: st === 'saved' ? 'হার সংরক্ষিত হয়েছে' : undefined }); reload();
  });
}
async function payOne(c, key, reload) {
  if (!await confirmBox({ title: 'সম্মানী পরিশোধ?', text: `${c.name}: ${bn(c.classes)} ক্লাস × ${money(c.rate)} = ${money(c.amount)} (${monthName(key)})। পরিশোধের পর এই মাস বদলানো যাবে না।${key >= nowKey() ? ' মাস এখনো শেষ হয়নি।' : ''}`, ok: 'হ্যাঁ, পরিশোধ করুন', cancel: 'আবার দেখি' })) return;
  const st = await payTeacher({ teacher_id: c.id, key, classes: c.classes, amount: c.amount });
  if (st === 'failed' || st === 'rejected') return saveBar.show(st, { onRetry: () => payOne(c, key, reload) });
  saveBar.show(st, { text: st === 'saved' ? 'পরিশোধ হয়েছে' : undefined }); reload();
}
async function payAll(cards, key, reload) {
  const t = payableTotal(cards);
  if (!await confirmBox({ title: 'সবাইকে পরিশোধ?', text: `${bn(t.n)} জন শিক্ষকের মোট ${money(t.amount)} (${monthName(key)}) পরিশোধ হিসেবে লেখা হবে। পরে বদলানো যাবে না।`, ok: 'হ্যাঁ, সবাইকে', cancel: 'আবার দেখি' })) return;
  let bad = 0;
  for (const c of cards.filter(x => x.canPay)) { const st = await payTeacher({ teacher_id: c.id, key, classes: c.classes, amount: c.amount }); if (st === 'failed' || st === 'rejected') bad++; }
  if (bad) toast(`${bn(bad)} জনের পরিশোধ যায়নি, আবার চাপুন।`); else saveBar.show('saved', { text: 'সবার সম্মানী পরিশোধ হয়েছে' });
  reload();
}

// ---------- teacher ----------
export function teacherHonorPage() {
  let key = nowKey();
  const names = { shift: shiftName, slot: slotName };
  return dataPage({
    key: null,
    load: async () => { const [m, r] = await Promise.all([loadMyHonor(key), loadRoutine(session.uid())]); return m.kind === 'ok' ? { kind: 'ok', data: { ...m.data, periods: r.kind === 'ok' ? r.data.periods : [] } } : m; },
    isEmpty: () => false,
    draw: (d, reload) => {
      const t = today(), n = d.logs.length, amount = d.rate > 0 ? n * d.rate : null, locked = !!d.paid;
      const addBox = h('div');
      const add = async (day, label) => {
        const v = validateLabel(label); if (!v.ok) return toast(v.why);
        const st = await addClassLog({ day, label: v.label });
        if (st === 'failed' || st === 'rejected') return saveBar.show(st, { onRetry: () => add(day, label) });
        saveBar.show(st, { text: st === 'saved' ? 'ক্লাস লেখা হয়েছে' : undefined }); reload();
      };
      if (!locked || key !== nowKey()) {
        let day = t;
        const custom = field({ label: 'অন্য ক্লাস (নিজে লিখুন)', maxlength: 60, help: 'যেমন: ক্লাস ৭ · বাড়তি ক্লাস' });
        const dayBox = h('div'), quick = h('div');
        const draw = () => {
          dayBox.replaceChildren(chipRow('কোন দিন', logDays(t).map(x => chip(x === t ? 'আজ' : shortDate(x + 'T00:00:00+06:00'), x === day, () => { day = x; draw(); }))));
          const labels = [...new Set(d.periods.map(p => periodLabel(p, names)))];
          quick.replaceChildren(labels.length ? h('div', { class: 'tc-choice' }, ...labels.map(l => h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: () => add(day, l) }, icon('plus'), l))) : '');
        };
        draw();
        addBox.append(h('section', { class: 'de-card tc-card' }, h('h2', { class: 'tc-h', text: 'নেওয়া ক্লাস লিখুন' }), h('p', { class: 'tc-cap', text: `আজ আর আগের ${bn(LOG_BACK_DAYS)} দিন পর্যন্ত লেখা যায়।` }), dayBox, quick, custom.el,
          h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: () => { const l = custom.input.value; custom.error(validateLabel(l).ok ? '' : validateLabel(l).why); if (validateLabel(l).ok) { custom.input.value = ''; add(day, l); } } }, 'এটা যোগ করুন')));
      }
      const del = async l => {
        if (!await confirmBox({ title: 'এই ক্লাস মুছবেন?', text: `${shortDate(l.day + 'T00:00:00+06:00')} · ${l.label}`, ok: 'হ্যাঁ, মুছুন', cancel: 'না, থাক', danger: true })) return;
        const st = await removeClassLog(l.id);
        if (st !== 'saved') return toast(st === 'offline' ? 'নেট নেই। নেট এলে আবার চেষ্টা করুন।' : 'মোছা যায়নি।');
        toast('মুছে ফেলা হয়েছে।'); reload();
      };
      return h('div', { class: 'tc-page' }, monthBar(key, k => { key = k; reload(); }),
        h('section', { class: 'de-card tc-card' }, h('p', { class: 'tc-big tc-big--info', text: `${bn(n)} ক্লাস` }),
          h('p', { class: 'tc-cap', text: d.paid ? `পরিশোধিত: ${money(d.paid.amount)} (${bn(d.paid.classes)} ক্লাস)` : amount != null ? `প্রতি ক্লাস ${money(d.rate)} · এ পর্যন্ত ${money(amount)}` : 'প্রতি ক্লাসের হার অফিস ঠিক করবে। হার হলে এখানে টাকার অঙ্ক দেখাবে।' })),
        addBox,
        n ? h('div', { class: 'de-card' }, h('ul', { class: 'tc-list' }, ...d.logs.map(l => h('li', { class: 'tc-row' }, h('div', { class: 'tc-grow' }, h('span', { class: 'de-row__title', text: l.label }), h('span', { class: 'de-row__sub', text: shortDate(l.day + 'T00:00:00+06:00') })),
          canEditLog({ day: l.day, today: t, paid: locked }) ? h('button', { class: 'de-btn de-btn--secondary tc-iconbtn', type: 'button', 'aria-label': `মুছুন: ${l.label}`, onclick: () => del(l) }, icon('trash')) : null))))
          : stateCard({ kind: 'empty', title: 'এ মাসে কোনো ক্লাস লেখা নেই', text: 'ক্লাস নেওয়ার পর উপরে এক চাপে লিখে রাখুন।', mascot: false }),
        h('p', { class: 'tc-cap', text: 'নিজের লেখা ক্লাসের হিসাব থেকেই সম্মানী হয়। ভুল হলে ৭ দিনের মধ্যে মুছে আবার লিখুন।' }));
    },
  });
}

// Small pieces the teacher's screens share.
import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { chip, chipRow } from '../../ui/chip.js';
import { openSheet } from '../../ui/sheet.js';
import { toast } from '../../ui/toast.js';
import { cache } from '../../core/cache.js';
import { session } from '../../core/session.js';
import { bn } from '../../core/bn.js';
import { SHIFTS, SLOTS, shiftName, slotName, levelsText, spanText, WHY, validReason } from './logic.js';

export const avatar = name => h('span', { class: 'de-avatar tc-av', 'aria-hidden': 'true', text: Array.from(String(name || '?').trim())[0] || '?' });
export const periodName = p => `${shiftName(p.shift)} · ${slotName(p.slot)} ক্লাস`;
export const periodSub = p => `${spanText(p.shift, p.slot)} · ${levelsText(p.levels)} · ${shiftName(p.shift)} ব্যাচ`;

// The period chips at the top of the attendance and rating pages. onPick(shift, slot). "অন্য ক্লাস" opens any shift and slot (a substitute, a changed routine).
export function periodPicker({ periods, shift, slot, onPick }) {
  const mine = periods.map(p => chip(`${shiftName(p.shift)} ${slotName(p.slot)}${p.levels ? ' · ক্লাস ' + p.levels.map(bn).join(',') : ''}`, p.shift === shift && p.slot === slot, () => onPick(p.shift, p.slot)));
  const inMine = periods.some(p => p.shift === shift && p.slot === slot);
  const other = chip(inMine ? 'অন্য ক্লাস' : `${shiftName(shift)} ${slotName(slot)} (অন্য ক্লাস)`, !inMine, () => {
    let sh = shift || 'afternoon', sl = slot || 1;
    const shifts = h('div'), slots = h('div'), go = h('button', { class: 'de-btn de-btn--primary', type: 'button', text: 'এই ক্লাস খুলুন' });
    const draw = () => {
      shifts.replaceChildren(chipRow('শিফট', SHIFTS.map(s => chip(s.name, s.id === sh, () => { sh = s.id; draw(); }))));
      slots.replaceChildren(chipRow('কত নম্বর ক্লাস', SLOTS.map(n => chip(`${slotName(n)} ক্লাস`, n === sl, () => { sl = n; draw(); }))));
    };
    draw();
    const s = openSheet({ title: 'অন্য ক্লাস বেছে নিন', content: h('div', { class: 'sheet-col' }, h('p', { class: 'tc-sub', text: 'রুটিনে যে ক্লাস আপনার নয়, সেটার হাজিরাও এখান থেকে নেওয়া যায়।' }), shifts, slots, go) });
    go.addEventListener('click', () => { s.close(); onPick(sh, sl); });
  });
  return h('div', { class: 'tc-period-pick' }, chipRow('আজকের ক্লাস', [...mine, other]));
}

// A saved value changes only with a reason (3 to 200 characters). run(reason) -> Promise<boolean>; the sheet closes when it returns true.
export function reasonSheet({ lead, label = 'বদলে দিন', run }) {
  let sheet = null;
  const ta = h('textarea', { class: 'de-field__input tc-ta', rows: '2', maxlength: '200', 'aria-label': 'কারণ', placeholder: 'কারণ লিখুন' });
  const go = h('button', { class: 'de-btn de-btn--primary', type: 'button', disabled: true, text: label });
  const upd = () => { go.disabled = !validReason(ta.value); };
  ta.addEventListener('input', upd);
  const chips = chipRow('কারণ', WHY.map(w => chip(w, false, () => { ta.value = w === 'অন্য কারণ' ? '' : w; ta.focus(); upd(); })));
  go.addEventListener('click', async () => {
    const reason = validReason(ta.value); if (!reason) return;
    go.disabled = true; go.textContent = 'একটু অপেক্ষা…';
    const done = await run(reason);
    if (done) sheet.close(); else { go.textContent = label; upd(); }
  });
  sheet = openSheet({ title: 'পরিবর্তনের কারণ', content: h('div', { class: 'sheet-col' }, h('p', { class: 'tc-sub', text: lead }), chips, ta, go, h('button', { class: 'de-btn de-btn--text', type: 'button', text: 'বাতিল', onclick: () => sheet.close() })) });
  return sheet;
}

// One line under the period chips: what saving attendance does right now (silent mode). Taps open the full rules. Reads automation_status, last answer kept.
export function silentLine(ctx) {
  const btn = h('button', { class: 'tc-line', type: 'button', onclick: () => ctx.go('/more/automation'), hidden: true });
  import('../../core/automation.js').then(async A => {
    const uid = session.uid(), old = cache.get(uid, 'automation');
    const paint = s => {
      const hd = A.headline(s);
      btn.className = 'tc-line' + (hd.tone === 'warn' ? ' is-warn' : hd.tone === 'good' ? ' is-good' : '');
      btn.replaceChildren(icon(hd.tone === 'warn' ? 'alert' : 'info'), h('span', { text: hd.title }), icon('chev'));
      btn.hidden = false;
    };
    if (old?.v) paint(old.v);
    const r = await A.loadAutomation();
    if (r.kind === 'ok') { cache.set(uid, 'automation', r.status); paint(r.status); } else if (!old?.v) paint(r.status);
  }).catch(() => { /* the line is a help, never a blocker */ });
  return btn;
}
export const stateWord = state => ({ saved: 'জমা হয়েছে', queued: 'ফোনে রাখা আছে, নেট এলে যাবে', failed: 'যায়নি, আবার চেষ্টা করুন', rejected: 'সার্ভার নেয়নি, অফলাইন পেন্ডিং কাজ দেখুন' })[state] || '';
export function saveToast(state, ok) { toast(state === 'saved' ? ok : stateWord(state)); }

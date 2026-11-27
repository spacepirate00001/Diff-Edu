// "শিক্ষার্থী ও অভিভাবকের ফোন": every active student, searched by name (Bangla or English spelling), roll or login id with the old phonetic matching.
// Tap a student: today's attendance, call the guardian, write a private note (teacher_notes: students and guardians never see it), open the chat.
import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { chip, chipRow } from '../../ui/chip.js';
import { openSheet } from '../../ui/sheet.js';
import { toast } from '../../ui/toast.js';
import { stateCard } from '../../ui/states.js';
import { dataPage } from '../../ui/datapage.js';
import { sel, rows } from '../../core/api.js';
import { filter as nameFilter, normalize } from '../../core/name-search.js';
import { bn, ascii, shortDate } from '../../core/bn.js';
import { shiftName, slotName, STATUS_NAME } from './logic.js';
import { loadStudents, loadNotes, addNote, today } from './data.js';
import { openCallSheet } from './call.js';
import { avatar } from './ui.js';

const MAX = 40;
export function studentsPage(ctx) {
  let q = '', cls = null;
  const out = h('ul', { class: 'tc-list', 'aria-live': 'polite' });
  return dataPage({
    key: 'students', load: loadStudents, isEmpty: d => !d.length,
    empty: () => stateCard({ kind: 'empty', title: 'কোনো শিক্ষার্থী পাওয়া যায়নি', text: 'অফিসে জানান।' }),
    draw: list => {
      const levels = [...new Set(list.map(s => s.class_level))].sort((a, b) => a - b);
      const chipsBox = h('div');
      const drawChips = () => chipsBox.replaceChildren(chipRow('ক্লাস', [chip('সব ক্লাস', cls == null, () => { cls = null; paint(); }), ...levels.map(l => chip('ক্লাস ' + bn(l), cls === l, () => { cls = l; paint(); }))]));
      const paint = () => {
        drawChips();
        const base = list.filter(s => cls == null || s.class_level === cls);
        const digits = ascii(q).replace(/\D/g, '');
        let shown = normalize(q) ? nameFilter(base, q, s => ({ name: s.profile?.full_name, login: s.profile?.login_id, roll: s.roll })) : base;
        if (digits.length >= 4) shown = [...shown, ...base.filter(s => (s.profile?.phone || '').includes(digits) && !shown.includes(s))];
        shown = shown.slice(0, MAX);
        out.replaceChildren(...shown.map(s => h('li', null, h('button', { class: 'de-row more-row', type: 'button', 'aria-label': `${s.profile?.full_name}, ক্লাস ${s.class_level}, রোল ${s.roll}`, onclick: () => open(s) }, avatar(s.profile?.full_name),
          h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: s.profile?.full_name || '—' }), h('span', { class: 'de-row__sub', text: `ক্লাস ${bn(s.class_level)} · রোল ${bn(s.roll ?? '')}` })), icon('chev')))),
        ...(!shown.length ? [h('li', null, h('p', { class: 'tc-sub', text: 'কাউকে পাওয়া যায়নি। নামের অংশ, রোল বা আইডি লিখুন।' }))] : []));
      };
      function open(s) {
        const name = s.profile?.full_name || 'শিক্ষার্থী';
        const att = h('div', { class: 'tc-count', 'aria-label': 'আজকের হাজিরা' }), notes = h('ul', { class: 'tc-list' });
        const ta = h('textarea', { class: 'de-field__input tc-ta', rows: '2', maxlength: '1000', 'aria-label': 'শিক্ষার্থীর নোট', placeholder: 'শুধু শিক্ষকদের জন্য নোট' });
        const save = h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: 'নোট রাখুন' });
        const drawNotes = async () => { const r = await loadNotes(s.id); notes.replaceChildren(...(r.kind === 'ok' && r.data.length ? r.data.map(n => h('li', { class: 'tc-rule' }, h('p', { class: 'tc-q', text: n.body }), h('p', { class: 'tc-cap', text: shortDate(n.created_at) }))) : [h('li', null, h('p', { class: 'tc-cap', text: r.kind === 'ok' ? 'এখনো কোনো নোট নেই।' : 'নোট আনা যায়নি।' }))])); };
        save.addEventListener('click', async () => {
          const t = ta.value.trim(); if (!t) return toast('আগে কিছু লিখুন।');
          save.disabled = true; const st = await addNote(s.id, t); save.disabled = false;
          if (st === 'failed' || st === 'rejected') return toast('নোট যায়নি, আবার চেষ্টা করুন।');
          ta.value = ''; toast(st === 'saved' ? 'নোট রাখা হলো।' : 'নেট নেই, নোট ফোনে রাখা হলো।'); drawNotes();
        });
        sel('period_attendance', `select=shift,slot,present&day=eq.${today()}&student_id=eq.${s.id}&order=shift,slot`).then(r => {
          const l = r.kind === 'ok' ? rows(r) : null;
          att.replaceChildren(...(l && l.length ? l.map(x => h('span', { class: 'de-chip de-chip--' + (x.present ? 'good' : 'bad'), text: `${shiftName(x.shift)} ${slotName(x.slot)}: ${x.present ? STATUS_NAME.present : STATUS_NAME.absent}` })) : [h('span', { class: 'de-chip de-chip--plain', text: l ? 'আজ হাজিরা নেওয়া হয়নি' : 'হাজিরা আনা যায়নি' })]));
        });
        const sh = openSheet({ title: name, content: h('div', { class: 'sheet-col' }, h('p', { class: 'tc-sub', text: `ক্লাস ${bn(s.class_level)} · রোল ${bn(s.roll ?? '')}${s.profile?.login_id ? ' · আইডি ' + s.profile.login_id : ''}` }), att,
          h('button', { class: 'de-btn de-btn--primary', type: 'button', text: 'অভিভাবককে ফোন করুন', onclick: () => { sh.close(); openCallSheet({ id: s.id, name }); } }),
          h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: 'অভিভাবকের সাথে বার্তা', onclick: () => { sh.close(); ctx.go('/contact/guardians/' + s.id); } }),
          h('h3', { class: 'tc-h', text: 'আমার নোট' }), notes, ta, save) });
        drawNotes();
      }
      const search = h('input', { class: 'de-field__input tc-input', type: 'search', role: 'searchbox', 'aria-label': 'নাম, রোল বা আইডি দিয়ে খুঁজুন', placeholder: 'নাম, রোল বা আইডি', autocomplete: 'off', enterkeyhint: 'search', oninput: e => { q = e.target.value; paint(); } });
      paint();
      return [search, levels.length > 1 ? chipsBox : null, h('div', { class: 'de-card' }, out)];
    },
  });
}

// "রুটিন" (admin): for each shift and period (১ম/২য়/৩য়), which teacher takes which class. Tap a row to change or clear it, "যোগ করুন" for a new one.
// Teachers' attendance, rating and today pages follow this routine. Server: class_periods (read), admin_set_period (write).
import { h } from '../../ui/dom.js';
import { chip, chipRow } from '../../ui/chip.js';
import { openSheet } from '../../ui/sheet.js';
import { toast } from '../../ui/toast.js';
import { dataPage } from '../../ui/datapage.js';
import { icon } from '../../ui/icons.js';
import { sel, rpc, rows } from '../../core/api.js';
import { store } from '../../core/store.js';
import { bn } from '../../core/bn.js';
import { LEVELS, SHIFT_IDS, routineGroups, cellName, teacherLoad, setPeriodCall, routineError, slotName } from './logic.js';

const load = async () => {
  const [r, s] = await Promise.all([
    sel('class_periods', 'select=shift,slot,class_level,teacher_id,teacher:teacher_id(full_name)&order=shift,slot,class_level'),
    sel('staff_public', 'select=id,full_name,role&order=full_name'),
  ]);
  if (r.kind !== 'ok' || s.kind !== 'ok') return { kind: (r.kind === 'offline' || s.kind === 'offline') ? 'offline' : 'error' };
  return { kind: 'ok', data: { periods: rows(r), staff: rows(s).filter(p => p.role === 'teacher' || p.role === 'admin') } };
};

export function routinePage() {
  let shift = 'afternoon', reloadFn = null;
  const page = dataPage({
    key: 'office.routine', load, isEmpty: () => false,
    draw: (d, reload) => {
      reloadFn = reload;
      const groups = routineGroups(d.periods, shift), load2 = teacherLoad(d.periods, shift);
      return h('div', { class: 'tc-page' },
        chipRow('ব্যাচ', SHIFT_IDS.map(([k, l]) => chip(l, shift === k, () => { shift = k; reload(); }))),
        h('p', { class: 'tc-sub', text: 'এই রুটিন ধরেই শিক্ষকদের হাজিরা, রেটিং আর আজকের ক্লাসের পাতা সাজে।' }),
        ...groups.map(g => h('section', { class: 'de-card tc-body' },
          h('h2', { class: 'tc-h', text: `${slotName(g.slot)} ক্লাস` }),
          g.cells.length ? h('ul', { class: 'tc-list' }, ...g.cells.map(c => h('li', {}, h('button', { class: 'de-row more-row', type: 'button', onclick: () => edit(d, g.slot, c.cls, c.teacher_id) },
            h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: cellName(c.cls) }), h('span', { class: 'de-row__sub', text: c.name || 'শিক্ষক ঠিক করা নেই' })), icon('chev')))))
            : h('p', { class: 'de-row__sub', text: 'এই সময়ে কেউ ঠিক করা নেই।' }),
          h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: 'যোগ করুন', onclick: () => edit(d, g.slot, undefined, null) }))),
        load2.length ? h('section', { class: 'de-card tc-body' }, h('h2', { class: 'tc-h', text: 'দিনে কার কয়টি ক্লাস' }), ...load2.map(t => h('p', { class: 'de-row__sub', text: `${t.name}: ${bn(t.n)}টি` }))) : null);
    },
  });
  function edit(d, slot, cls0, teacher0) {
    const f = { cls: cls0, teacher: teacher0 }, adding = cls0 === undefined;
    const box = h('div', { class: 'sheet-col' }), save = h('button', { class: 'de-btn de-btn--primary', type: 'button', text: 'সংরক্ষণ করুন' });
    const clear = h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: 'এই সময়ের জন্য কাউকে না রাখুন' });
    const draw = () => box.replaceChildren(...[
      adding ? h('div', {}, h('p', { class: 'de-field__label', text: 'কোন ক্লাস' }), chipRow('ক্লাস', [chip('সব ক্লাস', f.cls === null, () => { f.cls = null; draw(); }), ...LEVELS.map(l => chip(bn(l), f.cls === l, () => { f.cls = l; draw(); }))])) : null,
      h('div', {}, h('p', { class: 'de-field__label', text: 'কোন শিক্ষক' }), chipRow('শিক্ষক', d.staff.map(t => chip(t.full_name, f.teacher === t.id, () => { f.teacher = t.id; draw(); })))),
      save, adding ? null : clear].filter(Boolean));
    draw();
    const sheet = openSheet({ title: `${SHIFT_IDS.find(s => s[0] === shift)[1]} · ${slotName(slot)} ক্লাস${adding ? '' : ' · ' + cellName(cls0)}`, content: box });
    const run = async teacher => {
      save.disabled = clear.disabled = true;
      const call = setPeriodCall(shift, slot, f.cls, teacher), res = await rpc(call.name, call.args);
      save.disabled = clear.disabled = false;
      if (res.kind !== 'ok') return toast(routineError(res));
      store.del?.('c.periods'); sheet.close(); toast(teacher ? 'রুটিন বদলে গেছে।' : 'সরানো হয়েছে।'); reloadFn?.();
    };
    save.addEventListener('click', () => { if (f.cls === undefined) return toast('আগে ক্লাস বেছে নিন।'); if (!f.teacher) return toast('আগে শিক্ষক বেছে নিন।'); run(f.teacher); });
    clear.addEventListener('click', () => run(null));
  }
  return page;
}

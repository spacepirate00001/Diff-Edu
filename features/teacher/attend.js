// "হাজিরা নিন": one period. Everyone is present by default; the teacher taps only the absentees (or opens the four choices for late / left early),
// then saves once. Only students with no saved row are written (new rows, outbox when offline); a saved row that changes needs a reason (rpc).
import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { chip, chipRow } from '../../ui/chip.js';
import { openSheet } from '../../ui/sheet.js';
import { toast } from '../../ui/toast.js';
import { saveBar } from '../../ui/savebar.js';
import { confirmBox } from '../../ui/dialog.js';
import { stateCard } from '../../ui/states.js';
import { dataPage } from '../../ui/datapage.js';
import { filter as nameFilter, normalize } from '../../core/name-search.js';
import { sky } from '../../core/sky.js';
import { cache } from '../../core/cache.js';
import { session } from '../../core/session.js';
import { bn } from '../../core/bn.js';
import { SHIFTS, SLOTS, STATUS_NAME, STATUSES, isPresent, toggleAbsent, initialStatuses, summarize, consequence, attendanceDiff, changeAttendanceCall, currentPeriod, guessShift, periodKey, shiftName, slotName, spanText, levelsText } from './logic.js';
import { loadRoutine, loadPeriodView, saveAttendance, callChange } from './data.js';
import { avatar, periodPicker, reasonSheet, silentLine, periodName } from './ui.js';

let lastSaved = null;     // { key } the period saved a moment ago: the page offers the rating step
export const wasSaved = key => lastSaved?.key === key;
export const periodUrl = (base, shift, slot) => `${base}?shift=${shift}&slot=${slot}`;

// Shared by the attendance and rating pages: which period, and what the server has for it. -> { kind, data: { periods, shift, slot, mine, view } }
export async function loadPeriodPage(uid, query) {
  const rt = await loadRoutine(uid);
  if (rt.kind !== 'ok') return rt;
  const { periods } = rt.data;
  let shift = SHIFTS.some(s => s.id === query.shift) ? query.shift : null, slot = SLOTS.includes(Number(query.slot)) ? Number(query.slot) : null;
  if (!shift || !slot) { const c = currentPeriod(periods, sky.minutes()); shift = c?.shift || guessShift(sky.minutes()); slot = c?.slot || 1; }
  const mine = periods.find(p => p.shift === shift && p.slot === slot) || null;
  const v = await loadPeriodView({ shift, slot, levels: mine?.levels || null });
  return v.kind === 'ok' ? { kind: 'ok', data: { periods, shift, slot, mine, view: v.data } } : v;
}

export function attendPage(ctx, query = {}) {
  const uid = session.uid();
  const silent = () => { const v = cache.get(uid, 'automation')?.v; return v?.known ? !!v.silent_mode : null; };
  return dataPage({
    key: `att.${query.shift || 'auto'}.${query.slot || ''}`,
    load: () => loadPeriodPage(uid, query),
    isEmpty: d => !d.view.roster.length,
    empty: () => stateCard({ kind: 'empty', title: 'এই ক্লাসে কোনো শিক্ষার্থী নেই', text: 'অন্য শিফট বা ক্লাস বেছে দেখুন।', action: 'আজকের ক্লাস', onAction: () => ctx.go('/class') }),
    draw: (d, reload) => {
      const { periods, shift, slot, mine, view } = d, key = periodKey(shift, slot);
      const statuses = initialStatuses(view.roster, view.saved);
      let q = '', cls = null, busy = false;
      const levels = [...new Set(view.roster.map(s => s.class_level))].sort((a, b) => a - b);
      const list = h('ul', { class: 'tc-list', 'aria-label': 'শিক্ষার্থীর তালিকা' }), counts = h('div', { class: 'tc-count', role: 'status', 'aria-live': 'polite' }), saveBtn = h('button', { class: 'de-btn de-btn--primary', type: 'button' }), hint = h('p', { class: 'tc-cap' });
      const pick = (sh, sl) => ctx.replace(`/class/attend?shift=${sh}&slot=${sl}`);

      const chipsBox = h('div');
      const drawChips = () => chipsBox.replaceChildren(chipRow('ক্লাস', [chip('সব ক্লাস', cls == null, () => { cls = null; paint(); }), ...levels.map(l => chip('ক্লাস ' + bn(l), cls === l, () => { cls = l; paint(); }))]));
      const rowOf = s => {
        const st = statuses[s.id], away = !isPresent(st), locked = s.id in view.saved && view.saved[s.id].server !== false;
        const main = h('button', { class: 'tc-att__main', type: 'button', 'aria-pressed': String(!away), 'aria-label': `${s.name}, রোল ${bn(s.roll)}, ${STATUS_NAME[st]}. চাপলে ${away ? 'উপস্থিত' : 'অনুপস্থিত'} হবে`, onclick: () => { statuses[s.id] = toggleAbsent(st); paint(); } },
          avatar(s.name), h('span', { class: 'tc-att__name' }, h('b', { text: s.name }), h('span', { text: `রোল ${bn(s.roll)}${levels.length > 1 ? ' · ক্লাস ' + bn(s.class_level) : ''}${locked ? ' · সংরক্ষিত' : ''}` })),
          h('span', { class: 'de-chip de-chip--' + (away ? 'bad' : st === 'late' ? 'warn' : 'good') + ' tc-att__chip', 'data-st': away ? 'away' : st }, STATUS_NAME[st]));
        const key2 = h('button', { class: 'tc-att__key', type: 'button', 'aria-label': `${s.name}: আরও অবস্থা (দেরি, আগে গেছে)`, onclick: () => choose(s) }, icon('more'));
        return h('li', null, h('div', { class: 'tc-att' + (away ? ' is-away' : '') }, main, key2));
      };
      function choose(s) {
        const sh = openSheet({ title: s.name, content: h('div', { class: 'tc-choice' }, ...STATUSES.map(st => h('button', { class: 'de-btn de-btn--secondary' + (statuses[s.id] === st ? ' is-on' : ''), type: 'button', 'aria-pressed': String(statuses[s.id] === st),
          onclick: () => { statuses[s.id] = st; sh.close(); paint(); } }, STATUS_NAME[st])), h('p', { class: 'tc-cap', text: [consequence('late'), consequence('leave', { earlierPresent: null }), consequence('absent', { silent: silent() })].join(' ') })) });
      }
      function paint() {
        if (levels.length > 1) drawChips();
        const base = view.roster.filter(s => cls == null || s.class_level === cls);
        const shown = normalize(q) ? nameFilter(base, q, s => ({ name: s.name, login: s.login, roll: s.roll })) : base;
        list.replaceChildren(...shown.map(rowOf), ...(!shown.length ? [h('li', null, h('p', { class: 'tc-sub', text: 'কাউকে পাওয়া যায়নি। নামের অংশ বা রোল লিখুন।' }))] : []));
        const sm = summarize(statuses, view.roster.map(s => s.id)), df = attendanceDiff({ statuses, saved: view.saved, ids: view.roster.map(s => s.id) });
        counts.replaceChildren(...[h('span', { class: 'de-chip de-chip--good', text: `উপস্থিত ${bn(sm.here)}` }), h('span', { class: 'de-chip de-chip--bad', text: `অনুপস্থিত ${bn(sm.away)}` }), sm.late ? h('span', { class: 'de-chip de-chip--warn', text: `দেরি ${bn(sm.late)}` }) : null, sm.leave ? h('span', { class: 'de-chip de-chip--plain', text: `আগে গেছে ${bn(sm.leave)}` }) : null].filter(Boolean));
        const n = df.fresh.length + df.changes.length;
        saveBtn.disabled = busy || !n; saveBtn.textContent = busy ? 'সংরক্ষণ হচ্ছে…' : n ? `সংরক্ষণ করুন (${bn(n)} জন)` : 'সংরক্ষিত, কিছু বদলায়নি';
        hint.textContent = df.changes.length ? `${bn(df.changes.length)} জনের সংরক্ষিত অবস্থা বদলাচ্ছে, কারণ লিখতে হবে।` : 'সবাই উপস্থিত ধরা আছে। শুধু অনুপস্থিতদের চাপ দিন।';
      }
      async function save() {
        const ids = view.roster.map(s => s.id), df = attendanceDiff({ statuses, saved: view.saved, ids }), sm = summarize(statuses, ids);
        if (!df.fresh.length && !df.changes.length) return toast('কিছু বদলায়নি');
        if (df.fresh.length && !sm.away && !await confirmBox({ title: 'সবাই উপস্থিত?', text: 'কেউ অনুপস্থিত নেই। সবাইকে উপস্থিত ধরে সংরক্ষণ করবেন?', ok: 'হ্যাঁ, সংরক্ষণ করুন', cancel: 'আবার দেখি' })) return;
        busy = true; paint();
        const res = await saveAttendance({ view, statuses, shift, slot });
        busy = false;
        const failed = ['failed', 'rejected'].includes(res.state);
        if (res.state === 'saved') import('../student/fx.js').then(m => m.confetti()).catch(() => {});
        saveBar.show(res.state, { onRetry: save, onOpen: async () => (await import('../offline/pending-sheet.js')).openPending() });
        if (!failed) for (const f of df.fresh) view.saved[f.id] = { present: f.present, session: 'class', server: res.state === 'saved' };
        paint();
        if (failed) return;
        if (df.changes.length) return changeFlow(df.changes);
        done();
      }
      function changeFlow(changes) {
        reasonSheet({ lead: `${bn(changes.length)} জনের সংরক্ষিত হাজিরা বদলাবে। সার্ভারে কারণসহ লেখা থাকবে।`, run: async reason => {
          for (const c of changes) {
            const r = await callChange(changeAttendanceCall({ id: c.id, day: view.day, shift, slot, present: c.present, reason }));
            if (r === 'offline') { toast('নেট নেই। সংরক্ষিত হাজিরা বদলাতে নেট লাগে।'); return false; }
            if (r !== 'ok') { toast('বদলানো যায়নি। আবার চেষ্টা করুন।'); return false; }
            view.saved[c.id] = { ...view.saved[c.id], present: c.present };
          }
          saveBar.show('saved', { text: 'হাজিরা বদলে গেছে' }); paint(); done(); return true;
        } });
      }
      function done() { lastSaved = { key }; reload(); }

      saveBtn.addEventListener('click', save);
      paint();
      const search = h('input', { class: 'de-field__input tc-input', type: 'search', 'aria-label': 'নাম বা রোল দিয়ে খুঁজুন', placeholder: 'নাম বা রোল দিয়ে খুঁজুন', autocomplete: 'off', enterkeyhint: 'search', oninput: e => { q = e.target.value; paint(); } });
      const all = h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: 'সবাইকে উপস্থিত করুন', onclick: () => { for (const s of view.roster) if (!(s.id in view.saved)) statuses[s.id] = 'present'; paint(); toast('যাদের হাজিরা সংরক্ষণ হয়নি, সবাই উপস্থিত।'); } });
      const next = wasSaved(key) ? h('section', { class: 'de-card tc-card' }, h('h2', { class: 'tc-h', text: 'হাজিরা সংরক্ষিত' }), h('p', { class: 'tc-sub', text: 'এবার উপস্থিত শিক্ষার্থীদের ক্লাস রেটিং দিন।' }),
        h('button', { class: 'de-btn de-btn--accent', type: 'button', text: 'রেটিং দিন', onclick: () => ctx.go(periodUrl('/class/rate', shift, slot)) })) : null;
      return [periodPicker({ periods, shift, slot, onPick: pick }), silentLine(ctx), next,
        h('section', { class: 'de-card tc-card' }, h('h2', { class: 'tc-h', text: periodName({ shift, slot }) }), h('p', { class: 'tc-sub', text: `${spanText(shift, slot)} · ${levelsText(mine?.levels || null)}${mine ? '' : ' · রুটিনে আপনার নয়'}` }), counts),
        levels.length > 1 ? chipsBox : null,
        h('div', { class: 'tc-wrap' }, search), all, h('div', { class: 'de-card' }, list),
        h('div', { class: 'tc-sticky' }, hint, saveBtn)];
    },
  });
}
export { shiftName, slotName };

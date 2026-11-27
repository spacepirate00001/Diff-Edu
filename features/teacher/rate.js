// "ক্লাস রেটিং": after attendance. Only students marked present are rated: আচরণ (0-3), হোমওয়ার্ক (0 / ১.৫ / ৩), পারফরম্যান্স (0-4), out of 10, with +/- keys.
// Everyone starts at 8/10 (the old app's default). New ratings are one upsert (outbox when offline); a saved rating that changes needs a reason (rpc change_rating).
import { h } from '../../ui/dom.js';
import { chip, chipRow } from '../../ui/chip.js';
import { toast } from '../../ui/toast.js';
import { saveBar } from '../../ui/savebar.js';
import { stateCard } from '../../ui/states.js';
import { dataPage } from '../../ui/datapage.js';
import { icon } from '../../ui/icons.js';
import { session } from '../../core/session.js';
import { bn } from '../../core/bn.js';
import { RATING, RATING_KEYS, RATING_DEFAULT, stepRating, ratingTotal, ratingDiff, sameRating, num, hwWord, changeRatingCall, periodKey, spanText, levelsText } from './logic.js';
import { saveRatings, callChange } from './data.js';
import { loadPeriodPage, periodUrl } from './attend.js';
import { avatar, periodPicker, reasonSheet, periodName } from './ui.js';

export function ratePage(ctx, query = {}) {
  const uid = session.uid();
  return dataPage({
    key: `rate.${query.shift || 'auto'}.${query.slot || ''}`,
    load: () => loadPeriodPage(uid, query),
    isEmpty: d => !d.view.roster.length || !d.view.roster.some(s => d.view.saved[s.id]?.present),
    empty: () => stateCard({ kind: 'empty', title: 'আগে হাজিরা সংরক্ষণ করুন', text: 'রেটিং শুধু উপস্থিত শিক্ষার্থীদের দেওয়া যায়। হাজিরা নেওয়ার পর এখানে আসুন।', action: 'হাজিরা নিন', onAction: () => ctx.go(periodUrl('/class/attend', query.shift || 'afternoon', query.slot || 1)) }),
    draw: (d, reload) => {
      const { periods, shift, slot, mine, view } = d, key = periodKey(shift, slot);
      const present = view.roster.filter(s => view.saved[s.id]?.present);
      const ratings = Object.fromEntries(present.map(s => [s.id, { ...(view.savedR[s.id] || RATING_DEFAULT) }]));
      const open = new Set();
      let busy = false;
      const list = h('ul', { class: 'tc-list', 'aria-label': 'রেটিং' }), counts = h('div', { class: 'tc-count', role: 'status', 'aria-live': 'polite' }), saveBtn = h('button', { class: 'de-btn de-btn--primary', type: 'button' }), hint = h('p', { class: 'tc-cap' });

      const stepper = (s, k) => {
        const r = ratings[s.id], dd = RATING[k];
        const dec = h('button', { class: 'de-stepper__key', type: 'button', 'aria-label': `${s.name}: ${dd.name} কমান`, disabled: r[k] <= dd.min, onclick: () => { ratings[s.id] = stepRating(r, k, -1); paint(); } }, '−');
        const inc = h('button', { class: 'de-stepper__key', type: 'button', 'aria-label': `${s.name}: ${dd.name} বাড়ান`, disabled: r[k] >= dd.max, onclick: () => { ratings[s.id] = stepRating(r, k, 1); paint(); } }, '+');
        return h('div', { class: 'tc-step' }, h('span', { text: k === 'homework' ? `${dd.name} (${hwWord(r[k])})` : dd.name }), h('span', { class: 'de-stepper' }, dec, h('span', { class: 'de-stepper__value', 'aria-live': 'polite', text: num(r[k]) }), inc));
      };
      const rowOf = s => {
        const r = ratings[s.id], on = open.has(s.id), isSaved = !!view.savedR[s.id]?.server, edited = view.savedR[s.id] && !sameRating(r, view.savedR[s.id]);
        const toggle = h('button', { class: 'de-btn de-btn--secondary tc-tog', type: 'button', 'aria-expanded': String(on), onclick: () => { if (on) open.delete(s.id); else open.add(s.id); paint(); } }, on ? 'বন্ধ করুন' : 'বদলান');
        return h('li', { class: 'tc-rate' }, h('div', { class: 'tc-row' }, avatar(s.name), h('div', { class: 'tc-grow' }, h('b', { text: s.name }), h('p', { class: 'tc-cap', text: `রোল ${bn(s.roll)}${isSaved ? ' · সংরক্ষিত' : view.savedR[s.id] ? ' · ফোনে রাখা' : ''}${edited ? ' · বদলানো হয়েছে' : ''}` })),
          h('span', { class: 'tc-total', text: `${num(ratingTotal(r))}/১০` })), h('div', { class: 'tc-row' }, toggle), on ? h('div', { class: 'tc-card' }, ...RATING_KEYS.map(k => stepper(s, k))) : null);
      };
      function paint() {
        list.replaceChildren(...present.map(rowOf));
        const df = ratingDiff({ ratings, saved: view.savedR, presentIds: present.map(s => s.id) }), n = df.fresh.length + df.changes.length, rated = present.filter(s => s.id in view.savedR).length;
        counts.replaceChildren(h('span', { class: 'de-chip de-chip--good', text: `রেটিং দেওয়া ${bn(rated)}/${bn(present.length)}` }), h('span', { class: 'de-chip de-chip--plain', text: `উপস্থিত ${bn(present.length)}` }));
        saveBtn.disabled = busy || !n; saveBtn.textContent = busy ? 'সংরক্ষণ হচ্ছে…' : n ? `রেটিং সংরক্ষণ (${bn(n)} জন)` : 'সব রেটিং সংরক্ষিত';
        hint.textContent = df.changes.length ? `${bn(df.changes.length)} জনের সংরক্ষিত রেটিং বদলাচ্ছে, কারণ লিখতে হবে।` : df.fresh.length ? 'যাদের বদলাননি তারা ৮/১০ পাবে। কারও নম্বর কমবেশি করতে "বদলান" চাপুন।' : '';
      }
      async function save() {
        const ids = present.map(s => s.id), df = ratingDiff({ ratings, saved: view.savedR, presentIds: ids });
        busy = true; paint();
        const res = await saveRatings({ view, ratings, shift, slot, presentIds: ids });
        busy = false;
        saveBar.show(res.state, { onRetry: save, onOpen: async () => (await import('../offline/pending-sheet.js')).openPending() });
        if (!['failed', 'rejected'].includes(res.state)) for (const f of df.fresh) view.savedR[f.id] = { behavior: f.behavior, homework: f.homework, performance: f.performance, server: res.state === 'saved' };
        paint();
        if (['failed', 'rejected'].includes(res.state)) return;
        if (df.changes.length) return changeFlow(df.changes);
        reload();
      }
      function changeFlow(changes) {
        reasonSheet({ lead: `${bn(changes.length)} জনের সংরক্ষিত রেটিং বদলাবে। সার্ভারে কারণসহ লেখা থাকবে।`, run: async reason => {
          for (const c of changes) {
            const r = await callChange(changeRatingCall({ id: c.id, day: view.day, shift, slot, behavior: c.behavior, homework: c.homework, performance: c.performance, reason }));
            if (r === 'offline') { toast('নেট নেই। সংরক্ষিত রেটিং বদলাতে নেট লাগে।'); return false; }
            if (r !== 'ok') { toast('বদলানো যায়নি। আবার চেষ্টা করুন।'); return false; }
            view.savedR[c.id] = { behavior: c.behavior, homework: c.homework, performance: c.performance, server: true };
          }
          saveBar.show('saved', { text: 'রেটিং বদলে গেছে' }); paint(); reload(); return true;
        } });
      }
      saveBtn.addEventListener('click', save);
      paint();
      return [periodPicker({ periods, shift, slot, onPick: (sh, sl) => ctx.replace(periodUrl('/class/rate', sh, sl)) }),
        h('section', { class: 'de-card tc-card' }, h('h2', { class: 'tc-h', text: `${periodName({ shift, slot })}: রেটিং` }), h('p', { class: 'tc-sub', text: `${spanText(shift, slot)} · ${levelsText(mine?.levels || null)}` }), counts),
        h('div', { class: 'de-card' }, list), h('div', { class: 'tc-sticky' }, hint, saveBtn)];
    },
  });
}
export { chip, chipRow, icon };

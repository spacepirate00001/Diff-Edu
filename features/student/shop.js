// পয়েন্টের দোকান: pay with stars OR points. Avatars, frames, profile backgrounds, badges, titles, animated effects, themes (shop_items) and stickers / mascots (sticker_catalog).
// Prices, wallet and buying all live on the server (shop_wallet, buy_shop_item, equip_look). Before the database update is live this page falls back to the old avatar shop (stars only).
import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { aicon } from '../../ui/aicons.js';
import { loading, stateCard } from '../../ui/states.js';
import { openSheet } from '../../ui/sheet.js';
import { toast } from '../../ui/toast.js';
import { sel, rpc, rows } from '../../core/api.js';
import { self } from '../../core/student-self.js';
import * as router from '../../core/router.js';
import { bn } from '../../core/bn.js';
import { me, noRecState } from './common.js';
import { SHOP } from './logic.js';
import { SLOTS, lookHero, lookPreview } from './look.js';
import { lookFrom } from './looks.js';

const msgOf = r => r?.data?.message || r?.data?.hint || '';
const RARITY = { common: 'সাধারণ', rare: 'দুর্লভ', epic: 'অসাধারণ', legendary: 'কিংবদন্তি' };
const RATE = 20; // 1 star = 20 points, only used by the old-shop fallback
const DECOR = 'decor';
const CATS = [...SLOTS, [DECOR, 'স্টিকার ও মাসকট']];
const legacyItems = () => SHOP.map(s => ({ key: s[0], slot: 'avatar', name: s[3], blurb: '', rarity: 'common', stars_price: s[4], points_price: s[4] * RATE, meta: { emoji: s[2] } }));

export function shopPage() {
  const root = h('div', { class: 'st-page' });
  let dead = false, tab = 'avatar', pay = 'stars', tryOn = {};
  const price = (it, cur = pay) => (cur === 'stars' ? it.stars_price : it.points_price);
  const draw = async () => {
    const rec = await me();
    if (!rec) return root.replaceChildren(noRecState());
    const ir = await sel('shop_items', 'select=key,slot,name,blurb,rarity,stars_price,points_price,meta&active=is.true&order=sort');
    const legacy = ir.kind !== 'ok';
    const [rr, wr, dr, so, sd] = await Promise.all([
      sel('student_rewards', `select=stars,owned,avatar,theme${legacy ? '' : ',loadout'}&student_id=eq.${rec.id}`),
      legacy ? null : rpc('shop_wallet', { p_student_id: rec.id }), legacy ? null : sel('sticker_catalog', 'select=key,kind,label,emoji,stars_price,points_price&active=is.true'),
      legacy ? null : sel('student_stickers', `select=sticker_key&student_id=eq.${rec.id}`), null]);
    if (dead) return;
    if (rr.kind !== 'ok') return root.replaceChildren(stateCard({ kind: rr.kind === 'offline' ? 'offline' : 'error', title: rr.kind === 'offline' ? 'ইশ, নেট হারিয়ে গেছে' : 'ইশ, তথ্য আনা যায়নি', text: 'আবার চেষ্টা করো।', action: 'আবার চেষ্টা করো', onAction: draw }));
    const w = rows(rr)[0] || { stars: 0, owned: [] }, cat = legacy ? legacyItems() : rows(ir);
    const wal = !legacy && wr?.kind === 'ok' && wr.data ? { stars: wr.data.stars || 0, points: wr.data.points || 0 } : { stars: w.stars || 0, points: null };
    if (wal.points == null && pay === 'points') pay = 'stars';
    const owned = new Set([...(w.owned || []), ...rows(so || { kind: 'x' }).map(x => x.sticker_key)]);
    const decor = rows(dr || { kind: 'x' }).map(x => ({ key: x.key, slot: DECOR, kind: x.kind, name: x.label, blurb: '', rarity: 'common', stars_price: x.stars_price, points_price: x.points_price ?? x.stars_price * RATE, meta: { emoji: x.emoji } }));
    const look = lookFrom(w, cat), worn = { ...look };
    for (const [s, it] of Object.entries(tryOn)) { if (s === 'badge') worn.badges = [it, ...(look.badges || []).filter(b => b.key !== it.key)].slice(0, 3); else worn[s] = it; }
    self.patch({ stars: wal.stars, owned: w.owned || [], avatar: w.avatar || null });
    const wearing = it => it.slot === 'badge' ? !!(look.badges || []).find(b => b.key === it.key) : look[it.slot]?.key === it.key;
    const can = (it, cur) => (cur === 'points' ? wal.points != null && wal.points >= it.points_price : wal.stars >= it.stars_price);

    const equip = async it => {
      const off = wearing(it);
      let slot = it.slot, item = off ? null : it.key;
      if (it.slot === 'badge') { // up to 3 badges: fill the first free place, or take this one off
        const have = look.badges || [], names = ['badge', 'badge2', 'badge3'], at = (w.loadout || {});
        const mine = names.find(n => at[n] === it.key);
        if (off) slot = mine; else { slot = names.find(n => !at[n]); if (!slot) return toast('তিনটা ব্যাজ পরা আছে। একটা খুলে নতুনটা পরো।'); }
        void have;
      }
      const r = await rpc('equip_look', { p_student_id: rec.id, p_slot: slot, p_item: item });
      if (r.kind !== 'ok') return toast('এখন হলো না, আবার চেষ্টা করো।');
      delete tryOn[it.slot]; toast(off ? 'খুলে রাখলাম।' : 'পরে নিয়েছ, দারুণ লাগছে!'); draw();
    };
    const legacyEquip = async it => {
      const off = w.avatar === it.key, r = await rpc('equip_item', { p_student_id: rec.id, p_slot: 'avatar', p_item: off ? null : it.key });
      toast(r.kind === 'ok' ? 'হয়ে গেছে!' : 'এখন হলো না, আবার চেষ্টা করো।'); draw();
    };
    const buy = async (it, cur, sheet) => {
      sheet?.close();
      if (!can(it, cur)) return toast(cur === 'stars' ? `আর ${bn(it.stars_price - wal.stars)}টা স্টার হলে এটা পাবে। কুইজ খেলে স্টার জমাও!` : `আর ${bn(it.points_price - (wal.points || 0))} পয়েন্ট হলে এটা পাবে। খেলা খেলে পয়েন্ট জমাও!`);
      const r = legacy ? await rpc('buy_item', { p_student_id: rec.id, p_item: it.key }) : await rpc('buy_shop_item', { p_student_id: rec.id, p_item: it.key, p_currency: cur });
      if (r.kind !== 'ok') return toast(/not enough/.test(msgOf(r)) ? (cur === 'stars' ? 'যথেষ্ট স্টার নেই।' : 'যথেষ্ট পয়েন্ট নেই।') : 'এখন হলো না, একটু পরে আবার চেষ্টা করো।');
      toast(`${it.name} এখন তোমার!`);
      if (it.slot === DECOR) { draw(); return; }
      if (legacy) { w.owned = [...(w.owned || []), it.key]; return legacyEquip(it); }
      owned.add(it.key); await equip(it);
    };
    const open = it => {
      const have = owned.has(it.key);
      if (have) return it.slot === DECOR ? router.go('/play/decor') : legacy ? legacyEquip(it) : equip(it);
      if (!legacy && it.slot !== DECOR) { tryOn[it.slot] = it; }
      const sheet = openSheet({ title: it.name, onClose: () => { if (!legacy) { delete tryOn[it.slot]; draw(); } }, content: h('div', { class: 'sh-sheet' },
        h('div', { class: 'sh-sheet__art' }, itemArt(it)),
        h('span', { class: 'de-chip de-chip--plain sh-rar sh-rar--' + it.rarity, text: RARITY[it.rarity] || '' }),
        it.blurb ? h('p', { class: 'de-row__sub', text: it.blurb }) : null,
        h('p', { class: 'de-row__sub', text: 'যেকোনো একটা দিয়ে কিনতে পারো। স্টার আর পয়েন্ট আলাদা জমা থাকে।' }),
        h('div', { class: 'sh-pay' },
          payBtn('stars', it, can(it, 'stars'), () => buy(it, 'stars', sheet)),
          legacy ? null : payBtn('points', it, can(it, 'points'), () => buy(it, 'points', sheet)))) });
      draw();
    };
    const itemArt = it => it.slot === DECOR ? h('span', { class: 'lk-pv lk-pv--avatar', 'aria-hidden': 'true', text: it.meta.emoji }) : lookPreview(it);
    const payBtn = (cur, it, ok, onclick) => h('button', { class: 'de-btn ' + (ok ? 'de-btn--primary' : 'de-btn--secondary') + ' sh-pay__b', type: 'button', onclick, 'aria-disabled': ok ? null : 'true' },
      cur === 'stars' ? icon('star') : aicon('bolt'), h('span', { text: `${bn(price(it, cur))} ${cur === 'stars' ? 'স্টার' : 'পয়েন্ট'} দিয়ে নিই` }),
      ok ? null : h('small', { text: cur === 'stars' ? `আরও ${bn(it.stars_price - wal.stars)} লাগবে` : `আরও ${bn(it.points_price - (wal.points || 0))} লাগবে` }));

    const list = (tab === DECOR ? decor : cat.filter(x => x.slot === tab));
    const counts = Object.fromEntries(CATS.map(([k]) => [k, (k === DECOR ? decor : cat.filter(x => x.slot === k)).filter(x => owned.has(x.key)).length]));
    const tiles = list.map(it => {
      const have = owned.has(it.key), on = wearing(it);
      return h('button', { class: 'st-tile sh-tile' + (on ? ' is-on' : ''), type: 'button', onclick: () => open(it), 'aria-pressed': have ? String(on) : null },
        h('span', { class: 'sh-tile__art' }, itemArt(it)), h('span', { class: 'st-tile__t', text: it.name }),
        have ? h('span', { class: 'st-tile__s', text: on ? 'পরা আছে' : it.slot === DECOR ? 'সাজঘরে বসাও' : 'চাপলে পরো' }) : h('span', { class: 'st-tile__s sh-price' }, pay === 'stars' ? icon('star') : aicon('bolt'), `${bn(price(it))} ${pay === 'stars' ? 'স্টার' : 'পয়েন্ট'}`),
        !have && it.rarity !== 'common' ? h('span', { class: 'sh-rar sh-rar--' + it.rarity, text: RARITY[it.rarity] }) : null);
    });
    const hasTry = Object.keys(tryOn).length;
    root.replaceChildren(
      h('section', { class: 'de-card sh-wallet' },
        h('div', { class: 'sh-wallet__row' },
          h('span', { class: 'sh-coin' }, icon('star'), h('b', { text: bn(wal.stars) }), h('span', { text: 'স্টার' })),
          wal.points == null ? null : h('span', { class: 'sh-coin' }, aicon('bolt'), h('b', { text: bn(wal.points) }), h('span', { text: 'পয়েন্ট' }))),
        legacy ? null : h('div', { class: 'chips', role: 'group', 'aria-label': 'কী দিয়ে কিনবে' }, ...[['stars', 'স্টার দিয়ে'], ['points', 'পয়েন্ট দিয়ে']].map(([k, t]) =>
          h('button', { class: 'de-chip' + (pay === k ? ' is-on' : ''), type: 'button', 'aria-pressed': String(pay === k), onclick: () => { pay = k; draw(); }, text: t })))),
      legacy ? null : h('div', { class: 'sh-stage' }, lookHero({ name: rec.name, sub: hasTry ? 'পরে দেখছ। কিনলে তোমার হবে!' : 'এখন যেমন সেজে আছ', face: worn.avatar?.meta?.emoji || '', look: worn })),
      h('div', { class: 'chips sh-tabs', role: 'tablist', 'aria-label': 'দোকানের বিভাগ' }, ...CATS.filter(([k]) => legacy ? k === 'avatar' : true).map(([k, t]) =>
        h('button', { class: 'de-chip' + (tab === k ? ' is-on' : ''), type: 'button', role: 'tab', 'aria-selected': String(tab === k), onclick: () => { tab = k; tryOn = {}; draw(); }, text: counts[k] ? `${t} (${bn(counts[k])})` : t }))),
      h('div', { class: 'st-tiles sh-grid' }, ...tiles),
      h('p', { class: 'de-row__sub gx-note', text: 'স্টার পাওয়া যায় কুইজ আর দৈনিক অভ্যাসে। পয়েন্ট পাওয়া যায় খেলায়। কিনলে জিনিসটা সারাজীবনের জন্য তোমার, বন্ধুরাও দেখতে পাবে।' }));
  };
  root.append(loading(2)); draw();
  return { node: root, destroy() { dead = true; } };
}

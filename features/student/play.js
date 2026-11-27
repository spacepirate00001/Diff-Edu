// "খেলা" tab and its pages: weekly tournament, class board, teams (battle inside the own class), points shop, decor. Games and chat load on their own (games.js, chat.js).
// Kind by design: "আমার অগ্রগতি" comes first, the board lists only the top 10 as first names + stars (what the live rpc returns), a place outside it is shown as
// "stars to the next step", nothing here shows anyone's photo or full name.
import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { emptyState, loading, stateCard } from '../../ui/states.js';
import { openSheet } from '../../ui/sheet.js';
import { confirmBox } from '../../ui/dialog.js';
import { toast } from '../../ui/toast.js';
import { saveBar } from '../../ui/savebar.js';
import { sel, rpc, rows } from '../../core/api.js';
import { outbox } from '../../core/outbox-app.js';
import { session } from '../../core/session.js';
import { features } from '../../core/features.js';
import { self } from '../../core/student-self.js';
import { bn, dhakaDay, shortDate, clockText } from '../../core/bn.js';
import { byId, visible } from '../search/registry.js';
import { me, put, studentPage, progressCard, tiles, section, noRecState } from './common.js';
import { TOURNAMENT_FROM, TEAM_FROM, classAtLeast, ENTRY_LABEL, teamView, teamIsFull, teamError, boardView, DECOR_KINDS, toggleSticker, SHOP, shopItem, canAfford, MAX_STICKERS } from './logic.js';
import { addDays } from '../study/calc.js';

const msgOf = r => r?.data?.message || r?.data?.hint || '';

// ---- the tab ----
export function playTab(ctx) {
  const root = h('div', { class: 'st-page' }), body = h('div', { class: 'st-page' });
  root.append(body);
  const list = [
    ['s_quiz', { e: '🧠', title: 'কুইজ', sub: 'শেখো, স্টার পাও', route: '/learn/quiz' }], ['s_games', { e: '🎮', title: 'শেখার খেলা', sub: 'গণিত, শব্দ, বানান', route: '/play/games' }],
    ['s_challenge', { e: '🏆', title: 'সাপ্তাহিক টুর্নামেন্ট', sub: 'এই সপ্তাহের চ্যালেঞ্জ', route: '/play/tournament' }], ['s_teams', { e: '👥', title: 'দল ও লড়াই', sub: 'ক্লাসের বন্ধুদের নিয়ে', route: '/play/teams' }],
    ['s_duel', { e: '⚔️', title: 'কুইজ ডুয়েল', sub: 'বন্ধুর সাথে টক্কর দাও', route: '/play/duel' }], ['s_board', { e: '📊', title: 'ক্লাসের তালিকা', sub: 'কার কত স্টার', route: '/play/board' }], ['s_shop', { e: '🛍️', title: 'পয়েন্টের দোকান', sub: 'স্টার দিয়ে অবতার', route: '/play/shop' }],
    ['s_decor', { e: '🎨', title: 'সাজঘর', sub: 'মাসকট ও স্টিকার', route: '/play/decor' }], ['s_chat', { e: '💬', title: 'বন্ধুদের সাথে চ্যাট', sub: 'তৈরি বাক্য আর স্টিকার', route: '/play/chat' }],
  ].filter(([id]) => visible(byId[id], features)).map(([, t]) => ({ ...t, onclick: () => ctx.go(t.route) }));
  body.append(loading(2));
  let dead = false;
  me().then(rec => {
    if (dead) return;
    body.replaceChildren(...(rec ? [progressCard(rec), tiles(list), h('p', { class: 'de-row__sub gx-note', text: 'এখানে কেউ কাউকে জাজ করে না। গতকালের চেয়ে আজ একটু ভালো করলেই তুমি উইনার!' })]
      : [noRecState()]));
  });
  return { node: root, destroy() { dead = true; } };
}

// ---- weekly tournament (42): class 5 and up; the board = approved entries in the order they came ----
export const tournamentPage = ctx => studentPage({
  key: 'stour', isEmpty: d => !d.list.length,
  empty: () => emptyState('এই সপ্তাহে কোনো চ্যালেঞ্জ নেই', 'শিক্ষক চ্যালেঞ্জ দিলে এখানে দেখা যাবে।'),
  load: async rec => {
    const l = await sel('weekly_challenges', `select=id,class_level,week_start,title,body,stars,tournament&week_start=gte.${addDays(dhakaDay(), -28)}&or=(class_level.is.null,class_level.eq.${rec.class_level})&order=week_start.desc,created_at.desc`);
    if (l.kind !== 'ok') return { kind: l.kind };
    const list = rows(l), e = list.length ? await sel('challenge_entries', `select=challenge_id,status&student_id=eq.${rec.id}`) : { kind: 'ok', data: [] };
    const boards = {};
    await Promise.all(list.filter(c => c.tournament && classAtLeast(rec.class_level, TOURNAMENT_FROM)).map(async c => { const b = await rpc('weekly_tournament_board', { p_challenge_id: c.id }); if (b.kind === 'ok') boards[c.id] = b.data; }));
    return { kind: 'ok', data: { list, mine: Object.fromEntries(rows(e).map(x => [x.challenge_id, x.status])), boards } };
  },
  draw: ({ list, mine, boards }, go) => {
    const rec = self.get(), entry = c => {
      const ta = h('textarea', { class: 'de-field__input chat-box', rows: '3', maxlength: '500', 'aria-label': 'কী করেছ লেখো', placeholder: 'কী করেছ সংক্ষেপে লেখো' });
      const send = h('button', { class: 'de-btn de-btn--primary', type: 'button', text: 'স্যারকে জানাও', onclick: async () => {
        send.disabled = true;
        const r = await outbox.submit({ uid: session.uid(), method: 'POST', path: '/rest/v1/challenge_entries', body: { challenge_id: c.id, student_id: rec.id, coaching_id: ctx.me.coaching_id, note: ta.value.trim() }, prefer: 'return=minimal', label: 'চ্যালেঞ্জ' });
        sheet.close(); saveBar.show(r.state === 'rejected' ? 'failed' : r.state); if (r.state !== 'failed' && r.state !== 'rejected') { mine[c.id] = 'pending'; go(); }
      } });
      const sheet = openSheet({ title: c.title, content: h('div', { class: 'sheet-col' }, h('p', { class: 'sheet-text', text: 'স্যার দেখে স্টার দেবেন। ভুল হলেও সমস্যা নেই, আবার চেষ্টা করা যায়।' }), ta, send) });
    };
    return [progressCard(rec), ...list.map(c => {
      const b = boards[c.id], st = mine[c.id], lab = st ? ENTRY_LABEL[st] : null;
      return h('section', { class: 'de-card gx-card' }, h('span', { class: 'de-row__sub', text: `${shortDate(Date.parse(c.week_start + 'T06:00:00Z'))} থেকে সপ্তাহ · ${bn(c.stars)} স্টার` }), h('h3', { class: 'gx-h3', text: c.title }), c.body ? h('p', { class: 'de-row__sub', text: c.body }) : null,
        lab ? h('span', { class: 'de-chip de-chip--' + lab[1], text: lab[0] }) : h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: () => entry(c), text: 'করেছি, জানাব' }),
        b ? h('div', { class: 'st-board' }, h('span', { class: 'de-row__title', text: 'যারা স্টার পেয়েছে (আগে জমার ক্রমে)' }), b.length ? h('div', { class: 'de-rows' }, ...b.map(r => h('div', { class: 'de-row gx-line' + (r.student_id === rec.id ? ' st-me' : '') }, h('span', { class: 'gx-slot', 'aria-hidden': 'true', text: bn(r.rank) }), h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: r.student_id === rec.id ? `${r.display_name} (তুমি)` : r.display_name })), h('span', { class: 'de-row__sub', text: clockText(r.submitted_at) })))) : h('span', { class: 'de-row__sub', text: 'এখনো কেউ জমা দেয়নি। তুমিই প্রথম হতে পারো!' })) : null);
    }), classAtLeast(rec.class_level, TOURNAMENT_FROM) ? null : h('p', { class: 'de-row__sub gx-note', text: 'সাপ্তাহিক টুর্নামেন্ট ৫ম শ্রেণি থেকে। তার আগে চ্যালেঞ্জগুলো মজা করে করে দেখতে পারো।' })].filter(Boolean);
  },
});

// ---- class board ----
export const boardPage = () => studentPage({
  key: 'sboard', load: rec => rpc('class_leaderboard', { p_class: rec.class_level }).then(r => ({ kind: r.kind, data: r.kind === 'ok' ? r.data || [] : undefined })), isEmpty: l => !l.length,
  empty: () => emptyState('তালিকা এখনো খালি', 'কুইজ খেললে স্টার জমবে, তখন এখানে নাম আসবে।'),
  draw: list => {
    const rec = self.get(), v = boardView(list, rec.id);
    return [progressCard(rec, { extra: v.me && !v.inTop && v.gap ? h('span', { class: 'de-chip de-chip--good', text: `পরের ধাপে যেতে আর ${bn(v.gap)}টা স্টার` }) : null }),
      section('ক্লাসের সেরা দশ (প্রথম নাম আর স্টার)'),
      h('div', { class: 'de-card more-card' }, ...v.rows.map(r => h('div', { class: 'de-row gx-line' + (r.mine ? ' st-me' : '') }, h('span', { class: 'gx-slot', 'aria-hidden': 'true', text: bn(r.rank) }),
        h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: r.mine ? `${r.display_name} (তুমি)` : r.display_name })), h('b', { class: 'gx-score', text: `${bn(r.stars)} স্টার` })))),
      h('p', { class: 'de-row__sub gx-note', text: 'তালিকায় শুধু প্রথম নাম থাকে, ছবি বা পুরো নাম নয়। স্টার পাওয়া যায় কুইজ আর খেলায়।' })];
  },
});

// ---- teams (43): own class only, class 5 and up, at most 6, the name is picked from the office's list ----
export function teamsPage() {
  const root = h('div', { class: 'st-page' });
  let dead = false;
  const draw = async () => {
    root.replaceChildren(loading(2));
    const rec = await me();
    if (!rec) return root.replaceChildren(noRecState());
    if (!classAtLeast(rec.class_level, TEAM_FROM)) return root.replaceChildren(progressCard(rec), emptyState('দল ৫ম শ্রেণি থেকে', 'ততদিন কুইজ আর খেলায় স্টার জমাও।'));
    const [m, t, mem, pend] = await Promise.all([rpc('class_mates', { p_student_id: rec.id }), sel('teams', `select=id,name,lead_id&class_level=eq.${rec.class_level}&order=created_at`), sel('team_members', 'select=team_id,student_id,joined_at&order=joined_at'), sel('team_join_requests', `select=id,team_id,via&student_id=eq.${rec.id}&status=eq.pending`)]);
    if (dead) return;
    const bad = [m, t, mem, pend].find(x => x.kind !== 'ok');
    if (bad) return root.replaceChildren(stateCard({ kind: bad.kind === 'offline' ? 'offline' : 'error', title: bad.kind === 'offline' ? 'ইশ, নেট হারিয়ে গেছে' : 'ইশ, তথ্য আনা যায়নি', text: 'আবার চেষ্টা করো।', action: 'আবার চেষ্টা করো', onAction: draw }));
    const mates = rows(m) || m.data, teams = rows(t), members = rows(mem), pending = rows(pend), v = teamView({ me: rec.id, teams, members, pending });
    const name = id => (id === rec.id ? `${rec.name.split(' ')[0]} (তুমি)` : mates.find(x => x.student_id === id)?.display_name || 'বন্ধু');
    const act = async (call, ok) => { const r = await call(); if (r.kind === 'ok') { toast(ok); draw(); } else toast(r.kind === 'offline' ? 'নেট নেই, নেট এলে আবার চেষ্টা করো।' : teamError(msgOf(r))); };
    const nodes = [progressCard(rec)];
    for (const r of v.invites) nodes.push(h('section', { class: 'de-card gx-card' }, h('h3', { class: 'gx-h3', text: `${teams.find(x => x.id === r.team_id)?.name || 'একটা দল'} থেকে আমন্ত্রণ` }), h('div', { class: 'st-actions' },
      h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: () => act(() => rpc('respond_team_join', { p_request_id: r.id, p_actor_id: rec.id, p_accept: true }), 'দলে যোগ দিয়েছ!'), text: 'যোগ দাও' }), h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: () => act(() => rpc('respond_team_join', { p_request_id: r.id, p_actor_id: rec.id, p_accept: false }), 'ঠিক আছে'), text: 'এখন না' }))));
    if (v.team) {
      const reqs = v.isLead ? rows(await sel('team_join_requests', `select=id,student_id&team_id=eq.${v.team.id}&via=eq.request&status=eq.pending`)) : [];
      const free = mates.filter(x => !members.some(y => y.student_id === x.student_id));
      nodes.push(h('section', { class: 'de-card gx-card' }, h('div', { class: 'de-row' }, h('div', { class: 'de-row__main' }, h('h3', { class: 'gx-h3', text: v.team.name }), h('span', { class: 'de-row__sub', text: `${bn(v.mates.length)} / ${bn(6)} জন${v.isLead ? ' · তুমি দলনেতা' : ''}` }))),
        ...v.mates.map(x => h('div', { class: 'de-row gx-line' }, h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: name(x.student_id) + (x.student_id === v.team.lead_id ? ' ★' : '') })))),
        h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: async () => { if (await confirmBox({ title: 'দল ছাড়বে?', text: v.team.name, ok: 'হ্যাঁ, ছাড়ব', cancel: 'না', danger: true })) act(() => rpc('leave_team', { p_student_id: rec.id }), 'দল ছেড়েছ'); }, text: 'দল ছাড়ো' })));
      if (v.isLead) {
        if (reqs.length) nodes.push(section('যোগদানের অনুরোধ'), h('div', { class: 'de-card more-card' }, ...reqs.map(r => h('div', { class: 'de-row gx-line' }, h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: name(r.student_id) })),
          h('button', { class: 'de-btn de-btn--primary st-go', type: 'button', onclick: () => act(() => rpc('respond_team_join', { p_request_id: r.id, p_actor_id: rec.id, p_accept: true }), 'দলে নিয়েছ'), text: 'নাও' })))));
        if (free.length && !teamIsFull(v.mates.length)) nodes.push(section('বন্ধুকে ডাকো'), h('div', { class: 'de-card more-card' }, ...free.map(x => h('div', { class: 'de-row gx-line' }, h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: x.display_name })),
          h('button', { class: 'de-btn de-btn--secondary st-go', type: 'button', onclick: () => act(() => rpc('invite_to_team', { p_lead_id: rec.id, p_student_id: x.student_id }), 'আমন্ত্রণ গেছে'), text: 'ডাকো' })))));
      }
    } else {
      nodes.push(h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: async () => {
        const names = rows(await sel('team_name_options', 'select=name')).map(x => x.name).filter(n => !teams.some(x => x.name === n));
        const sheet = openSheet({ title: 'দলের নাম বেছে নাও', content: h('div', { class: 'opt-list' }, ...names.map(n => h('button', { class: 'opt', type: 'button', onclick: () => { sheet.close(); act(() => rpc('create_team', { p_student_id: rec.id, p_name: n }), 'দল তৈরি হয়েছে!'); } }, h('span', { class: 'opt__t', text: n })))) });
      }, text: 'নতুন দল গড়ো' }), section('ক্লাসের দলগুলো'),
      teams.length ? h('div', { class: 'de-card more-card' }, ...teams.map(x => { const n = v.countOf(x.id), asked = v.asked.has(x.id); return h('div', { class: 'de-row gx-line' }, h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: x.name }), h('span', { class: 'de-row__sub', text: `${bn(n)} / ${bn(6)} জন` })),
        asked ? h('span', { class: 'de-chip de-chip--plain', text: 'অনুরোধ গেছে' }) : teamIsFull(n) ? h('span', { class: 'de-chip de-chip--plain', text: 'ভর্তি' }) : h('button', { class: 'de-btn de-btn--secondary st-go', type: 'button', onclick: () => act(() => rpc('request_team_join', { p_student_id: rec.id, p_team_id: x.id }), 'অনুরোধ পাঠানো হয়েছে'), text: 'যোগ দিতে চাই' })); }))
        : emptyState('এখনো কোনো দল নেই', 'প্রথম দলটা তুমিই গড়তে পারো!'));
    }
    nodes.push(h('p', { class: 'de-row__sub gx-note', text: 'দল শুধু নিজের ক্লাসের বন্ধুদের নিয়ে, সর্বোচ্চ ৬ জন। দলের নাম অফিসের দেওয়া তালিকা থেকে বাছতে হয়।' }));
    root.replaceChildren(...nodes);
  };
  draw();
  return { node: root, destroy() { dead = true; } };
}

// ---- points shop (the live app's stars -> avatar shop, fun.sql buy_item / equip_item) ----
export function shopPage() {
  const root = h('div', { class: 'st-page' });
  let dead = false;
  const draw = async () => {
    const rec = await me();
    if (!rec) return root.replaceChildren(noRecState());
    const rr = await sel('student_rewards', `select=stars,owned,avatar&student_id=eq.${rec.id}`);
    if (dead) return;
    if (rr.kind !== 'ok') return root.replaceChildren(stateCard({ kind: rr.kind === 'offline' ? 'offline' : 'error', title: rr.kind === 'offline' ? 'ইশ, নেট হারিয়ে গেছে' : 'ইশ, তথ্য আনা যায়নি', text: 'আবার চেষ্টা করো।', action: 'আবার চেষ্টা করো', onAction: draw }));
    const w = rows(rr)[0] || { stars: 0, owned: [] }, owned = new Set(w.owned || []);
    self.patch({ stars: w.stars, owned: w.owned || [], avatar: w.avatar || null });
    const buy = async item => {
      if (!canAfford(w.stars, item[0])) return toast(`আর ${bn(item[4] - w.stars)}টা স্টার হলে এটা পাবে। কুইজ খেলে স্টার জমাও!`);
      if (!await confirmBox({ title: 'কিনবে?', text: `${item[2]} ${item[3]} · ${bn(item[4])} স্টার`, ok: 'কিনে নাও', cancel: 'না, থাক' })) return;
      const r = await rpc('buy_item', { p_student_id: rec.id, p_item: item[0] });
      if (r.kind !== 'ok') return toast(/not enough/.test(msgOf(r)) ? 'যথেষ্ট স্টার নেই।' : 'এখন হলো না, একটু পরে আবার চেষ্টা করো।');
      await equip(item[0]);
    };
    const equip = async key => {
      const off = w.avatar === key, r = await rpc('equip_item', { p_student_id: rec.id, p_slot: 'avatar', p_item: off ? null : key });
      toast(r.kind === 'ok' ? 'হয়ে গেছে!' : 'এখন হলো না, আবার চেষ্টা করো।'); draw();
    };
    root.replaceChildren(h('section', { class: 'de-card st-prog' }, h('span', { class: 'de-row__sub', text: 'তোমার স্টার' }), h('span', { class: 'st-prog__n' }, icon('star'), h('b', { text: bn(w.stars) }), h('span', { text: 'স্টার' }))),
      section('অবতার'), tiles(SHOP.map(it => ({ e: it[2], title: it[3], sub: w.avatar === it[0] ? 'ব্যবহার হচ্ছে' : owned.has(it[0]) ? 'চাপলে ব্যবহার করো' : `${bn(it[4])} স্টার`, on: w.avatar === it[0], onclick: () => (owned.has(it[0]) ? equip(it[0]) : buy(it)) }))),
      h('p', { class: 'de-row__sub gx-note', text: 'অবতার শুধু তুমি আর তোমার বন্ধুরা প্রোফাইলে দেখে। স্টার পাওয়া যায় কুইজ আর খেলায়।' }));
  };
  root.append(loading(2)); draw();
  return { node: root, destroy() { dead = true; } };
}

// ---- decor (45): place the mascot, frame, backdrop and up to 6 stickers the office gave ----
export function decorPage() {
  const root = h('div', { class: 'st-page' });
  let dead = false;
  const draw = async () => {
    const rec = await me();
    if (!rec) return root.replaceChildren(noRecState());
    const [c, o, d] = await Promise.all([sel('sticker_catalog', 'select=key,kind,label,emoji,stars_price&active=is.true'), sel('student_stickers', `select=sticker_key&student_id=eq.${rec.id}`), sel('student_decor', `select=mascot,frame,backdrop,placed&student_id=eq.${rec.id}`)]);
    if (dead) return;
    const bad = [c, o, d].find(x => x.kind !== 'ok');
    if (bad) return root.replaceChildren(stateCard({ kind: bad.kind === 'offline' ? 'offline' : 'error', title: bad.kind === 'offline' ? 'ইশ, নেট হারিয়ে গেছে' : 'ইশ, তথ্য আনা যায়নি', text: 'আবার চেষ্টা করো।', action: 'আবার চেষ্টা করো', onAction: draw }));
    const cat = rows(c), have = new Set(rows(o).map(x => x.sticker_key)), mine = cat.filter(x => have.has(x.key)), rest = cat.filter(x => !have.has(x.key));
    const cur = rows(d)[0] || {}, s = { mascot: cur.mascot || null, frame: cur.frame || null, backdrop: cur.backdrop || null, placed: [...(cur.placed || [])] };
    const em = k => cat.find(x => x.key === k)?.emoji || '';
    const paint = () => {
      const pick = kind => h('div', { class: 'chips', role: 'group', 'aria-label': DECOR_KINDS.find(k => k[0] === kind)[1] }, h('button', { class: 'de-chip' + (!s[kind] ? ' is-on' : ''), type: 'button', 'aria-pressed': String(!s[kind]), onclick: () => { s[kind] = null; paint(); }, text: 'কিছু না' }),
        ...mine.filter(x => x.kind === kind).map(x => h('button', { class: 'de-chip' + (s[kind] === x.key ? ' is-on' : ''), type: 'button', 'aria-pressed': String(s[kind] === x.key), onclick: () => { s[kind] = x.key; paint(); }, text: `${x.emoji} ${x.label}` })));
      put(root,
        h('section', { class: 'de-card st-stage', 'data-back': s.backdrop || '', 'data-frame': s.frame || '' }, h('span', { class: 'st-stage__m', 'aria-hidden': 'true', text: em(s.mascot) || '🙂' }), h('span', { class: 'st-stage__s', 'aria-hidden': 'true', text: s.placed.map(em).join(' ') }),
          h('span', { class: 'de-row__sub', text: [s.mascot && cat.find(x => x.key === s.mascot).label, s.frame && cat.find(x => x.key === s.frame).label, s.backdrop && cat.find(x => x.key === s.backdrop).label].filter(Boolean).join(' · ') || 'তোমার পাওয়া জিনিস দিয়ে সাজাও' })),
        mine.length ? [...DECOR_KINDS.flatMap(([k, t]) => [section(t), pick(k)]),
          section(`স্টিকার (সর্বোচ্চ ${bn(MAX_STICKERS)}টা · এখন ${bn(s.placed.length)}টা)`),
          h('div', { class: 'chips', role: 'group', 'aria-label': 'স্টিকার' }, ...mine.filter(x => x.kind === 'sticker').map(x => h('button', { class: 'de-chip' + (s.placed.includes(x.key) ? ' is-on' : ''), type: 'button', 'aria-pressed': String(s.placed.includes(x.key)), onclick: () => { const t = toggleSticker(s.placed, x.key); if (t.full) return toast('সর্বোচ্চ ৬টা স্টিকার।'); s.placed = t.placed; paint(); }, text: `${x.emoji} ${x.label}` }))),
          h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: async e => {
            e.currentTarget.disabled = true;
            const r = await rpc('set_decor', { p_student_id: rec.id, p_mascot: s.mascot, p_frame: s.frame, p_backdrop: s.backdrop, p_stickers: s.placed });
            e.currentTarget.disabled = false; toast(r.kind === 'ok' ? 'সংরক্ষিত হয়েছে!' : r.kind === 'offline' ? 'নেট নেই, নেট এলে আবার চেষ্টা করো।' : 'সংরক্ষণ হয়নি। আবার চেষ্টা করো।');
          }, text: 'সংরক্ষণ করো' })]
          : emptyState('এখনো কোনো মাসকট বা স্টিকার নেই', 'নতুন জিনিস পেলে এখানে সাজাতে পারবে।'),
        rest.length ? [section('আরও যা পাওয়া যাবে'), h('div', { class: 'de-card more-card' }, ...rest.map(x => h('div', { class: 'de-row gx-line is-dim' }, h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: `${x.emoji} ${x.label}` }), h('span', { class: 'de-row__sub', text: `${bn(x.stars_price)} স্টার · অফিস দিলে পাবে` })))),
          h('p', { class: 'de-row__sub gx-note', text: 'এগুলো এখন অফিস থেকে দেওয়া হয়। স্টার দিয়ে কেনার সুবিধা পরে আসবে।' }))] : null);
    };
    paint();
  };
  root.append(loading(2)); draw();
  return { node: root, destroy() { dead = true; } };
}

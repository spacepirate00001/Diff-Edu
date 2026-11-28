// "মিমস": students share text or picture memes; a teacher approves each one before the whole coaching sees it.
// Student page /play/memes (everyone's memes, my memes, a form to post). Teacher page /more/memes (waiting list, live list, remove).
// Safety: nothing is public before approval, anyone can report (3 reports send it back to the teachers), students can delete their own, teachers can remove any.
import { h } from '../../ui/dom.js';
import { chip, chipRow } from '../../ui/chip.js';
import { emptyState, loading, stateCard } from '../../ui/states.js';
import { toast } from '../../ui/toast.js';
import { field } from '../../ui/field.js';
import { bn, agoText } from '../../core/bn.js';
import { me as myRecord, noRecState } from '../student/common.js';
import { MAX_TEXT, PIC_TYPES, STATUS_BN, STATUS_TONE, byline, sayError } from './logic.js';
import * as D from './data.js';

// the stylesheet loads with the first meme page
const cssReady = new Promise(res => {
  if (typeof document === 'undefined' || document.querySelector('link[data-memes-css]')) return res();
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'ui/memes.css'; l.dataset.memesCss = '1';
  l.onload = l.onerror = () => res(); document.head.append(l);
});
const netCard = retry => stateCard({ kind: 'offline', title: 'ইশ, নেট হারিয়ে গেছে', text: 'নেট চালু করে আবার চেষ্টা করো।', action: 'আবার চেষ্টা করো', onAction: retry });

// the picture of a meme: a quiet box that fills in once the link is ready
function picture(path, alt) {
  const img = h('img', { class: 'mm-img', alt, loading: 'lazy', decoding: 'async' }), box = h('div', { class: 'mm-pic' }, img);
  D.pictureUrl(path).then(u => { if (u) img.src = u; else box.classList.add('is-bad'); });
  return box;
}
const memeBody = m => [m.image_path ? picture(m.image_path, m.body ? 'মিমের ছবি: ' + m.body : 'মিমের ছবি') : null, m.body ? h('p', { class: 'mm-text' + (m.image_path ? ' mm-text--cap' : ''), text: m.body }) : null];

// ---------------------------------------------------------------- student
export function memesPage(ctx) {
  const root = h('div', { class: 'st-page mm-page' });
  let dead = false, tab = 'all', feed = [], more = true, busy = false;
  const say = (...k) => root.replaceChildren(...k.flat(Infinity).filter(Boolean));
  const tabs = () => chipRow('মিমস', [chip('সবার মিম', tab === 'all', () => { tab = 'all'; home(); }), chip('আমার মিম', tab === 'mine', () => { tab = 'mine'; home(); })]);
  const top = () => [h('button', { class: 'de-btn de-btn--primary mm-new', type: 'button', text: '😂 নতুন মিম দাও', onclick: compose }), tabs()];

  async function home() {
    say(top(), loading(2));
    const rec = await myRecord(); if (dead) return;
    if (!rec) return say(noRecState(home));
    if (tab === 'mine') return mine();
    feed = []; more = true;
    const ok = await page(); if (dead || !ok) return;
    draw();
  }
  async function page() {
    const r = await D.loadFeed(feed.length ? feed[feed.length - 1].at : null); if (dead) return false;
    if (r.kind === 'offline') { say(top(), netCard(home)); return false; }
    if (r.kind !== 'ok') { say(top(), stateCard({ kind: 'error', title: 'মিমের পাতা এখনো চালু হয়নি', text: 'একটু পরে আবার দেখো।' })); return false; }
    const got = D.rows(r); feed.push(...got); more = got.length >= 12; return true;
  }
  function draw() {
    if (!feed.length) return say(top(), emptyState('এখনো কোনো মিম নেই', 'প্রথম মিমটা তুমিই দাও! স্যার দেখে অনুমোদন দিলেই সবাই হাসতে পারবে।'));
    say(top(), h('p', { class: 'de-row__sub gx-note', text: 'এখানে সবাই হাসুক, কাউকে ছোট করে নয়। কিছু ঠিক না লাগলে রিপোর্ট করো।' }), ...feed.map(card),
      more ? h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: 'আরও মিম দেখাও', onclick: async () => { if (busy) return; busy = true; await page(); busy = false; if (!dead) draw(); } }) : h('p', { class: 'de-row__sub st-center', text: 'আজকের মতো সব দেখা শেষ 🎉' }));
  }
  function card(m) {
    const count = h('span', { class: 'mm-n', text: bn(m.laughs) });
    const lbtn = h('button', { class: 'mm-act' + (m.laughed ? ' is-on' : ''), type: 'button', 'aria-pressed': String(!!m.laughed), 'aria-label': 'হাহা দাও' }, h('span', { 'aria-hidden': 'true', text: '😂' }), count);
    lbtn.addEventListener('click', async () => {
      lbtn.disabled = true; const r = await D.laugh(m.id); lbtn.disabled = false;
      if (r.kind !== 'ok') return toast(r.kind === 'offline' ? 'নেট নেই, একটু পরে চেষ্টা করো।' : 'এখন হলো না।');
      m.laughed = !m.laughed; m.laughs = Number(r.data) || 0; count.textContent = bn(m.laughs); lbtn.classList.toggle('is-on', m.laughed); lbtn.setAttribute('aria-pressed', String(m.laughed));
    });
    const side = m.mine
      ? h('button', { class: 'de-btn de-btn--text', type: 'button', text: 'মুছে দাও', onclick: () => ask(side, 'সত্যিই মুছবে?', async () => { const r = await D.removeMine(m.id); if (r.kind !== 'ok') return toast('এখন হলো না।'); feed = feed.filter(x => x.id !== m.id); toast('মুছে ফেলা হয়েছে'); draw(); }) })
      : h('button', { class: 'de-btn de-btn--text', type: 'button', text: 'রিপোর্ট', onclick: () => ask(side, 'কিছু ঠিক নেই? জানিয়ে দেবে?', async () => { const r = await D.report(m.id); toast(r.kind === 'ok' ? 'জানানোর জন্য ধন্যবাদ। স্যার দেখবেন।' : 'এখন হলো না।'); if (r.kind === 'ok') { side.textContent = 'জানানো হয়েছে'; side.disabled = true; } }) });
    return h('article', { class: 'de-card mm-card' }, h('p', { class: 'de-row__sub mm-by', text: byline(m.author, m.class_level, bn) + (m.mine ? ' (তুমি)' : '') }), ...memeBody(m), h('div', { class: 'mm-bar' }, lbtn, side));
  }
  // a second tap to be sure, in the same place
  function ask(btn, text, fn) {
    const old = btn.textContent; btn.textContent = text + ' হ্যাঁ'; btn.classList.add('is-ask');
    const undo = setTimeout(() => { btn.textContent = old; btn.classList.remove('is-ask'); btn.onclick = again; }, 4000);
    const again = btn.onclick; btn.onclick = () => { clearTimeout(undo); btn.onclick = again; btn.classList.remove('is-ask'); fn(); };
  }

  async function mine() {
    const r = await D.loadMine(); if (dead) return;
    if (r.kind === 'offline') return say(top(), netCard(home));
    if (r.kind !== 'ok') return say(top(), stateCard({ kind: 'error', title: 'মিমের পাতা এখনো চালু হয়নি', text: 'একটু পরে আবার দেখো।' }));
    const list = D.rows(r);
    if (!list.length) return say(top(), emptyState('তুমি এখনো মিম দাওনি', 'ওপরের বোতামে চেপে প্রথমটা দিয়ে ফেলো।'));
    say(top(), ...list.map(m => h('article', { class: 'de-card mm-card' },
      h('div', { class: 'mm-row' }, h('span', { class: 'de-chip de-chip--' + (STATUS_TONE[m.status] || 'plain'), text: STATUS_BN[m.status] || m.status }), h('span', { class: 'de-row__sub', text: agoText(m.created_at) })),
      ...memeBody(m.status === 'rejected' ? { ...m, image_path: null, body: m.body || '(ছবির মিম)' } : m),
      h('div', { class: 'mm-bar' }, h('button', { class: 'de-btn de-btn--text', type: 'button', text: 'মুছে দাও', onclick: async () => { const x = await D.removeMine(m.id); if (x.kind === 'ok') mine(); else toast('এখন হলো না।'); } })))));
  }

  // the form
  function compose() {
    const text = field({ label: 'মিমের লেখা', multiline: true, rows: 4, maxlength: MAX_TEXT, help: 'ছবি না দিলে লেখাই মিম। ছবি দিলে লেখা ঐচ্ছিক।' });
    const file = h('input', { class: 'mm-file', type: 'file', accept: PIC_TYPES.join(','), 'aria-label': 'ছবি বাছাই করো' });
    const prev = h('div', { class: 'mm-prev' });
    let blob = null, working = false;
    file.addEventListener('change', async () => {
      blob = null; prev.replaceChildren(); const f = file.files?.[0]; if (!f) return;
      if (!f.type.startsWith('image/')) { file.value = ''; return toast('শুধু ছবি দেওয়া যাবে।'); }
      prev.textContent = 'ছবি ছোট করা হচ্ছে…';
      blob = await D.shrinkPhoto(f);
      if (!blob) { file.value = ''; prev.textContent = ''; return toast('এই ছবিটা পড়া গেল না, অন্য ছবি দাও।'); }
      prev.replaceChildren(h('img', { class: 'mm-img', alt: 'তোমার ছবি', src: URL.createObjectURL(blob) }));
    });
    const send = h('button', { class: 'de-btn de-btn--primary', type: 'button', text: 'স্যারের কাছে পাঠাও' });
    send.addEventListener('click', async () => {
      if (working) return;
      const body = text.input.value.trim();
      if (!body && !blob) return text.error('কিছু একটা লেখো বা ছবি দাও।');
      text.error(''); working = true; send.disabled = true; send.textContent = 'পাঠানো হচ্ছে…';
      const r = await D.post({ body, blob, coachingId: ctx.me.coaching_id });
      working = false; send.disabled = false; send.textContent = 'স্যারের কাছে পাঠাও';
      if (r.error === 'offline') return toast('নেট নেই। নেট এলে আবার পাঠাও।');
      if (r.error === 'picture') return toast('ছবি যায়নি। আবার চেষ্টা করো।');
      if (r.error) return toast(sayError(r.error));
      toast('পাঠানো হয়েছে! স্যার অনুমোদন দিলে সবাই দেখবে।'); tab = 'mine'; home();
    });
    say(h('button', { class: 'de-btn de-btn--text', type: 'button', text: '← ফিরে যাও', onclick: home }), h('h2', { class: 'st-h', text: 'নতুন মিম' }),
      h('div', { class: 'de-card mm-card' }, text.el, h('label', { class: 'de-field__label', text: 'ছবি (ঐচ্ছিক)' }), file, prev),
      h('p', { class: 'de-row__sub gx-note', text: 'স্যার দেখে ঠিক মনে করলে তবেই মিমটা সবার কাছে যাবে। কাউকে অপমান বা কারও ছবি দিয়ে খারাপ কিছু নয়, কেমন?' }), send);
  }

  cssReady.then(home);
  return { node: root, destroy() { dead = true; } };
}

// ---------------------------------------------------------------- teacher / admin
export function memeReviewPage() {
  const root = h('div', { class: 'tc-page mm-page' });
  let dead = false, tab = 'pending';
  const say = (...k) => root.replaceChildren(...k.flat(Infinity).filter(Boolean));
  const tabs = n => chipRow('মিম', [chip('অপেক্ষায়' + (n != null ? ` (${bn(n)})` : ''), tab === 'pending', () => { tab = 'pending'; load(); }), chip('এখন দেখা যাচ্ছে', tab === 'approved', () => { tab = 'approved'; load(); })]);
  async function load() {
    say(tabs(), loading(2));
    const r = await D.loadReview(tab); if (dead) return;
    if (r.kind === 'offline') return say(tabs(), netCard(load));
    if (r.kind !== 'ok') return say(tabs(), stateCard({ kind: 'error', title: 'মিমের পাতা এখনো চালু হয়নি', text: 'একটু পরে আবার দেখুন।' }));
    const list = D.rows(r), n = tab === 'pending' ? list.length : null;
    if (!list.length) return say(tabs(n), emptyState(tab === 'pending' ? 'অপেক্ষায় কোনো মিম নেই' : 'এখন কোনো মিম দেখা যাচ্ছে না', tab === 'pending' ? 'শিক্ষার্থী মিম দিলে এখানে আসবে।' : 'অনুমোদিত মিম এখানে থাকবে, দরকারে সরাতে পারবেন।'));
    say(tabs(n), h('p', { class: 'de-row__sub gx-note', text: tab === 'pending' ? 'অনুমোদন দিলে তবেই মিমটা সব শিক্ষার্থী দেখবে। যেগুলো রিপোর্ট হয়ে ফিরে এসেছে সেগুলোতে লাল চিহ্ন আছে।' : 'এগুলো এখন সবাই দেখছে।' }), ...list.map(card));
  }
  function card(m) {
    const act = (label, cls, fn) => h('button', { class: 'de-btn ' + cls, type: 'button', text: label, onclick: async e => { e.currentTarget.disabled = true; const r = await fn(); if (r.kind === 'ok') { toast('হয়ে গেছে'); load(); } else { toast(r.kind === 'offline' ? 'নেট নেই' : 'এখন হলো না'); e.currentTarget.disabled = false; } } });
    return h('article', { class: 'de-card mm-card' },
      h('div', { class: 'mm-row' }, h('b', { text: byline(m.author, m.class_level, bn) }), m.reports > 0 ? h('span', { class: 'de-chip de-chip--bad', text: `${bn(m.reports)}টা রিপোর্ট` }) : h('span', { class: 'de-row__sub', text: agoText(m.created_at) })),
      ...memeBody(m),
      h('div', { class: 'mm-bar' }, tab === 'pending'
        ? [act('অনুমোদন দিন', 'de-btn--primary', () => D.review(m.id, true)), act('রাখা যাবে না', 'de-btn--secondary', () => D.rejectOne(m.id, m.image_path))]
        : [act('সরিয়ে ফেলুন', 'de-btn--secondary', () => D.removeAny(m.id))]));
  }
  cssReady.then(load);
  return { node: root, destroy() { dead = true; } };
}

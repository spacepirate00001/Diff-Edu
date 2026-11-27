// P9: consent. First time (guardian only, forced): terms + eight switches per child + "আমি সম্মতি দিচ্ছি".
// Later ("আরও → গোপনীয়তা"): the same switches, plus the deletion request. Consent is a legal record, so it is never queued
// in the outbox: offline, the switches and button are off and say why.
import { h } from '../../ui/dom.js';
import { fullPage } from '../../ui/page.js';
import { icon } from '../../ui/icons.js';
import { toast } from '../../ui/toast.js';
import { confirmBox } from '../../ui/dialog.js';
import { loading, stateCard, errorState } from '../../ui/states.js';
import { net } from '../../core/net.js';
import { kids } from '../../core/children.js';
import { upsert, insert } from '../../core/api.js';
import { session } from '../../core/session.js';
import { PURPOSES, TERMS, NO_DIFFERENCE, OFF_NOTE, readChild, setAnswer, readOne } from './purposes.js';
import { speak } from '../inbox/speak.js';
import { classLabel } from '../today/today.js';
import { callOfficeButton } from '../auth/forgot.js';

export function consentPage(ctx, { first = false } = {}) {
  const box = h('div', { class: 'consent-body' });
  const state = {};            // studentId -> { on, mine }
  const offNote = h('p', { class: 'pin-offline', role: 'status', hidden: true, text: 'সম্মতি রেকর্ড করতে নেট লাগবে।' });
  const agree = h('button', { class: 'de-btn de-btn--primary', type: 'button', text: 'আমি সম্মতি দিচ্ছি', onclick: () => accept() });
  const tick = () => { const off = net.isOffline(); offNote.hidden = !off; agree.disabled = off || agree.dataset.busy === '1'; box.querySelectorAll('.cswitch').forEach(b => { b.disabled = off || b.dataset.busy === '1'; }); };
  const stop = net.on(tick);

  const termsCard = () => h('section', { class: 'de-card terms' }, h('h2', { class: 'de-row__title', text: 'আপনার সন্তানের তথ্য' }), h('p', { class: 'terms__text', text: TERMS }),
    h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: () => speak(TERMS), text: 'পড়ে শোনাও' }));

  function switchRow(k, [key, title, desc]) {
    const s = state[k.id]; const on = s.on[key], mine = s.mine.has(key);
    const b = h('button', { class: 'cswitch' + (on ? ' is-on' : ''), type: 'button', 'aria-pressed': String(on), onclick: () => toggle(k, key, b) },
      h('span', { class: 'cswitch__t' }, h('b', { text: title }), h('span', { class: 'cswitch__d', text: desc }),
        mine && !on ? h('span', { class: 'cswitch__why', text: 'অন্য অভিভাবক বা অফিস না বলেছেন, তাই এখনো বন্ধ।' }) : null),
      h('span', { class: 'cswitch__state', 'aria-hidden': 'true' }, on ? icon('check') : null, h('span', { text: on ? 'চালু' : 'বন্ধ' })));
    return b;
  }
  async function toggle(k, key, btn) {
    if (net.isOffline()) return tick();
    const s = state[k.id]; const want = !s.mine.has(key);
    btn.dataset.busy = '1'; btn.disabled = true;
    const r = await setAnswer(k.id, key, want);
    if (r.kind !== 'ok') { toast('সংরক্ষণ হয়নি'); delete btn.dataset.busy; return paint(); }
    want ? s.mine.add(key) : s.mine.delete(key);
    const eff = await readOne(k.id, key);
    s.on[key] = eff === null ? want : eff;
    if (!want && OFF_NOTE[key]) toast(OFF_NOTE[key]);
    paint();
  }
  function paint() {
    box.replaceChildren();
    const list = kids.list();
    if (!list.length) { box.append(stateCard({ kind: 'empty', title: 'কোনো সন্তানের তথ্য পাওয়া যায়নি।', text: 'কোচিং অফিসে যোগাযোগ করুন।', extra: callOfficeButton('অফিসে ফোন করুন') })); }
    for (const k of list) {
      box.append(h('section', { class: 'de-card consent-kid' }, h('h2', { class: 'de-row__title', text: `${k.name}${k.class_level ? ' · ' + classLabel(k.class_level) : ''}` }),
        h('p', { class: 'de-row__sub', text: NO_DIFFERENCE }), ...PURPOSES.map(p => switchRow(k, p))));
    }
    tick();
  }
  async function load() {
    box.replaceChildren(loading(2));
    if (!kids.list().length) await kids.load({ maxAge: 15000 });
    const list = kids.list();
    const res = await Promise.all(list.map(k => readChild(k.id)));
    const bad = res.find(r => !r.ok);
    if (bad) { box.replaceChildren(bad.kind === 'offline' ? stateCard({ kind: 'offline', title: 'ইশ, নেট হারিয়ে গেছে', text: 'সম্মতি দেখতে নেট লাগবে।', action: 'আবার চেষ্টা করুন', onAction: load }) : errorState(load)); return; }
    list.forEach((k, i) => { state[k.id] = { on: res[i].on, mine: res[i].mine }; });
    paint();
  }
  async function accept() {
    agree.dataset.busy = '1'; tick(); agree.classList.add('is-loading');
    const me = session.me();
    const r = await upsert('consents', { profile_id: session.uid(), coaching_id: me.coaching_id, app_terms: true, updated_at: new Date().toISOString() }, 'profile_id');
    agree.classList.remove('is-loading'); delete agree.dataset.busy;
    if (r.kind === 'ok') return ctx.afterConsent();
    tick(); toast(r.kind === 'offline' ? 'সম্মতি রেকর্ড করতে নেট লাগবে।' : 'সম্মতি জমা হয়নি। আবার চেষ্টা করুন।');
  }
  async function requestDeletion() {
    if (!await confirmBox({ title: 'তথ্য মুছে ফেলার অনুরোধ', text: 'অনুরোধ পাঠালে অফিস ৩০ দিনের মধ্যে আপনার ও সন্তানের তথ্য মুছে দেবে। পাঠাবেন?', ok: 'অনুরোধ পাঠান', cancel: 'না, থাক', danger: true })) return;
    const me = session.me();
    const r = await insert('deletion_requests', { coaching_id: me.coaching_id, profile_id: session.uid() });
    toast(r.kind === 'ok' ? 'অনুরোধ পাঠানো হয়েছে' : r.kind === 'offline' ? 'নেট লাগবে। নেট চালু করে আবার চেষ্টা করুন।' : 'পাঠানো যায়নি');
  }
  const extra = first
    ? [agree, h('button', { class: 'de-btn de-btn--text', type: 'button', onclick: () => ctx.logout(), text: 'লগআউট' })]
    : [h('section', { class: 'de-card danger-card' }, h('h2', { class: 'de-row__title', text: 'তথ্য মুছে ফেলার অনুরোধ' }), h('p', { class: 'de-row__sub', text: 'অনুরোধ করলে কোচিং অফিস ৩০ দিনের মধ্যে আপনার ও সন্তানের তথ্য মুছে দেবে।' }),
      h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: requestDeletion, text: 'অনুরোধ পাঠান' }))];
  const node = fullPage({ tone: 'cream', title: first ? 'আপনার সম্মতি' : 'গোপনীয়তা', back: !first, onBack: () => ctx.back(), label: 'consent', children: [termsCard(), h('h2', { class: 'consent-h', text: 'সন্তানের জন্য সম্মতি' }), box, offNote, ...extra] });
  load();
  return { node, destroy: stop };
}

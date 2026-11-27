// Chat with classmates (40/41/46): class 5 and up, own class, ready phrases and stickers only (no typing), the server holds the rules (opt-in, hours, blocks).
// Every message of someone else has "জানাও" (report_message with a fixed reason); a classmate can be blocked and unblocked. Only first names are shown.
import { h } from '../../ui/dom.js';
import { emptyState, loading, stateCard } from '../../ui/states.js';
import { openSheet } from '../../ui/sheet.js';
import { confirmBox } from '../../ui/dialog.js';
import { toast } from '../../ui/toast.js';
import { sel, rpc, rows } from '../../core/api.js';
import { clockText, shortDate, dhakaDay } from '../../core/bn.js';
import { me, noRecState } from './common.js';
import { CHAT_FROM, classAtLeast, CHAT_REASONS, chatError } from './logic.js';

const errOf = r => (r.kind === 'offline' ? 'নেট নেই। নেট এলে আবার চেষ্টা করো।' : chatError(r.data?.message));
const noRec = () => noRecState();
const tooYoung = () => emptyState('বন্ধুদের সাথে চ্যাট ৫ম শ্রেণি থেকে', 'ততদিন ক্লাসে বন্ধুদের সাথে গল্প করো!');
const fail = (kind, retry) => stateCard({ kind: kind === 'offline' ? 'offline' : 'error', title: kind === 'offline' ? 'ইশ, নেট হারিয়ে গেছে' : 'ইশ, তথ্য আনা যায়নি', text: 'আবার চেষ্টা করো।', action: 'আবার চেষ্টা করো', onAction: retry });

export function chatListPage(ctx) {
  const root = h('div', { class: 'st-page' });
  let dead = false;
  const draw = async () => {
    root.replaceChildren(loading(2));
    const rec = await me();
    if (!rec) return root.replaceChildren(noRec());
    if (!classAtLeast(rec.class_level, CHAT_FROM)) return root.replaceChildren(tooYoung());
    const r = await rpc('chat_classmates');
    if (dead) return;
    if (r.kind !== 'ok') return root.replaceChildren(fail(r.kind, draw));
    const list = r.data || [];
    root.replaceChildren(h('p', { class: 'de-row__sub gx-note', text: 'এখানে শুধু তৈরি বাক্য আর স্টিকার পাঠানো যায়, নিজে লেখা যায় না। কিছু ঠিক না লাগলে "জানাও" চাপো, শিক্ষক দেখবেন।' }),
      list.length ? h('div', { class: 'de-card more-card' }, ...list.map(p => h('button', { class: 'de-row more-row', type: 'button', onclick: () => ctx.go('/play/chat/' + p.peer_id) },
        h('span', { class: 'de-avatar kid-av', 'aria-hidden': 'true', text: Array.from(p.full_name)[0] || '?' }), h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: p.full_name }), p.blocked ? h('span', { class: 'de-row__sub', text: 'ব্লক করা আছে' }) : null))))
        : emptyState('এখনো কোনো বন্ধু চ্যাটের জন্য চালু নেই', 'চ্যাট চালু করতে অভিভাবকের অনুমতি লাগে। ক্লাসের সময়ে আর রাত ১০টার পরে চ্যাট বন্ধ থাকে।'));
  };
  draw();
  return { node: root, destroy() { dead = true; } };
}

export function chatPage(ctx, peerId) {
  const root = h('div', { class: 'st-page' });
  let dead = false, phrases = [];
  const when = t => (dhakaDay(t) === dhakaDay() ? clockText(t) : shortDate(t));
  const report = m => {
    const sheet = openSheet({ title: 'কেন জানাতে চাও?', content: h('div', { class: 'opt-list' }, h('p', { class: 'de-row__sub', text: `"${m.label}" বার্তাটা শিক্ষকের কাছে যাবে। বন্ধুকে বকা হবে না।` }),
      ...Object.entries(CHAT_REASONS).map(([code, label]) => h('button', { class: 'opt', type: 'button', onclick: async () => {
        sheet.close();
        const r = await rpc('report_message', { p_message: m.message_id, p_reason: code });
        toast(r.kind === 'ok' ? 'জানানো হয়েছে। শিক্ষক বিষয়টা দেখবেন।' : r.kind === 'offline' ? 'নেট নেই, নেট এলে আবার চেষ্টা করো।' : 'জানানো যায়নি, আবার চেষ্টা করো।');
      } }, h('span', { class: 'opt__t', text: label })))) });
  };
  const draw = async () => {
    const [cm, th] = await Promise.all([rpc('chat_classmates'), rpc('chat_thread', { p_peer: peerId })]);
    if (dead) return;
    if (cm.kind !== 'ok' || th.kind !== 'ok') return root.replaceChildren(fail(cm.kind !== 'ok' ? cm.kind : th.kind, draw));
    const peer = (cm.data || []).find(p => p.peer_id === peerId);
    if (!peer) return root.replaceChildren(emptyState('এই বন্ধুর সাথে এখন চ্যাট করা যাচ্ছে না', 'চ্যাটের তালিকায় ফিরে আরেকজনকে বেছে নাও।', h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: () => ctx.replace('/play/chat'), text: 'চ্যাটের তালিকা' })));
    const msgs = th.data || [];
    const log = h('div', { class: 'chat-log', role: 'log', 'aria-label': `${peer.full_name}-এর সাথে বার্তা`, tabindex: '0' }, ...(msgs.length
      ? msgs.map(m => h('div', { class: 'de-msg ' + (m.mine ? 'de-msg--me' : 'de-msg--bot') }, h('span', { class: 'chat-who', text: `${m.mine ? 'তুমি' : peer.full_name} · ${when(m.sent_at)}` }), h('span', { text: m.label }),
        m.mine ? null : h('button', { class: 'de-msg__t', type: 'button', 'aria-label': `জানাও: ${m.label}`, onclick: () => report(m), text: 'জানাও' })))
      : [emptyState('এখনো কোনো বার্তা নেই', 'নিচ থেকে বাক্য বা স্টিকার বেছে নাও।')]));
    const send = async b => {
      b.disabled = true;
      const t = await rpc('open_chat_thread', { p_other: peerId });
      const r = t.kind === 'ok' ? await rpc('send_chat_phrase', { p_thread: t.data, p_phrase: b.dataset.id }) : t;
      if (r.kind !== 'ok') { b.disabled = false; return toast(errOf(r)); }
      draw();
    };
    const pick = (kind, title) => {
      const l = phrases.filter(p => p.kind === kind);
      return l.length ? [h('h2', { class: 'inbox-group__h', text: title }), h('div', { class: 'chips chat-phrases' }, ...l.map(p => h('button', { class: 'de-chip', type: 'button', 'data-id': p.id, onclick: e => send(e.currentTarget), text: p.label })))] : [];
    };
    root.replaceChildren(h('div', { class: 'st-row' }, h('b', { text: peer.full_name }), h('button', { class: 'de-btn de-btn--text', type: 'button', onclick: async () => {
      if (!peer.blocked && !await confirmBox({ title: 'ব্লক করবে?', text: `${peer.full_name}-কে ব্লক করলে চ্যাট বন্ধ থাকবে। যখন ইচ্ছা আনব্লক করতে পারবে।`, ok: 'ব্লক করো', cancel: 'না', danger: true })) return;
      const r = await rpc(peer.blocked ? 'unblock_chat' : 'block_chat', { p_other: peerId });
      toast(r.kind === 'ok' ? (peer.blocked ? 'ব্লক সরানো হয়েছে।' : 'ব্লক করা হয়েছে।') : 'এখন হলো না, আবার চেষ্টা করো।');
      draw();
    }, text: peer.blocked ? 'আনব্লক করো' : 'ব্লক করো' })), log,
    peer.blocked ? h('p', { class: 'de-banner de-banner--info', role: 'status' }, 'এই বন্ধুকে ব্লক করা আছে। ব্লক সরালে আবার চ্যাট করা যাবে।') : h('div', { class: 'de-card' }, ...pick('phrase', 'বাক্য'), ...pick('sticker', 'স্টিকার')));
    log.scrollTop = log.scrollHeight;
  };
  (async () => {
    root.append(loading(2));
    const rec = await me();
    if (!rec) return root.replaceChildren(noRec());
    if (!classAtLeast(rec.class_level, CHAT_FROM)) return root.replaceChildren(tooYoung());
    phrases = rows(await sel('chat_phrases', 'select=id,kind,label&active=is.true&order=code'));
    draw();
  })();
  const timer = setInterval(() => { if (!root.isConnected) clearInterval(timer); else if (!document.hidden && !dead && phrases.length) draw(); }, 20000);
  return { node: root, destroy() { dead = true; clearInterval(timer); } };
}

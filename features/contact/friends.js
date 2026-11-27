// Read-only view of the child's phrase chat with classmates, with "report this message". Children can only send ready phrases and stickers
// (no free text exists, 40-chat-phrases.sql); a guardian may read the child's threads (RLS chat_thread_member) and report one message with a reason code
// through rpc report_message(p_message, p_reason). The other child is shown only as "একজন সহপাঠী" (no name, same privacy as the games).
import { h } from '../../ui/dom.js';
import { openSheet } from '../../ui/sheet.js';
import { emptyState } from '../../ui/states.js';
import { toast } from '../../ui/toast.js';
import { childPage } from '../../ui/datapage.js';
import { sel, rows, rpc } from '../../core/api.js';
import { clockText, shortDate, dhakaDay } from '../../core/bn.js';
import { REPORT_REASONS, REASON_CODES, canReport } from './rules.js';

async function loadChats(kid) {
  const t = await sel('chat_threads', `select=id,student_a,student_b&or=(student_a.eq.${kid.id},student_b.eq.${kid.id})`);
  if (t.kind !== 'ok') return { kind: t.kind };
  const ids = rows(t).map(x => x.id);
  if (!ids.length) return { kind: 'ok', data: [] };
  const m = await sel('chat_messages', `select=id,thread_id,sender_id,created_at,phrase:chat_phrases(label,kind)&thread_id=in.(${ids.join(',')})&order=created_at&limit=100`);
  return m.kind === 'ok' ? { kind: 'ok', data: rows(m) } : { kind: m.kind };
}
function openReport(m) {
  let sheet;
  const send = async reason => {
    const r = await rpc('report_message', { p_message: m.id, p_reason: reason });
    sheet.close();
    toast(r.kind === 'ok' ? 'জানানো হয়েছে। শিক্ষক বিষয়টা দেখবেন।' : r.kind === 'offline' ? 'নেট নেই, নেট এলে আবার চেষ্টা করুন।' : 'জানানো যায়নি, আবার চেষ্টা করুন।');
  };
  sheet = openSheet({ title: 'কেন জানাতে চান?', content: h('div', { class: 'opt-list' }, h('p', { class: 'de-row__sub', text: `"${m.phrase?.label || ''}" বার্তাটা শিক্ষকের কাছে যাবে। সন্তানকে বকা হবে না।` }),
    ...REASON_CODES.map(c => h('button', { class: 'opt', type: 'button', onclick: () => send(c) }, h('span', { class: 'opt__t', text: REPORT_REASONS[c] })))) });
}
export const friendsPage = () => childPage({
  key: 'friends', load: loadChats, isEmpty: d => !d.length,
  empty: () => emptyState('বন্ধুদের সাথে চ্যাট নেই', 'সন্তান বন্ধুর সাথে চ্যাট শুরু করলে এখানে পড়তে পারবেন।'),
  draw: (list, kid) => [h('p', { class: 'de-row__sub gx-note', text: `${kid.name} শুধু তৈরি বাক্য আর স্টিকারে কথা বলে। কিছু ঠিক না লাগলে বার্তায় চাপ দিয়ে জানান।` }),
    h('div', { class: 'chat-log chat-log--ro', role: 'log', 'aria-label': 'বন্ধুদের চ্যাট' }, ...list.map(m => { const mine = !canReport(m, [kid.id]);
      return h(mine ? 'div' : 'button', { class: 'de-msg ' + (mine ? 'de-msg--me' : 'de-msg--bot'), type: mine ? null : 'button', 'aria-label': mine ? null : `জানান: ${m.phrase?.label}`, onclick: mine ? null : () => openReport(m) },
        h('span', { class: 'chat-who', text: `${mine ? kid.name : 'একজন সহপাঠী'} · ${dhakaDay(m.created_at) === dhakaDay() ? clockText(m.created_at) : shortDate(m.created_at)}` }), h('span', { text: (m.phrase?.kind === 'sticker' ? '★ ' : '') + (m.phrase?.label || '') }),
        mine ? null : h('span', { class: 'de-msg__sub', text: 'ঠিক না লাগলে চাপুন' })); }))],
});

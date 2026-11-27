// Guardian <-> teachers chat for the chosen child (table `messages`, thread = the child; same contract as the old app's comms.js).
// Ready sentences (rules.js PHRASES) fill the box but are never sent until "পাঠান" is pressed. With no net the message waits on the phone (outbox).
import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { emptyState } from '../../ui/states.js';
import { toast } from '../../ui/toast.js';
import { childPage } from '../../ui/datapage.js';
import { sel, rows, insert } from '../../core/api.js';
import { bn, clockText, shortDate, dhakaDay, uuid } from '../../core/bn.js';
import { session } from '../../core/session.js';
import { outbox } from '../../core/outbox-app.js';
import { PHRASES, MAX_LEN, validateMessage, addPhrase, messageRow } from './rules.js';

async function loadThread(kid) {
  const r = await sel('messages', `select=id,body,created_at,sender_id&thread_student_id=eq.${kid.id}&order=created_at`);
  if (r.kind !== 'ok') return { kind: r.kind };
  const list = rows(r), ids = [...new Set(list.map(m => m.sender_id))];
  const s = ids.length ? rows(await sel('staff_public', `select=id,full_name,role&id=in.(${ids.join(',')})`)) : [];
  const names = Object.fromEntries(s.map(p => [p.id, p.full_name]));
  return { kind: 'ok', data: list.map(m => ({ ...m, who: names[m.sender_id] || 'শিক্ষক' })) };
}

// -> { result: 'sent' | 'kept' (waits on the phone) | 'failed', row }. The client id makes a repeat of the same send the same message.
export async function sendMessage(me, kid, text) {
  const row = messageRow({ id: uuid(), coaching_id: me.coaching_id, student_id: kid.id, sender_id: me.id, body: text });
  const r = await insert('messages', row);
  if (r.kind === 'ok' || r.kind === 'conflict') return { result: 'sent', row };
  if (r.kind === 'offline' || r.kind === 'server' || r.kind === 'rate') {
    const kept = await outbox.add({ uid: session.uid(), method: 'POST', path: '/rest/v1/messages', body: row, prefer: 'return=minimal', label: 'শিক্ষককে বার্তা' });
    if (kept) return { result: 'kept', row };
  }
  return { result: 'failed', row };
}

export function chatPage(ctx) {
  const me = ctx.me;
  const page = childPage({
    key: 'thread', load: loadThread,
    draw: (list, kid, reload) => {
      const log = h('div', { class: 'chat-log', role: 'log', 'aria-label': 'বার্তা', tabindex: '0' });
      const waiting = [];                       // messages kept on the phone, shown until they go
      const paintLog = () => {
        const all = [...list.map(m => ({ ...m, mine: m.sender_id === me.id })), ...waiting.map(m => ({ ...m, mine: true, kept: true }))];
        log.replaceChildren(...(all.length ? all.map(m => h('div', { class: 'de-msg ' + (m.mine ? 'de-msg--me' : 'de-msg--bot') },
          h('span', { class: 'chat-who', text: `${m.mine ? 'আপনি' : m.who} · ${dhakaDay(m.created_at) === dhakaDay() ? clockText(m.created_at) : shortDate(m.created_at)}` }), h('span', { text: m.body }), m.kept ? h('span', { class: 'de-msg__sub', text: 'ফোনে রাখা আছে, নেট এলে যাবে' }) : null))
          : [emptyState('এখনো কোনো বার্তা নেই', `${kid.name}-এর শিক্ষকদের জন্য প্রথম বার্তা লিখুন।`)]));
        log.scrollTop = log.scrollHeight;
      };
      const box = h('textarea', { class: 'de-field__input chat-box', rows: '2', maxlength: String(MAX_LEN), 'aria-label': 'আপনার বার্তা', placeholder: 'এখানে বার্তা লিখুন' });
      const send = h('button', { class: 'de-btn de-btn--primary chat-send', type: 'button', text: 'পাঠান' });
      const chips = h('div', { class: 'chips chat-phrases', role: 'group', 'aria-label': 'তৈরি বাক্য' }, ...PHRASES.map(p => h('button', { class: 'de-chip', type: 'button', onclick: () => { box.value = addPhrase(box.value, p); box.focus(); }, text: p })));
      send.addEventListener('click', async () => {
        const v = validateMessage(box.value);
        if (!v.ok) return toast(v.why === 'long' ? 'বার্তা একটু ছোট করুন।' : 'আগে কিছু লিখুন।');
        send.disabled = true;
        const r = await sendMessage(me, kid, v.text);
        send.disabled = false;
        if (r.result === 'sent') { box.value = ''; return reload(); }
        if (r.result === 'kept') { waiting.push({ id: r.row.id, body: r.row.body, created_at: new Date().toISOString() }); box.value = ''; paintLog(); return toast('নেট নেই। বার্তা ফোনে রাখা হলো, নেট এলে যাবে।'); }
        toast('বার্তা যায়নি, আবার চেষ্টা করুন।');
      });
      paintLog();
      const timer = setInterval(() => { if (!log.isConnected) clearInterval(timer); else if (document.activeElement !== box && !document.hidden) reload(); }, 20000);
      return h('div', { class: 'chat' }, log, h('div', { class: 'chat-form' }, box, send), chips);
    },
  });
  return page;
}
export { icon, bn };

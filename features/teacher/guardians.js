// Chat with a guardian: pick a student, then the thread of that student (table messages, thread = the student; same contract as the guardian's chat and the old app).
// Ready sentences fill the box but are never sent until "পাঠান". With no net the message waits on the phone (outbox) and is shown as such.
import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { toast } from '../../ui/toast.js';
import { stateCard, emptyState } from '../../ui/states.js';
import { dataPage } from '../../ui/datapage.js';
import { sel, rows, insert } from '../../core/api.js';
import { filter as nameFilter, normalize } from '../../core/name-search.js';
import { outbox } from '../../core/outbox-app.js';
import { session } from '../../core/session.js';
import { cache } from '../../core/cache.js';
import { bn, clockText, shortDate, dhakaDay, uuid } from '../../core/bn.js';
import { MAX_LEN, validateMessage, addPhrase, messageRow } from '../contact/rules.js';
import { loadStudents } from './data.js';
import { openCallSheet } from './call.js';
import { avatar } from './ui.js';

export const TEACHER_PHRASES = ['আপনার সন্তান আজ ক্লাসে আসেনি, সব ঠিক আছে তো?', 'আজ আপনার সন্তান খুব ভালো করেছে।', 'পরীক্ষার পড়াটা একটু দেখে দেবেন।', 'আপনার সাথে একটু কথা বলতে চাই, কখন ফোন করব?', 'ধন্যবাদ।'];

export function guardiansPage(ctx) {
  let q = '';
  const out = h('ul', { class: 'tc-list', 'aria-live': 'polite' });
  return dataPage({ key: 'students', load: loadStudents, isEmpty: d => !d.length, empty: () => stateCard({ kind: 'empty', title: 'কোনো শিক্ষার্থী নেই', text: 'অফিসে জানান।' }),
    draw: list => {
      const paint = () => {
        const shown = (normalize(q) ? nameFilter(list, q, s => ({ name: s.profile?.full_name, login: s.profile?.login_id, roll: s.roll })) : list).slice(0, 40);
        out.replaceChildren(...shown.map(s => h('li', null, h('button', { class: 'de-row more-row', type: 'button', onclick: () => ctx.go('/contact/guardians/' + s.id) }, avatar(s.profile?.full_name),
          h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: s.profile?.full_name || '—' }), h('span', { class: 'de-row__sub', text: `ক্লাস ${bn(s.class_level)} · রোল ${bn(s.roll ?? '')}` })), icon('chev')))),
        ...(!shown.length ? [h('li', null, h('p', { class: 'tc-sub', text: 'কাউকে পাওয়া যায়নি। নামের অংশ বা রোল লিখুন।' }))] : []));
      };
      paint();
      return [h('input', { class: 'de-field__input tc-input', type: 'search', 'aria-label': 'শিক্ষার্থীর নাম বা রোল', placeholder: 'শিক্ষার্থীর নাম বা রোল', autocomplete: 'off', oninput: e => { q = e.target.value; paint(); } }), h('div', { class: 'de-card' }, out)];
    } });
}

async function loadThread(sid) {
  const r = await sel('messages', `select=id,body,created_at,sender_id&thread_student_id=eq.${sid}&order=created_at`);
  if (r.kind !== 'ok') return { kind: r.kind };
  const list = rows(r), ids = [...new Set(list.map(m => m.sender_id))];
  const names = ids.length ? Object.fromEntries(rows(await sel('staff_public', `select=id,full_name,role&id=in.(${ids.join(',')})`)).map(p => [p.id, p.full_name])) : {};
  return { kind: 'ok', data: list.map(m => ({ ...m, who: names[m.sender_id] || 'অভিভাবক' })) };
}
// -> { result: 'sent' | 'kept' | 'failed', row }
export async function sendToGuardian(me, studentId, text) {
  const row = messageRow({ id: uuid(), coaching_id: me.coaching_id, student_id: studentId, sender_id: session.uid(), body: text });
  const r = await insert('messages', row);
  if (r.kind === 'ok' || r.kind === 'conflict') return { result: 'sent', row };
  if (r.kind === 'offline' || r.kind === 'server' || r.kind === 'rate') { const kept = await outbox.add({ uid: session.uid(), method: 'POST', path: '/rest/v1/messages', body: row, prefer: 'return=minimal', label: 'অভিভাবককে বার্তা' }); if (kept) return { result: 'kept', row }; }
  return { result: 'failed', row };
}

export function threadPage(ctx, sid) {
  const me = ctx.me;
  const known = (cache.get(session.uid(), 'students')?.v || []).find(s => s.id === sid);
  const name = known?.profile?.full_name || 'শিক্ষার্থী';
  const page = dataPage({
    key: 'thread.' + sid, load: () => loadThread(sid),
    draw: (list, reload) => {
      const waiting = [];
      const log = h('div', { class: 'chat-log', role: 'log', 'aria-label': 'বার্তা', tabindex: '0' });
      const paintLog = () => {
        const all = [...list.map(m => ({ ...m, mine: m.sender_id === session.uid() })), ...waiting.map(m => ({ ...m, mine: true, kept: true }))];
        log.replaceChildren(...(all.length ? all.map(m => h('div', { class: 'de-msg ' + (m.mine ? 'de-msg--me' : 'de-msg--bot') },
          h('span', { class: 'chat-who', text: `${m.mine ? 'আপনি' : m.who} · ${dhakaDay(m.created_at) === dhakaDay() ? clockText(m.created_at) : shortDate(m.created_at)}` }), h('span', { text: m.body }), m.kept ? h('span', { class: 'de-msg__sub', text: 'ফোনে রাখা আছে, নেট এলে যাবে' }) : null))
          : [emptyState('এখনো কোনো বার্তা নেই', `${name}-এর অভিভাবকের জন্য প্রথম বার্তা লিখুন।`)]));
        log.scrollTop = log.scrollHeight;
      };
      const box = h('textarea', { class: 'de-field__input chat-box', rows: '2', maxlength: String(MAX_LEN), 'aria-label': 'আপনার বার্তা', placeholder: 'এখানে বার্তা লিখুন' });
      const send = h('button', { class: 'de-btn de-btn--primary chat-send', type: 'button', text: 'পাঠান' });
      const chips = h('div', { class: 'chips chat-phrases', role: 'group', 'aria-label': 'তৈরি বাক্য' }, ...TEACHER_PHRASES.map(p => h('button', { class: 'de-chip', type: 'button', onclick: () => { box.value = addPhrase(box.value, p); box.focus(); }, text: p })));
      send.addEventListener('click', async () => {
        const v = validateMessage(box.value);
        if (!v.ok) return toast(v.why === 'long' ? 'বার্তা একটু ছোট করুন।' : 'আগে কিছু লিখুন।');
        send.disabled = true; const r = await sendToGuardian(me, sid, v.text); send.disabled = false;
        if (r.result === 'sent') { box.value = ''; return reload(); }
        if (r.result === 'kept') { waiting.push({ id: r.row.id, body: r.row.body, created_at: new Date().toISOString() }); box.value = ''; paintLog(); return toast('নেট নেই। বার্তা ফোনে রাখা হলো, নেট এলে যাবে।'); }
        toast('বার্তা যায়নি, আবার চেষ্টা করুন।');
      });
      paintLog();
      const timer = setInterval(() => { if (!log.isConnected) clearInterval(timer); else if (document.activeElement !== box && !document.hidden) reload(); }, 20000);
      return h('div', { class: 'chat' }, h('div', { class: 'tc-wrap' }, h('button', { class: 'de-btn de-btn--secondary', type: 'button', text: 'অভিভাবককে ফোন করুন', onclick: () => openCallSheet({ id: sid, name }) })), log, h('div', { class: 'chat-form' }, box, send), chips);
    },
  });
  return page;
}

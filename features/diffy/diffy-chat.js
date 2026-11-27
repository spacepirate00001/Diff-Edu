// "ডিফিকে জিজ্ঞেস করো": the chat sheet (port of the approved design-system/ask-diffy.js as an ES module).
//
// TWO MODES, decided by core/flags.js:
//   * fake mode (?fake=, localhost only): canned answers, no network. The owner can see the whole sheet.
//   * real mode: only when the flag `diffy_chat` is ON (default OFF: the owner has not chosen a child-safe AI plan yet). The question goes to the
//     edge function `ai` with { mode: "tutor", class_level, history:[{ from_student:true, text }] } and the answer is { reply } (429 daily_limit when
//     the 20 questions of the day are used). NOTE: that function currently answers 403 "students only" to a guardian, so on a real server
//     this works from the student's own app (step 3); a guardian sees a kind "not here" line. The sheet is offered only when the mode is on.
// Always: 20 questions a day counted on the phone (the server is the real limit), only study questions (off-topic gets a kind redirect and
// is NOT counted), phone numbers and long digit runs are removed before anything leaves the phone, and the privacy line is shown.
import { h } from '../../ui/dom.js';
import { openSheet } from '../../ui/sheet.js';
import { fn } from '../../core/api.js';
import { flags } from '../../core/flags.js';
import { net } from '../../core/net.js';
import { session } from '../../core/session.js';
import { bn } from '../../core/bn.js';
import { sendMessage } from '../contact/chat.js';
import { outbox } from '../../core/outbox-app.js';
import { uuid } from '../../core/bn.js';
import { DAILY, isOffTopic, cleanQuestion, OFF_REPLY, PRIVACY_LINE, counter, cannedFor } from './rules.js';

export const diffyAvailable = () => !!globalThis.DeFake || flags.on('diffy_chat');
const HELLO = 'আমি ডিফি! পড়ার যেকোনো প্রশ্ন জিজ্ঞেস করো, আমি ধাপে ধাপে বুঝিয়ে দেব।';
const CHIPS = ['ভগ্নাংশ বুঝিয়ে দাও', 'ইংরেজি Tense', 'বিশেষ্য কাকে বলে?'];
const NOT_HERE = 'ডিফি এখন সন্তানের নিজের অ্যাপে প্রশ্নের উত্তর দেয়। এখানে শিক্ষককে প্রশ্ন পাঠাতে পারেন।';

// -> { kind: 'ok', text } | { kind: 'limit' | 'offline' | 'notHere' | 'error' }
export async function askDiffy(text, { kid, history }) {
  if (net.isOffline()) return { kind: 'offline' };
  if (globalThis.DeFake) {                                   // fake mode: canned answers
    await new Promise(r => setTimeout(r, 900));
    if (globalThis.DeFake.mem.state === 'error') return { kind: 'error' };
    return { kind: 'ok', text: cannedFor(text) };
  }
  const r = await fn('ai', { mode: 'tutor', class_level: kid?.class_level || 5, history: [...history, { from_student: true, text }] }, true);
  if (r.kind === 'ok' && r.data?.reply) return { kind: 'ok', text: String(r.data.reply) };
  if (r.status === 429) return { kind: 'limit' };
  if (r.kind === 'forbidden') return { kind: 'notHere' };
  return { kind: r.kind === 'offline' ? 'offline' : 'error' };
}

// The student's hand-off: a doubt row for the teacher (table doubts; the student policy lets a student add one). Ask-box rules: the class sees the
// question, never who asked. With no net it waits in the outbox like every other write.
async function sendDoubt(me, kid, q) {
  const { diffyDoubtRow } = await import('../student/logic.js');
  const row = { id: uuid(), ...diffyDoubtRow({ coachingId: me.coaching_id, studentId: kid.id, classLevel: kid.class_level, question: q }) };
  const r = await outbox.submit({ uid: session.uid(), method: 'POST', path: '/rest/v1/doubts', body: row, prefer: 'return=minimal', label: 'শিক্ষককে প্রশ্ন' });
  return { result: r.state === 'saved' ? 'sent' : r.state === 'queued' ? 'kept' : 'failed' };
}
export function openDiffy({ ctx, kid, student = false }) {
  const uid = session.uid();
  const history = [];
  let busy = false, sheet;
  const log = h('div', { class: 'de-ask__log', role: 'log', 'aria-label': 'কথোপকথন', tabindex: '0' });
  const count = h('p', { class: 'de-ask__count', 'aria-live': 'polite' });
  const banner = h('div');
  const input = h('input', { class: 'de-field__input', type: 'text', 'aria-label': 'তোমার প্রশ্ন', autocomplete: 'off', maxlength: '300' });
  const send = h('button', { class: 'de-ask__send', type: 'submit', text: 'পাঠাও' });
  const chips = h('div', { class: 'de-ask__chips' }, ...CHIPS.map(c => h('button', { class: 'de-chip de-chip--plain', type: 'button', onclick: () => ask(c), text: c })));
  const add = n => { log.append(n); log.scrollTop = log.scrollHeight; return n; };
  const bot = (text, extra) => add(h('div', { class: 'de-msg de-msg--bot' }, h('span', { text }), extra));

  function status(kind) {
    const left = counter.left(uid), limit = left <= 0, off = kind === 'offline' || net.isOffline();
    banner.replaceChildren(...(off || limit ? [h('div', { class: 'de-banner de-banner--warn', role: 'status' }, h('span', { class: 'de-banner__title', text: off ? 'নেট নেই' : 'আজকের প্রশ্ন শেষ' }),
      h('span', { class: 'de-banner__text', text: off ? 'প্রশ্ন পাঠাতে নেট লাগবে। নেট এলে আবার চেষ্টা করো।' : `আজ ${bn(DAILY)}টা প্রশ্ন করে ফেলেছ, দারুণ! কাল আবার জিজ্ঞেস করো। এখনই দরকার হলে শিক্ষককে পাঠাও।` }))] : []));
    input.disabled = send.disabled = off || limit;
    input.placeholder = limit ? 'কাল আবার জিজ্ঞেস করো' : 'এখানে প্রশ্ন লেখো';
    count.textContent = bn(`আজ আর ${left}টা প্রশ্ন বাকি (${DAILY}-এর মধ্যে)`);
  }
  const toTeacher = (q, a, btn) => async () => {
    btn.disabled = true;
    const r = student ? await sendDoubt(ctx.me, kid, q) : await sendMessage(ctx.me, kid, `ডিফির উত্তরটা বুঝিনি। প্রশ্ন: ${q}`);
    btn.replaceWith(h('span', { class: 'de-chip ' + (r.result === 'failed' ? 'de-chip--warn' : 'de-chip--good'), text: r.result === 'failed' ? 'পাঠানো যায়নি' : r.result === 'kept' ? 'নেট এলে যাবে' : 'শিক্ষককে পাঠানো হয়েছে' }));
  };
  async function ask(raw) {
    const q = cleanQuestion(raw);
    if (!q || input.disabled || busy) return;
    busy = true; chips.hidden = true; input.value = '';
    add(h('div', { class: 'de-msg de-msg--me', text: q }));
    if (isOffTopic(q)) { bot(OFF_REPLY); busy = false; return; }          // off-topic: kind redirect, nothing sent, nothing counted
    const dots = add(h('div', { class: 'de-msg de-msg--bot', role: 'status', 'aria-label': 'ডিফি লিখছে' }, h('span', { class: 'de-dots' }, h('i'), h('i'), h('i'))));
    const r = await askDiffy(q, { kid, history });
    dots.remove(); busy = false;
    if (r.kind === 'ok') {
      history.push({ from_student: true, text: q }, { from_student: false, text: r.text }); counter.add(uid);
      const b = h('button', { class: 'de-msg__t', type: 'button', text: student ? 'শিক্ষককে পাঠাও (নাম ছাড়া)' : 'শিক্ষককে পাঠাও' }); b.addEventListener('click', toTeacher(q, r.text, b));
      bot(r.text, b); status('ok');
    } else if (r.kind === 'limit') { counter.setUsed(uid, DAILY); bot('আজকের প্রশ্ন শেষ। কাল আবার জিজ্ঞেস করো।'); status('ok'); }
    else if (r.kind === 'offline') { bot('নেট নেই, তাই উত্তর আনা গেল না। তোমার প্রশ্ন ঠিকই আছে।', h('button', { class: 'de-msg__t', type: 'button', text: 'আবার চেষ্টা করো', onclick: e => { e.currentTarget.parentNode.remove(); ask(q); } })); status('offline'); }
    else if (r.kind === 'notHere') bot(NOT_HERE);
    else bot('ইশ, উত্তর আনা যায়নি। তোমার প্রশ্ন ঠিকই আছে, আবার চেষ্টা করো।', h('button', { class: 'de-msg__t', type: 'button', text: 'আবার চেষ্টা করো', onclick: e => { e.currentTarget.parentNode.remove(); ask(q); } }));
  }
  const form = h('form', { class: 'de-ask__form', onsubmit: e => { e.preventDefault(); ask(input.value); } }, input, send);
  const head = h('div', { class: 'de-ask__head' }, window.Diffy ? window.Diffy.make('happy', 'de-mascot--sm') : null, h('h2', { class: 'de-ask__title', tabindex: '-1', text: 'ডিফিকে জিজ্ঞেস করো' }),
    h('button', { class: 'de-ask__x', type: 'button', 'aria-label': 'বন্ধ করো', text: 'বন্ধ', onclick: () => sheet.close() }));
  bot(HELLO);
  sheet = openSheet({ label: 'ডিফিকে জিজ্ঞেস করো', content: h('div', { class: 'de-ask__body' }, head, count, banner, log, chips, h('p', { class: 'de-ask__priv', text: PRIVACY_LINE }), form) });
  sheet.el.classList.add('de-ask');
  status('ok');
  return sheet;
}

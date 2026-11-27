// "মতামত দিন": anyone signed in can tell the office anything about the app (a problem, an idea, thanks). The note is kept in the outbox first,
// so it is not lost when the net is off. The screen the person came from and the app version go along so the office can find the place.
import { h } from '../../ui/dom.js';
import { chip, chipRow } from '../../ui/chip.js';
import { field } from '../../ui/field.js';
import { openSheet } from '../../ui/sheet.js';
import { saveBar } from '../../ui/savebar.js';
import { toast } from '../../ui/toast.js';
import { outbox } from '../../core/outbox-app.js';
import { session } from '../../core/session.js';
import { VERSION } from '../../core/config.js';
import { KINDS, MAX_LEN, validateFeedback, feedbackCall } from './logic.js';

export function openFeedback(screen = '') {
  let kind = 'idea';
  const msg = field({ label: 'আপনার কথা', multiline: true, rows: 5, maxlength: MAX_LEN, help: 'যা মনে আসে লিখুন: কোনটা ভালো লাগছে না, কী থাকলে ভালো হয়, কিছু আটকে গেলে। অফিস পড়বে।' });
  const kBox = h('div'), go = h('button', { class: 'de-btn de-btn--primary', type: 'button', text: 'পাঠিয়ে দিন' });
  const draw = () => kBox.replaceChildren(chipRow('কী ধরনের কথা', KINDS.map(([k, l]) => chip(l, kind === k, () => { kind = k; draw(); }))));
  draw();
  const sheet = openSheet({ title: 'মতামত দিন', content: h('div', { class: 'sheet-col' }, kBox, msg.el, go) });
  go.addEventListener('click', async () => {
    const v = validateFeedback({ kind, message: msg.input.value });
    msg.error(v.error || ''); if (!v.ok) return;
    go.disabled = true; go.textContent = 'একটু অপেক্ষা…';
    const c = feedbackCall(v.value, screen, VERSION);
    const r = await outbox.submit({ uid: session.uid(), method: 'POST', path: `/rest/v1/rpc/${c.name}`, body: c.args, label: 'মতামত' });
    go.disabled = false; go.textContent = 'পাঠিয়ে দিন';
    if (r.state === 'failed' || r.state === 'rejected') return saveBar.show(r.state, { onRetry: () => go.click() });
    sheet.close(); toast(r.state === 'saved' ? 'ধন্যবাদ! আপনার কথা অফিসে পৌঁছে গেছে।' : 'নেট নেই। নেট এলেই আপনার কথা চলে যাবে।');
  });
}

// Confirm box (centred). Resolves true / false. Used for logout with waiting work, discarding a queued write, deletion requests.
import { h } from './dom.js';

export function confirmBox({ title, text, ok = 'ঠিক আছে', cancel = 'না, থাক', danger = false }) {
  return new Promise(resolve => {
    const opener = document.activeElement;
    const scrim = h('div', { class: 'de-sheet-scrim is-open' });
    const done = v => { document.removeEventListener('keydown', onKey, true); scrim.remove(); box.remove(); opener?.focus?.(); resolve(v); };
    const yes = h('button', { class: 'de-btn ' + (danger ? 'de-btn--danger' : 'de-btn--primary'), type: 'button', onclick: () => done(true), text: ok });
    const no = h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: () => done(false), text: cancel });
    const heading = h('h2', { class: 'de-dialog__title', id: 'dlg-title', tabindex: '-1', text: title });
    const box = h('div', { class: 'de-dialog is-open', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-title' },
      heading, h('p', { class: 'de-dialog__text', text }), h('div', { class: 'de-dialog__actions' }, yes, no));
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } else if (e.key === 'Tab') { const items = [yes, no]; const i = items.indexOf(document.activeElement); e.preventDefault(); items[(i + (e.shiftKey ? -1 : 1) + 2) % 2].focus(); } };
    document.addEventListener('keydown', onKey, true);
    scrim.addEventListener('click', () => done(false));
    document.body.append(scrim, box);
    heading.focus();
  });
}

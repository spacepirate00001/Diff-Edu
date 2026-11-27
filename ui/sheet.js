// Bottom sheet over a scrim (role=dialog). Focus goes in, Tab stays inside, Escape or the scrim closes, focus goes back to the opener.
import { h, add } from './dom.js';

const FOCUSABLE = 'button:not([disabled]),a[href],input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
let openCount = 0;
export function openSheet({ title, content, label, onClose, dismissible = true }) {
  const opener = document.activeElement;
  const scrim = h('div', { class: 'de-sheet-scrim' });
  const heading = title ? h('h2', { class: 'de-sheet__title', id: 'sheet-title-' + (++openCount), tabindex: '-1', text: title }) : null;
  const sheet = h('div', { class: 'de-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': heading ? heading.id : null, 'aria-label': heading ? null : label }, h('span', { class: 'de-sheet__handle', 'aria-hidden': 'true' }), heading);
  add(sheet, [content]);
  document.body.append(scrim, sheet);
  void sheet.offsetWidth;
  scrim.classList.add('is-open'); sheet.classList.add('is-open');
  let closed = false;
  const close = (silent) => {
    if (closed) return; closed = true;
    document.removeEventListener('keydown', onKey, true);
    scrim.remove(); sheet.remove();
    if (opener && opener.isConnected) opener.focus?.();
    if (!silent) onClose?.();
  };
  const onKey = e => {
    if (e.key === 'Escape' && dismissible) { e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    const items = [...sheet.querySelectorAll(FOCUSABLE)].filter(x => x.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', onKey, true);
  if (dismissible) scrim.addEventListener('click', () => close());
  (heading || sheet.querySelector(FOCUSABLE) || sheet).focus?.();
  return { el: sheet, close };
}

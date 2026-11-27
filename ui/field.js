// Labelled text field with help / error line. The label is always visible (never only a placeholder).
import { h } from './dom.js';

let n = 0;
export function field({ label, value = '', type = 'text', inputmode, autocomplete, onBrand = false, maxlength, name, help, required, placeholder, multiline = false, rows = 3, oninput }) {
  const id = 'f' + (++n);
  const input = h(multiline ? 'textarea' : 'input', {
    class: 'de-field__input', id, name, type: multiline ? null : type, inputmode, autocomplete, maxlength, placeholder, value, rows: multiline ? String(rows) : null,
    required: required ? true : null, 'aria-describedby': id + '-h', oninput,
  });
  const note = h('span', { class: 'de-field__help', id: id + '-h', 'aria-live': 'polite', text: help || '' });
  const el = h('div', { class: 'de-field' + (onBrand ? ' de-field--on-brand' : '') }, h('label', { class: 'de-field__label', for: id, text: label }), input, note);
  return {
    el, input,
    error(text) { el.classList.toggle('is-error', !!text); input.setAttribute('aria-invalid', text ? 'true' : 'false'); note.textContent = text || help || ''; },
  };
}

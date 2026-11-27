// PIN pad (spec P5): 4-6 dots, 3x4 keys, show/hide, physical keyboard, Bangla digits typed on a phone keyboard become English.
import { h } from './dom.js';
import { icon } from './icons.js';
import { bn, ascii } from '../core/bn.js';

export function createPinPad({ label = 'পিন', min = 4, max = 6, autocomplete = 'current-password', name = 'pin', onChange, onSubmit } = {}) {
  let pin = '', shown = false, busy = false, keyboard = true;
  const dots = h('div', { class: 'de-pindots', 'aria-hidden': 'true' });
  const peek = h('span', { class: 'pin-peek', 'aria-hidden': 'true' });
  const say = h('span', { class: 'sr-only', 'aria-live': 'polite' });
  const err = h('p', { class: 'pin-error', role: 'alert', hidden: true });
  // The real (hidden) password input lets the phone's password saver and autofill work; it mirrors the pad.
  const real = h('input', { class: 'pin-real', type: 'password', name, autocomplete, inputmode: 'numeric', maxlength: String(max), tabindex: '-1', 'aria-label': label });
  const eye = h('button', { class: 'de-btn de-btn--text pin-eye', type: 'button', 'aria-pressed': 'false', onclick: () => { shown = !shown; paint(); } });
  const keyBtn = (text, aria, cls, on) => h('button', { class: 'de-pinpad__key' + (cls ? ' ' + cls : ''), type: 'button', 'aria-label': aria, onclick: on, text });
  const go = keyBtn('ঠিক আছে', 'ঠিক আছে', 'de-pinpad__key--go', () => submit());
  const del = keyBtn('মুছুন', 'শেষ সংখ্যা মুছুন', '', () => set(pin.slice(0, -1)));
  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => keyBtn(bn(n), `সংখ্যা ${bn(n)}`, '', () => push(String(n))));
  const pad = h('div', { class: 'de-pinpad' }, ...keys, del, keyBtn(bn(0), `সংখ্যা ${bn(0)}`, '', () => push('0')), go);

  function paint() {
    dots.replaceChildren(...Array.from({ length: Math.max(min, pin.length) }, (_, i) => h('i', { class: 'de-pindots__dot' + (i < pin.length ? ' is-on' : '') })));
    peek.textContent = shown ? bn(pin) : '';
    peek.hidden = !shown;
    eye.replaceChildren(icon(shown ? 'eyeoff' : 'eye'), shown ? 'লুকান' : 'দেখুন');
    eye.setAttribute('aria-pressed', String(shown));
    go.disabled = pin.length < min || busy; go.setAttribute('aria-disabled', String(go.disabled));
    [...keys, del].forEach(k => { k.disabled = busy; });
    real.value = pin;
    say.textContent = pin.length ? `${bn(pin.length)}টা সংখ্যা দেওয়া হয়েছে` : 'কোনো সংখ্যা দেওয়া হয়নি';   // never the digits themselves
  }
  function set(v) { pin = v; paint(); onChange?.(pin); }
  function push(d) { if (busy || pin.length >= max) return; set(pin + d); }
  function submit() { if (busy || pin.length < min) return; onSubmit?.(pin); }
  real.addEventListener('input', () => { const v = ascii(real.value).replace(/\D/g, '').slice(0, max); set(v); });
  const onKey = e => {
    if (!keyboard) return;
    const t = document.activeElement;
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && t !== real) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const d = ascii(e.key);
    if (/^\d$/.test(d)) { e.preventDefault(); push(d); }
    else if (e.key === 'Backspace') { e.preventDefault(); set(pin.slice(0, -1)); }
    else if (e.key === 'Enter' && t?.tagName !== 'BUTTON') { e.preventDefault(); submit(); }
  };
  document.addEventListener('keydown', onKey);
  const el = h('div', { class: 'pin-wrap' }, real, dots, peek, say, err, h('div', { class: 'pin-tools' }, eye), pad);
  paint();
  return {
    el, value: () => pin,
    clear() { set(''); },
    error(text) { err.textContent = text || ''; err.hidden = !text; if (text && !matchMedia('(prefers-reduced-motion: reduce)').matches) { dots.classList.remove('is-shake'); void dots.offsetWidth; dots.classList.add('is-shake'); } },
    busy(b) { busy = !!b; paint(); },
    enableKeyboard(on) { keyboard = on; },
    destroy() { document.removeEventListener('keydown', onKey); },
  };
}

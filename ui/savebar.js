// Every write ends in one of three states (spec 2.1): saved / kept on the phone / not sent. One strip above the tab bar.
import { h } from './dom.js';
import { icon } from './icons.js';
import { aicon } from './aicons.js';

const TEXT = { saved: 'জমা হয়েছে', queued: 'ফোনে রাখা আছে, নেট এলে যাবে', failed: 'যায়নি, আবার চেষ্টা করুন', rejected: 'সার্ভার নেয়নি' };
let hideTimer = null;
export const saveBar = {
  // state: saved | queued | failed | rejected;  onRetry shows the retry button (failed only)
  show(state, { text, onRetry, onOpen } = {}) {
    const root = document.getElementById('savebar'); if (!root) return;
    clearTimeout(hideTimer);
    const kind = state === 'rejected' ? 'failed' : state;
    root.replaceChildren(h('div', { class: 'de-savebar de-savebar--' + kind, role: 'status' }, (kind === 'saved' ? aicon('check') : icon(kind === 'queued' ? 'clock' : 'alert')),
      h('span', { text: text || TEXT[state] }),
      state === 'failed' && onRetry ? h('button', { class: 'de-savebar__action', type: 'button', onclick: onRetry, text: 'আবার চেষ্টা' }) : null,
      (state === 'queued' || state === 'rejected') && onOpen ? h('button', { class: 'de-savebar__action', type: 'button', onclick: onOpen, text: 'দেখুন' }) : null));
    if (state === 'saved') hideTimer = setTimeout(() => root.replaceChildren(), 3000);
  },
  hide() { document.getElementById('savebar')?.replaceChildren(); },
};

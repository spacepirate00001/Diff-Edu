// The five screen states, always the same look and words (spec 2.1): loading, empty, offline, error, no permission.
import { h } from './dom.js';
import { icon } from './icons.js';
import { bn, agoText } from '../core/bn.js';

export function loading(n = 3) {
  const box = h('div', { class: 'de-states', role: 'status', 'aria-live': 'polite' }, h('span', { class: 'sr-only', text: 'লোড হচ্ছে' }));
  for (let i = 0; i < n; i++) box.append(h('span', { class: 'de-skeleton de-skeleton--card', 'aria-hidden': 'true' }));
  // after 10 seconds one more line, then the caller shows the error state
  const slow = h('p', { class: 'de-row__sub', hidden: true, text: 'নেট ধীর, একটু অপেক্ষা করুন' });
  box.append(slow);
  const t = setTimeout(() => { slow.hidden = false; }, 10000);
  box.addEventListener('de-gone', () => clearTimeout(t));
  return box;
}
// kind: 'empty' | 'offline' | 'error' | 'forbidden' | 'unavailable'
export function stateCard({ kind = 'empty', title, text, action, onAction, mascot = true, extra }) {
  const mood = kind === 'empty' ? 'happy' : 'oops';
  const face = mascot && window.Diffy ? window.Diffy.make(mood, 'de-mascot--lg') : h('span', { class: 'de-empty__icon' }, icon(kind === 'offline' ? 'wifioff' : kind === 'forbidden' ? 'lock' : 'info'));
  return h('div', { class: 'de-empty de-empty--' + (kind === 'offline' ? 'offline' : kind === 'error' ? 'error' : 'plain'), role: kind === 'error' || kind === 'offline' ? 'status' : null },
    face, h('span', { class: 'de-empty__title', text: title }), text ? h('span', { class: 'de-empty__text', text }) : null,
    action ? h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: onAction, text: action }) : null, extra);
}
export const emptyState = (title, text, extra) => stateCard({ kind: 'empty', title, text, extra });
export const errorState = (onRetry, text = 'এখন আনা যাচ্ছে না। একটু পরে আবার চেষ্টা করুন।') => stateCard({ kind: 'error', title: 'ইশ, তথ্য আনা যায়নি', text, action: 'আবার চেষ্টা করুন', onAction: onRetry });
export const offlineState = (onRetry) => stateCard({ kind: 'offline', title: 'ইশ, নেট হারিয়ে গেছে', text: 'নেট চালু করে আবার চেষ্টা করুন।', action: 'আবার চেষ্টা করুন', onAction: onRetry });
export const forbiddenState = (onHome) => stateCard({ kind: 'forbidden', title: 'এই পাতা আপনার জন্য নয়', text: 'দরকার হলে অফিসে জানান।', action: 'আজ-এ ফিরুন', onAction: onHome, mascot: false });
export const unavailableState = (title = 'এই সুবিধা এখনো চালু হয়নি', onHome) => stateCard({ kind: 'unavailable', title, text: 'কিছুদিন পরে আবার দেখুন।', action: onHome ? 'আজ-এ ফিরুন' : null, onAction: onHome, mascot: false });
// Yellow strip on top of last-seen data.
export function staleBanner(kind, at) {
  const text = kind === 'offline' ? `নেট নেই। শেষ দেখা তথ্য, ${at ? agoText(at) : 'আগের'}।` : 'নতুন তথ্য আনা যায়নি। আগের তথ্য দেখানো হচ্ছে।';
  return h('div', { class: 'de-banner de-banner--warn', role: 'status' }, h('span', { class: 'de-banner__text', text }));
}
export { bn };

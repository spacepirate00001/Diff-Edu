// Short message at the bottom. Also read aloud politely (role=status).
import { h } from './dom.js';

let timer = null;
export function toast(text, { ms = 3500, action, onAction } = {}) {
  let root = document.getElementById('toast');
  if (!root) { root = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.append(root); }
  root.replaceChildren(h('div', { class: 'de-toast de-toast--fixed' }, h('span', { text }),
    action ? h('button', { class: 'de-toast__action', type: 'button', text: action, onclick: () => { root.replaceChildren(); onAction?.(); } }) : null));
  clearTimeout(timer);
  timer = setTimeout(() => root.replaceChildren(), ms);
}

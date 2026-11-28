// Open-source licences: the full text, offline (licenses.txt is in the service-worker cache).
import { h } from '../../ui/dom.js';
import { loading } from '../../ui/states.js';

export function licensesPage() {
  const body = h('div', { class: 'help' }, loading(1));
  fetch('licenses.txt').then(r => r.text()).then(t => body.replaceChildren(h('pre', { class: 'de-row__sub licenses-pre', text: t }))).catch(() => body.replaceChildren(h('p', { class: 'de-row__sub', text: 'লাইসেন্সের লেখা খোলা গেল না। নেট চালু করে আবার চেষ্টা করুন।' })));
  return { node: body };
}

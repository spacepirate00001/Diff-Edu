// "ভর্তির খোঁজ" (admin): the inquiries families sent from the public form. Call or WhatsApp from here, mark what happened, keep a short note.
import { h } from '../../ui/dom.js';
import { chip, chipRow } from '../../ui/chip.js';
import { field } from '../../ui/field.js';
import { openSheet } from '../../ui/sheet.js';
import { saveBar } from '../../ui/savebar.js';
import { dataPage } from '../../ui/datapage.js';
import { stateCard } from '../../ui/states.js';
import { icon } from '../../ui/icons.js';
import { bn, agoText } from '../../core/bn.js';
import { ADMIT_STATUS, ADMIT_FILTERS, SHIFT_BN, admitMatches, admitCounts, sortAdmit, phoneLinks, admitWhatsApp } from './logic.js';
import { loadAdmissions, updateAdmission } from './data.js';
import { row } from './ui.js';

const TONE = { new: 'warn', called: 'info', admitted: 'good', dropped: '' };
export function admissionsPage() {
  let filter = 'open';
  return dataPage({
    key: 'office.admissions',
    load: loadAdmissions,
    isEmpty: d => !d.length,
    empty: () => stateCard({ kind: 'empty', title: 'এখনো কোনো ভর্তির খোঁজ আসেনি', text: 'ওয়েবসাইট বা অ্যাপের ভর্তি ফর্ম থেকে কেউ লিখলে এখানে আসবে।' }),
    draw: (d, reload) => {
      const c = admitCounts(d), list = sortAdmit(d.filter(x => admitMatches(x, filter)));
      const item = x => row({ title: x.child_name, sub: `${x.class_level ? 'ক্লাস ' + bn(x.class_level) + ' · ' : ''}${x.guardian_name ? x.guardian_name + ' · ' : ''}${agoText(Date.parse(x.created_at))}`, chip: ADMIT_STATUS[x.status] || x.status, tone: TONE[x.status], onclick: () => openOne(x, reload) });
      return h('div', { class: 'tc-page' },
        h('section', { class: 'de-card tc-card' }, h('p', { class: 'tc-big tc-big--' + (c.new ? 'warn' : 'good'), text: c.new ? `${bn(c.new)}টা নতুন খোঁজ, ফোন করা বাকি` : 'ফোন করার মতো নতুন খোঁজ নেই' }), h('p', { class: 'tc-cap', text: `মোট ${bn(d.length)} · ভর্তি হয়েছে ${bn(c.admitted)}` })),
        chipRow('কোন খোঁজ', ADMIT_FILTERS.map(([k, l]) => chip(`${l} ${bn(k === 'open' ? c.open : c[k])}`, filter === k, () => { filter = k; reload(); }))),
        list.length ? h('div', { class: 'de-card' }, h('ul', { class: 'tc-list' }, ...list.map(item))) : stateCard({ kind: 'empty', title: 'এই ধরনের কোনো খোঁজ নেই', text: 'অন্য ফিল্টার বেছে দেখুন।', mascot: false }));
    },
  });
}
function openOne(x, reload) {
  const links = phoneLinks(x.phone);
  const note = field({ label: 'অফিসের নোট', multiline: true, rows: 3, maxlength: 300, value: x.staff_note || '', help: 'কী কথা হলো, কখন আবার ফোন করবেন' });
  const set = async (status) => {
    const st = await updateAdmission(x.id, { status, note: note.input.value });
    if (st === 'failed' || st === 'rejected') return saveBar.show(st, { onRetry: () => set(status) });
    sheet.close(); saveBar.show(st, { text: st === 'saved' ? 'রাখা হয়েছে' : undefined }); reload();
  };
  const call = h('div', { class: 'tc-actions' },
    links ? h('a', { class: 'de-btn de-btn--primary', href: links.tel }, icon('phone'), `ফোন করুন ${links.show}`) : h('p', { class: 'tc-cap', text: `নম্বর: ${bn(x.phone || '—')} (মোবাইল নম্বরের মতো নয়, তাই ফোনের বোতাম নেই)` }),
    links ? h('a', { class: 'de-btn de-btn--secondary', href: links.wa + '?text=' + encodeURIComponent(admitWhatsApp(x)), target: '_blank', rel: 'noopener' }, icon('chat'), 'WhatsApp') : null);
  const sheet = openSheet({ title: x.child_name, content: h('div', { class: 'sheet-col' },
    h('p', { class: 'tc-cap', text: [x.class_level ? 'ক্লাস ' + bn(x.class_level) : null, x.preferred_shift ? SHIFT_BN[x.preferred_shift] + ' ব্যাচ' : null, x.guardian_name].filter(Boolean).join(' · ') || 'অভিভাবকের নাম দেননি' }),
    x.note ? h('p', { class: 'tc-cap', text: 'তাদের লেখা: ' + x.note }) : null, call, note.el,
    chipRow('এখন কী অবস্থা', Object.entries(ADMIT_STATUS).map(([k, l]) => chip(l, x.status === k, () => set(k)))),
    h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: () => set(undefined) }, 'শুধু নোট রাখুন')) });
}

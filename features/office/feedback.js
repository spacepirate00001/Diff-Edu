// "মতামত" (admin): what people wrote through "মতামত দিন", newest first. Tap one to read it whole and mark it done.
import { h } from '../../ui/dom.js';
import { chip, chipRow } from '../../ui/chip.js';
import { openSheet } from '../../ui/sheet.js';
import { toast } from '../../ui/toast.js';
import { dataPage } from '../../ui/datapage.js';
import { stateCard } from '../../ui/states.js';
import { icon } from '../../ui/icons.js';
import { sel, request, rows } from '../../core/api.js';
import { bn, shortDate } from '../../core/bn.js';
import { KIND_BN, ROLE_NAME, splitFeedback } from '../feedback/logic.js';

const load = async () => {
  const r = await sel('app_feedback', 'select=id,kind,message,screen,app,role,status,created_at,who:profiles(full_name)&order=created_at.desc&limit=300');
  return r.kind === 'ok' ? { kind: 'ok', data: rows(r) } : { kind: r.kind === 'offline' ? 'offline' : 'error' };
};
export function feedbackPage() {
  let tab = 'fresh';
  return dataPage({
    key: 'office.feedback', load, isEmpty: () => false,
    draw: (d, reload) => {
      const { fresh, done } = splitFeedback(d), shown = tab === 'fresh' ? fresh : done;
      const item = f => h('li', {}, h('button', { class: 'de-row more-row', type: 'button', onclick: () => view(f, reload) },
        h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: f.message.length > 70 ? f.message.slice(0, 70) + '…' : f.message }),
          h('span', { class: 'de-row__sub', text: `${KIND_BN[f.kind] || ''} · ${ROLE_NAME[f.role] || f.role} · ${shortDate(f.created_at)}` })), icon('chev')));
      return h('div', { class: 'tc-page' },
        chipRow('কোনগুলো', [chip(`নতুন ${bn(fresh.length)}`, tab === 'fresh', () => { tab = 'fresh'; reload(); }), chip(`দেখা হয়েছে ${bn(done.length)}`, tab === 'done', () => { tab = 'done'; reload(); })]),
        shown.length ? h('div', { class: 'de-card' }, h('ul', { class: 'tc-list' }, ...shown.map(item)))
          : stateCard({ kind: 'empty', title: tab === 'fresh' ? 'নতুন কোনো মতামত নেই' : 'এখনো কিছু দেখা হয়নি', text: 'কেউ "মতামত দিন" থেকে কিছু লিখলে এখানে আসবে।' }));
    },
  });
}
function view(f, reload) {
  const done = f.status === 'done';
  const sheet = openSheet({ title: KIND_BN[f.kind] || 'মতামত', content: h('div', { class: 'sheet-col' },
    h('p', { class: 'tc-body', style: { 'white-space': 'pre-wrap', 'overflow-wrap': 'anywhere' }, text: f.message }),
    h('p', { class: 'de-row__sub', text: [f.who?.full_name, ROLE_NAME[f.role] || f.role, f.screen ? `পাতা: ${f.screen}` : null, shortDate(f.created_at)].filter(Boolean).join(' · ') }),
    h('button', { class: 'de-btn de-btn--primary', type: 'button', text: done ? 'আবার নতুন করে রাখুন' : 'দেখেছি, হয়ে গেছে', onclick: async () => {
      const r = await request('PATCH', `/rest/v1/app_feedback?id=eq.${f.id}`, { status: done ? 'new' : 'done' }, { prefer: 'return=minimal' });
      if (r.kind !== 'ok') return toast(r.kind === 'offline' ? 'নেট নেই। নেট এলে আবার চেষ্টা করুন।' : 'হয়নি, আবার চেষ্টা করুন।');
      sheet.close(); reload();
    } })) });
}

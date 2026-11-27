// "নোটিশ" (admin): write one (the same words and confirm as the teacher's), see the live ones, archive / restore, delete an archived one for good.
import { h } from '../../ui/dom.js';
import { chip, chipRow } from '../../ui/chip.js';
import { field } from '../../ui/field.js';
import { confirmBox } from '../../ui/dialog.js';
import { openSheet } from '../../ui/sheet.js';
import { saveBar } from '../../ui/savebar.js';
import { toast } from '../../ui/toast.js';
import { dataPage } from '../../ui/datapage.js';
import { stateCard } from '../../ui/states.js';
import { icon } from '../../ui/icons.js';
import { bn, shortDate } from '../../core/bn.js';
import { LEVELS, NOTICE_AUDIENCE, TITLE_MAX, BODY_MAX, validateNoticeForm, splitNotices, noticeWho, audienceName } from './logic.js';
import { loadNotices, sendNotice, setArchived, deleteNotice } from './data.js';

export function noticesPage() {
  let tab = 'live';
  return dataPage({
    key: 'office.notices',
    load: loadNotices,
    isEmpty: () => false,
    draw: (d, reload) => {
      const { live, archived } = splitNotices(d), shown = tab === 'live' ? live : archived;
      const item = n => h('li', { class: 'tc-notice' }, h('button', { class: 'de-row more-row', type: 'button', onclick: () => view(n, reload) },
        h('span', { class: 'de-row__main' }, h('span', { class: 'de-row__title', text: n.title }), h('span', { class: 'de-row__sub', text: `${noticeWho(n)} · ${shortDate(n.created_at)}` })), icon('chev')));
      return h('div', { class: 'tc-page' },
        h('button', { class: 'de-btn de-btn--primary', type: 'button', onclick: () => composeSheet(reload) }, icon('plus'), 'নতুন নোটিশ'),
        chipRow('কোন নোটিশ', [chip(`চলমান ${bn(live.length)}`, tab === 'live', () => { tab = 'live'; reload(); }), chip(`আর্কাইভ ${bn(archived.length)}`, tab === 'archived', () => { tab = 'archived'; reload(); })]),
        shown.length ? h('div', { class: 'de-card' }, h('ul', { class: 'tc-list' }, ...shown.map(item))) : stateCard({ kind: 'empty', title: tab === 'live' ? 'কোনো চলমান নোটিশ নেই' : 'আর্কাইভে কিছু নেই', text: tab === 'live' ? 'নতুন নোটিশ লিখলে ইনবক্সে সবার সামনে আসবে।' : 'পুরোনো নোটিশ আর্কাইভ করলে এখানে থাকে।', mascot: false }));
    },
  });
}
function composeSheet(reload) {
  let aud = 'all', level = null;
  const title = field({ label: 'শিরোনাম', maxlength: TITLE_MAX }), body = field({ label: 'বিস্তারিত', multiline: true, rows: 5, maxlength: BODY_MAX });
  const aBox = h('div'), lBox = h('div'), go = h('button', { class: 'de-btn de-btn--primary', type: 'button', text: 'নোটিশ পাঠান' });
  const draw = () => {
    aBox.replaceChildren(chipRow('কাদের জন্য', NOTICE_AUDIENCE.map(([k, l]) => chip(l, aud === k, () => { aud = k; draw(); }))));
    lBox.replaceChildren(chipRow('কোন ক্লাস', [chip('সব ক্লাস', level == null, () => { level = null; draw(); }), ...LEVELS.map(l => chip(bn(l), level === l, () => { level = l; draw(); }))]));
  };
  draw();
  const sheet = openSheet({ title: 'নতুন নোটিশ', content: h('div', { class: 'sheet-col' }, title.el, body.el, aBox, lBox, go) });
  go.addEventListener('click', async () => {
    const v = validateNoticeForm({ title: title.input.value, body: body.input.value, audience: aud, class_level: level });
    title.error(v.errors.title || ''); body.error(v.errors.body || ''); if (!v.ok) return;
    if (!await confirmBox({ title: 'নোটিশ পাঠাবেন?', text: `"${v.value.title}" নোটিশটা ${audienceName(aud)}-এর ইনবক্সে চলে যাবে${level ? ' (ক্লাস ' + bn(level) + ')' : ''}। ভুল হলে আর্কাইভ করা যাবে।`, ok: 'হ্যাঁ, পাঠান', cancel: 'আবার দেখি' })) return;
    go.disabled = true; go.textContent = 'একটু অপেক্ষা…';
    const st = await sendNotice(v.value);
    go.disabled = false; go.textContent = 'নোটিশ পাঠান';
    if (st === 'failed' || st === 'rejected') return saveBar.show(st, { onRetry: () => go.click() });
    sheet.close(); saveBar.show(st, { text: st === 'saved' ? 'নোটিশ গেছে' : undefined }); if (st === 'saved') reload();
  });
}
function view(n, reload) {
  const arch = !!n.archived_at;
  const act = async (fn, okText) => {
    const st = await fn();
    if (st !== 'saved') return toast(st === 'offline' ? 'নেট নেই। নেট এলে আবার চেষ্টা করুন।' : 'হয়নি, আবার চেষ্টা করুন।');
    sheet.close(); toast(okText); reload();
  };
  const del = async () => { if (await confirmBox({ title: 'চিরতরে মুছবেন?', text: `"${n.title}" আর ফেরত আনা যাবে না।`, ok: 'হ্যাঁ, মুছুন', cancel: 'না, থাক', danger: true })) act(() => deleteNotice(n.id), 'নোটিশ মুছে গেছে।'); };
  const sheet = openSheet({ title: n.title, content: h('div', { class: 'sheet-col' }, h('p', { class: 'tc-cap', text: `${noticeWho(n)} · ${shortDate(n.created_at)}` }), h('p', { class: 'tc-body', text: n.body }),
    h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: () => act(() => setArchived(n.id, !arch), arch ? 'নোটিশ ফিরে এসেছে।' : 'আর্কাইভ হয়েছে।') }, arch ? 'আবার চালু করুন' : 'আর্কাইভ করুন (ইনবক্স থেকে সরবে)'),
    arch ? h('button', { class: 'de-btn de-btn--secondary', type: 'button', onclick: del }, icon('trash'), 'চিরতরে মুছুন') : null) });
}

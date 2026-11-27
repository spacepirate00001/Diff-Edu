// The "পড়ালেখা" tab of a guardian: the child strip and a list of what to look at. Each row opens its own page (/study/<name>).
import { h } from '../../ui/dom.js';
import { navRow } from '../../ui/navrow.js';
import { chip } from '../../ui/chip.js';
import { loading } from '../../ui/states.js';
import { kids } from '../../core/children.js';
import { features } from '../../core/features.js';
import { childBar, noKidsCard } from '../switcher/child-switcher.js';

// [route name, icon, title, one line, feature key (hidden when the server turned it off) | null]
export const STUDY_ROWS = [
  ['report', 'file', 'রিপোর্ট কার্ড', 'সপ্তাহের ফল, স্কোর ও ক্লাসে অবস্থান', 'reports'],
  ['results', 'chart', 'পরীক্ষার ফল', 'প্রতিটা পরীক্ষার নম্বর ও গড়', 'reports'],
  ['att', 'check', 'উপস্থিতি', 'ক্যালেন্ডারে মাসের হিসাব', 'attendance'],
  ['homework', 'book', 'বাড়ির কাজ', 'কী কবে জমা দিতে হবে', null],
  ['routine', 'clock', 'ক্লাস রুটিন', 'কোন ক্লাসে কোন শিক্ষক', null],
  ['revision', 'exam', 'পড়ার পরিকল্পনা', 'পরীক্ষার আগের দিনগুলোর ভাগ করা পড়া', null],
  ['materials', 'play', 'নোট ও ভিডিও', 'শিক্ষকের দেওয়া উপকরণ', null],
  ['ratings', 'user', 'রেটিং ও প্রশংসা', 'ক্লাসে আচরণ ও কাজের রেটিং', 'ratings'],
  ['goals', 'check', 'লক্ষ্য', 'বিষয় ধরে নম্বরের লক্ষ্য', null],
  ['certs', 'file', 'সার্টিফিকেট', 'যা যা অর্জন হয়েছে', null],
];
export const studyRoute = name => `/study/${name}`;

export function studyTab(ctx) {
  const root = h('div', { class: 'study-hub' }), box = h('div');
  const draw = () => {
    const list = STUDY_ROWS.filter(r => !r[5] && (!r[4] || features.has(r[4])));
    const today = kids.today()?.children?.find(c => c.student_id === kids.current()?.id);
    const bar = childBar();
    if (!bar && !kids.list().length) return box.replaceChildren(noKidsCard());
    box.replaceChildren(bar || '', h('div', { class: 'de-card more-card' }, ...list.map(([name, ic, title, sub]) => navRow({ ic, text: title, sub, tag: name === 'report' && today?.report && !today.report.seen ? 'নতুন' : null, onclick: () => ctx.go(studyRoute(name)) }))));
  };
  root.append(box);
  if (kids.list().length) draw(); else { box.append(loading(2)); kids.load({ maxAge: 15000 }).then(draw); }
  const off = kids.on(() => { if (root.isConnected) draw(); });
  return { node: root, destroy: off };
}
export { chip };

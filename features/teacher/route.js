// Which page /class/*, /contact/(guardians|doubts|notice) and /more/(automation|me) shows (teacher only; router.js guards the roles). Loaded when one of these pages is first opened.
// -> { tab, title, back, result } | null
import { ready } from './css.js';

export async function teacherPage(segs, ctx, query = {}) {
  await ready;
  const [area, name, arg] = segs;
  if (area === 'class') {
    if (name === 'attend') return { tab: 'class', title: 'হাজিরা নিন', back: true, result: (await import('./attend.js')).attendPage(ctx, query) };
    if (name === 'rate') return { tab: 'class', title: 'ক্লাস রেটিং', back: true, result: (await import('./rate.js')).ratePage(ctx, query) };
    if (name === 'homework') return { tab: 'class', title: 'বাড়ির কাজ', back: true, result: (await import('./homework.js')).homeworkPage(ctx) };
    if (name === 'students') return { tab: 'class', title: 'শিক্ষার্থী ও ফোন', back: true, result: (await import('./students.js')).studentsPage(ctx) };
  }
  if (area === 'contact') {
    if (name === 'guardians') { const G = await import('./guardians.js'); return arg ? { tab: 'inbox', title: 'অভিভাবকের সাথে বার্তা', back: true, result: G.threadPage(ctx, arg) } : { tab: 'inbox', title: 'অভিভাবকদের সাথে বার্তা', back: true, result: G.guardiansPage(ctx) }; }
    if (name === 'doubts') return { tab: 'inbox', title: 'শিক্ষার্থীদের প্রশ্ন', back: true, result: (await import('./doubts.js')).doubtsPage(ctx) };
    if (name === 'notice') return { tab: 'inbox', title: 'নোটিশ পাঠান', back: true, result: (await import('./notice.js')).noticePage(ctx) };
  }
  if (area === 'more') {
    if (name === 'automation') return { tab: 'more', title: 'অটোমেশনের নিয়ম', back: true, result: (await import('./automation.js')).automationPage(ctx) };
    if (name === 'me') return { tab: 'more', title: 'আমার প্রোফাইল ও সময়সূচি', back: true, result: (await import('./me.js')).mePage(ctx) };
  }
  return null;
}

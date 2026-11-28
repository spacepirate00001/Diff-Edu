// Pages of step 5 (teacher): /more/marks[/:id], /more/upload, /more/approve[/:id], /more/qbank, /more/cards, /more/paper[/:id[/edit]]. Loaded when one of them is first opened.
// -> { tab, title, back, result } | null
import { ready } from '../teacher/css.js';

export async function examsPage(segs, ctx, query = {}) {
  await ready;
  const [, name, arg] = segs;
  const base = { tab: 'more', back: true };
  if (name === 'marks') { const M = await import('./marks.js'); return arg ? { ...base, title: 'নম্বর এন্ট্রি', result: M.marksEntryPage(ctx, arg) } : { ...base, title: 'নম্বর এন্ট্রি', result: M.marksListPage(ctx) }; }
  if (name === 'upload') return { ...base, title: 'প্রশ্ন জমা', result: (await import('./upload.js')).uploadPage(ctx) };
  if (name === 'approve') { const A = await import('./approve.js'); return arg ? { ...base, title: 'প্রশ্ন অনুমোদন', result: A.approveSourcePage(ctx, arg) } : { ...base, title: 'প্রশ্ন অনুমোদন', result: A.approveListPage(ctx) }; }
  if (name === 'qbank') return { ...base, title: 'প্রশ্ন ব্যাংক', result: (await import('./qbank.js')).qbankPage(ctx, query) };
  if (name === 'paper') {
    const G = await import('./paper-pages.js');
    if (!arg) return { ...base, title: 'প্রশ্নপত্র', result: G.paperListPage(ctx) };
    if (segs[3] === 'edit' || arg === 'new') return { ...base, title: arg === 'new' ? 'নতুন প্রশ্নপত্র' : 'প্রশ্নপত্র সম্পাদনা', result: G.paperBuilderPage(ctx, arg) };
    return { ...base, title: 'প্রশ্নপত্র', result: G.paperViewPage(ctx, arg) };
  }
  if (name === 'cards') return { ...base, title: 'রিপোর্ট কার্ড', result: (await import('./cards.js')).cardsPage(ctx) };
  return null;
}

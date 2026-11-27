// Pages of step 6: admin /office/fees|admissions|notices|honorarium, teacher /more/honorarium. Loaded when one of them is first opened.
// -> { tab, title, back, result } | null
import { ready } from '../teacher/css.js';

export async function officePage(segs, ctx, query = {}) {
  await ready;
  const name = segs[segs.length - 1], teacher = segs[0] === 'more';
  if (teacher) return name === 'honorarium' ? { tab: 'more', back: true, title: 'আমার সম্মানী', result: (await import('./honorarium.js')).teacherHonorPage(ctx) } : null;
  const base = { tab: 'office', back: true };
  if (name === 'fees') return { ...base, title: 'ফি', result: (await import('./fees.js')).feesPage(ctx, query) };
  if (name === 'honorarium') return { ...base, title: 'সম্মানী', result: (await import('./honorarium.js')).adminHonorPage(ctx) };
  if (name === 'admissions') return { ...base, title: 'ভর্তির খোঁজ', result: (await import('./admissions.js')).admissionsPage(ctx) };
  if (name === 'notices') return { ...base, title: 'নোটিশ', result: (await import('./notices.js')).noticesPage(ctx) };
  return null;
}

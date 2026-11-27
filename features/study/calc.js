// Study numbers, pure (tested). Report-card maths is the LIVE rule: 60% marks + 40% class rating (compute_report_scores, 19-report-score.sql,
// and pwa-dev/reports.js). The server writes score, rank and award into report_cards.data; this file only shows and checks them.
import { bn, dhakaParts, dhakaDay } from '../../core/bn.js';

export const W_MARKS = 0.6, W_RATING = 0.4;
export const grade = p => (p >= 80 ? 'A+' : p >= 70 ? 'A' : p >= 60 ? 'A-' : p >= 50 ? 'B' : p >= 40 ? 'C' : p >= 33 ? 'D' : 'F');
export const rankBn = n => bn(n) + ([1, 5, 7, 8, 9, 10].includes(n) ? 'ম' : [2, 3].includes(n) ? 'য়' : n === 4 ? 'র্থ' : n === 6 ? 'ষ্ঠ' : 'তম');
export const d1 = v => (v == null ? '—' : bn((Math.round(v * 10) / 10).toString()));

// marks% = 100 * sum(obtained, missing = 0) / sum(full marks). lines: [{ f: full, o: obtained|null }]
export function marksPct(lines) {
  const full = lines.reduce((s, l) => s + (Number(l.f) || 0), 0), got = lines.reduce((s, l) => s + (Number(l.o) || 0), 0);
  return full > 0 ? { full, got, pct: 100 * got / full } : { full, got, pct: null };
}
// score = 0.6 * marks% + 0.4 * rating * 10 (rating is out of 10); one of the two when only one exists; null when neither.
export function reportScore(pct, rating) {
  if (pct != null && rating != null) return W_MARKS * pct + W_RATING * rating * 10;
  if (pct != null) return pct;
  if (rating != null) return rating * 10;
  return null;
}
// The numbers a card view shows, from one report_cards row.
export function cardFacts(c) {
  const d = c.data || {}, lines = d.lines || [], m = marksPct(lines);
  return { ...m, grade: m.pct == null ? '—' : grade(m.pct), rating: d.rating ?? null, score: d.score ?? reportScore(m.pct, d.rating ?? null), present: d.present || 0, days: d.days || 0, rank: c.rank || null, size: c.class_size || 0, award: c.award || null, lines };
}
// Kind line printed on every card; nothing at all is better than a sad line.
export function cheer(pct, up, name) {
  const base = pct >= 80 ? 'দারুণ করেছ! এভাবেই এগিয়ে চলো।' : pct >= 60 ? 'ভালো করেছ! আরেকটু চেষ্টায় আরও ভালো হবে।' : '';
  if (!base && !up) return '';
  return `${name}, ${base || 'গত সপ্তাহের চেয়ে এগিয়েছ ↑'}${base && up ? ' গত সপ্তাহের চেয়ে এগিয়েছ ↑' : ''}`;
}

// ---- attendance ----
// rows: [{ date:'YYYY-MM-DD', check_in }]. A row with check_in = present, a row without = absent, no row = no class that day.
export function attendanceMonth(rows, y, m /* 1-12 */, nowIso) {
  const by = Object.fromEntries(rows.map(r => [r.date, r]));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate(), first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const cells = []; let present = 0, absent = 0;
  for (let d = 1; d <= days; d++) {
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, r = by[iso];
    const state = r ? (r.check_in ? 'present' : 'absent') : 'none';
    if (state === 'present') present++; else if (state === 'absent') absent++;
    cells.push({ d, iso, state, today: iso === nowIso });
  }
  const held = present + absent;
  return { cells, lead: first, present, absent, pct: held ? Math.round(100 * present / held) : null };
}
// Consecutive most recent class days present (newest first). Days with no row are not class days and are skipped.
export function streakOf(rows) {
  let n = 0;
  for (const r of rows.slice().sort((a, b) => b.date.localeCompare(a.date))) { if (r.check_in) n++; else break; }
  return n;
}
export const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const weekStart = iso => addDays(iso, -((new Date(iso + 'T00:00:00Z').getUTCDay() + 1) % 7));   // Saturday
const WD = ['শনি', 'রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র'];
// What the "আজ" cards need when the server does not send a preview: week dots, 7-day trend, streak. From attendance + class_ratings rows.
// ratings: [{ day, behavior, homework, performance }] (each row is out of 10 in total).
export function derivePreview(att, ratings, now = Date.now()) {
  const today = dhakaDay(now), start = weekStart(today), by = Object.fromEntries(att.map(r => [r.date, r]));
  const week = WD.map((day, i) => { const iso = addDays(start, i), r = by[iso]; return { day, state: iso > today ? 'none' : r ? (r.check_in ? 'present' : 'absent') : 'none', is_today: iso === today }; });
  const tot = r => Number(r.behavior) + Number(r.homework) + Number(r.performance);
  const perDay = {}; ratings.forEach(r => (perDay[r.day] ||= []).push(tot(r)));
  const trend = Array.from({ length: 7 }, (_, i) => { const iso = addDays(today, i - 6), v = perDay[iso]; const p = dhakaParts(new Date(iso + 'T06:00:00Z').getTime());
    return { day: WD[(p.wd + 1) % 7], score: v ? Math.round(v.reduce((s, x) => s + x, 0) / v.length * 10) / 10 : null, score_max: 10, is_today: iso === today }; });
  const t = trend.at(-1);
  return { score: t.score, score_max: 10, streak_days: streakOf(att), week, trend };
}

// ---- revision plan (port of family.js revisionPlan): chapters spread over the days left, unfinished first, last day = everything ----
export function revisionPlan(examDate, chapters, today) {
  const days = Math.round((new Date(examDate + 'T00:00:00Z') - new Date(today + 'T00:00:00Z')) / 864e5);
  if (days <= 0 || !chapters.length) return [];
  const ordered = chapters.slice().sort((a, b) => (a.status === 'done') - (b.status === 'done') || a.number - b.number);
  if (days === 1) return [{ date: today, chapters: ordered, full: true }];
  const studyDays = Math.max(1, days - 1), per = Math.max(1, Math.ceil(ordered.length / studyDays)), chunks = [];
  for (let i = 0; i < ordered.length; i += per) chunks.push(ordered.slice(i, i + per));
  const plan = [];
  for (let i = 0; i < studyDays; i++) plan.push({ date: addDays(today, i), chapters: chunks[i] || chunks[i % chunks.length], full: false });
  plan.push({ date: addDays(examDate, -1), chapters: ordered, full: true });
  return plan;
}
// Average of marks as a percent (the live "ফলাফল" page).
export const avgPercent = marks => (marks.length ? Math.round(marks.reduce((s, m) => s + m.obtained / m.exam.full_marks, 0) / marks.length * 100) : null);

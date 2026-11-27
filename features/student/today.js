// The student's "আজ": sky header, then the student's own day in student voice. Real sources: rpc today_student (homework left, next exam, stars),
// attendance + class_ratings (today, week, 7-day trend). A teacher note and "next class" are drawn only when the server sends them (today_student.preview).
import { h } from '../../ui/dom.js';
import { skyHeader, skyButtons, firstName } from '../today/today.js';
import { stateCard, loading, offlineState, errorState, staleBanner } from '../../ui/states.js';
import { rpc } from '../../core/api.js';
import { cache } from '../../core/cache.js';
import { session } from '../../core/session.js';
import { sky } from '../../core/sky.js';
import { self } from '../../core/student-self.js';
import { bn, dhakaDay, clockText } from '../../core/bn.js';
import { loadPreviewInputs } from '../study/data.js';
import { derivePreview, addDays } from '../study/calc.js';
import { deriveNudges } from '../today/extras.js';
import { me, noRecState } from './common.js';
import { progressLine } from './logic.js';
import { heroCard, nextClassCard, homeworkCard, examCard, weekCard, trendCard, starsCard, nudgeCard, askButton } from './cards.js';

const dueLabel = (d, today) => (!d ? 'দিনের মধ্যে' : d === today ? 'আজ জমা' : d === addDays(today, 1) ? 'কাল জমা' : 'জমা দিতে হবে');
// Pure: the server's answers -> what the cards draw. `att` rows may be empty. Tested.
export function buildToday({ t, att, ratings, now = Date.now() }) {
  const today = dhakaDay(now), pv = derivePreview(att, ratings, now), row = att.find(r => r.date === today);
  const status = row ? (row.check_in ? 'present' : 'absent') : 'none';
  const sv = t?.preview || {};
  const tasks = (t?.tasks || []).slice(0, 3).map(x => ({ title: x.title, due_label: dueLabel(x.due_date, today) }));
  const streak = t?.rewards?.streak_days ?? pv.streak_days;
  const exam = t?.next_exam || null;
  return {
    today: { status, arrived_at: status === 'present' ? clockText(row.check_in) : null, score: pv.score ?? sv.score ?? null, score_max: pv.score_max, note: sv.teacher_note || null },
    week: pv.week, trend: pv.trend, streak, tasks, exam, next_class: sv.next_class || null, stars: t?.rewards?.stars ?? 0,
    nudges: deriveNudges({ homework: (t?.tasks || []).map(x => ({ title: x.title, due_date: x.due_date, done: false })), streak, exams: exam ? [{ exam_date: exam.exam_date }] : [], today }),
  };
}

export function studentToday(ctx) {
  const cards = h('div', { class: 'v6-cards', id: 'st-cards', 'aria-live': 'polite' });
  const root = h('div', { class: 'today-root' }, skyHeader({ child: false, actions: skyButtons(ctx) }), cards);
  const uid = session.uid();
  let dead = false, run = 0, ask = null;
  const paint = () => window.TodayV7?.paintSky?.(firstName(ctx.me.full_name));
  const off = sky.subscribe(paint);
  import('../diffy/diffy-chat.js').then(m => { if (m.diffyAvailable() && !dead) { ask = () => m.openDiffy({ ctx, kid: self.get(), student: true }); go(true); } });

  async function load() {
    const rec = await me();
    if (!rec) return { kind: 'noself' };
    const [t, pv] = await Promise.all([rpc('today_student'), loadPreviewInputs(rec.id)]);
    if (t.kind !== 'ok' && pv.kind !== 'ok') return { kind: t.kind === 'offline' || pv.kind === 'offline' ? 'offline' : 'error' };
    const data = buildToday({ t: t.kind === 'ok' ? t.data : null, att: pv.kind === 'ok' ? pv.data.att : [], ratings: pv.kind === 'ok' ? pv.data.ratings : [] });
    cache.set(uid, 'stoday', data);
    return { kind: 'ok', data };
  }
  function draw(d, stale) {
    const askFn = ask ? () => ask() : null;
    cards.replaceChildren(...[stale ? staleBanner(stale, cache.get(uid, 'stoday')?.at) : null, heroCard(d.today, d.streak, { onAsk: askFn }),
      d.next_class ? nextClassCard(d.next_class) : null, homeworkCard(d.tasks, () => ctx.go('/learn/homework')), d.exam ? examCard(d.exam, () => ctx.go('/learn/revision')) : null,
      weekCard(d.week, d.streak), d.trend.some(x => x.score != null) ? trendCard(d.trend) : null, starsCard(d.stars, progressLine(d.stars), () => ctx.go('/play')),
      d.nudges.length ? nudgeCard(d.nudges) : null, askFn ? askButton(askFn) : null].filter(Boolean));
  }
  async function go(quiet) {
    const me0 = ++run;
    if (!quiet) cards.replaceChildren(loading(3));
    const r = await load();
    if (dead || me0 !== run) return;
    const old = cache.get(uid, 'stoday')?.v;
    if (r.kind === 'ok') return draw(r.data);
    if (r.kind === 'noself') return cards.replaceChildren(noRecState(() => go()));
    if (old) return draw(old, r.kind === 'offline' ? 'offline' : 'error');
    cards.replaceChildren(r.kind === 'offline' ? offlineState(() => go()) : errorState(() => go()));
  }
  go();
  return { node: root, chrome: 'sky', onMount: paint, destroy() { dead = true; off(); } };
}
export { stateCard };

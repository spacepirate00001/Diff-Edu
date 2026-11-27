// Which page /study/<name> shows. Loaded only when a study page is opened.
import { STUDY_ROWS } from './study.js';

export async function studyPage(name, ctx, query = {}) {
  const row = STUDY_ROWS.find(r => r[0] === name);
  if (!row) return null;
  const P = await import('./pages.js');
  const result = name === 'report' ? (await import('./report.js')).reportPage()
    : name === 'results' ? P.resultsPage() : name === 'att' ? P.attendancePage() : name === 'homework' ? P.homeworkPage() : name === 'routine' ? P.routinePage()
    : name === 'revision' ? P.revisionPage() : name === 'materials' ? P.materialsPage(query.kind) : name === 'ratings' ? P.ratingsPage() : name === 'goals' ? P.goalsPage() : P.certsPage();
  return { title: row[2], result };
}

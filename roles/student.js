// Student: আজ · পড়া · খেলা · আরও. All four are built (step 3). The pages under them are in features/student/ (route.js opens them on demand).
// This module itself is only loaded for a student, so its imports are not part of the first download.
import { ready } from '../features/student/css.js';
import { moreTab } from '../features/more/more.js';
import { studentToday } from '../features/student/today.js';
import { learnTab } from '../features/student/learn.js';
import { playTab } from '../features/student/play.js';

await ready;   // the student's stylesheet loads with the student's first page
export function studentTab(id, ctx) {
  if (id === 'today') return studentToday(ctx);
  if (id === 'study') return learnTab(ctx);
  if (id === 'play') return playTab(ctx);
  if (id === 'more') return moreTab(ctx);
  return null;
}

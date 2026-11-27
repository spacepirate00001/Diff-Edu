// Teacher: আজ · ক্লাস · যোগাযোগ · আরও. All four are built (step 4); the pages under them are in features/teacher/ (route.js opens them on demand).
// This module itself is only loaded for a teacher, so its imports are not part of the first download.
import { ready } from '../features/teacher/css.js';
import { teacherToday } from '../features/teacher/today.js';
import { classTab } from '../features/teacher/class.js';
import { teacherContact } from '../features/teacher/contact.js';
import { moreTab } from '../features/more/more.js';

await ready;   // the teacher's stylesheet loads with the teacher's first page
export function teacherTab(id, ctx) {
  if (id === 'today') return teacherToday(ctx);
  if (id === 'class') return classTab(ctx);
  if (id === 'inbox') return teacherContact(ctx);
  if (id === 'more') return moreTab(ctx);
  return null;
}

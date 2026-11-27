// Guardian: আজ · পড়ালেখা · যোগাযোগ (চ্যাট, ফোন, ইনবক্স) · আরও. All four are built (step 2).
import { guardianToday } from '../features/today/today.js';
import { moreTab } from '../features/more/more.js';
import { studyTab } from '../features/study/study.js';
import { contactTab } from '../features/contact/contact.js';

export function guardianTab(id, ctx) {
  if (id === 'today') return guardianToday(ctx);
  if (id === 'study') return studyTab(ctx);
  if (id === 'inbox') return contactTab(ctx);
  if (id === 'more') return moreTab(ctx);
  return null;
}

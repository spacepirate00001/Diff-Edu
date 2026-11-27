// Admin: আজ · ক্লাস · অফিস · আরও.
import { staffToday } from '../features/today/today.js';
import { moreTab } from '../features/more/more.js';
import { comingTab } from './coming.js';
import { officeTab } from '../features/office/hub.js';

export function adminTab(id, ctx) {
  if (id === 'today') return staffToday(ctx);
  if (id === 'more') return moreTab(ctx);
  if (id === 'office') return officeTab(ctx);
  return comingTab(ctx, id);
}

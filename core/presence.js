// "Is this person's app open right now?" The signed-in app tells the server every couple of minutes while it is on screen (rpc ping_presence).
// Staff read the result on the all-students page (features/teacher/everyone.js). A failed ping is silent: it must never bother anyone.
import { rpc } from './api.js';
import { session } from './session.js';

const EVERY = 2 * 60 * 1000;
let timer = null, last = 0;
const ping = () => { if (typeof document !== 'undefined' && document.hidden) return; if (!session.has()) return; last = Date.now(); rpc('ping_presence').catch(() => {}); };
export const presence = {
  start() {
    if (timer || typeof document === 'undefined') return;
    ping();
    timer = setInterval(ping, EVERY);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - last > EVERY / 2) ping(); });
  },
  stop() { clearInterval(timer); timer = null; },
};
// How a student looks to staff, from the server row { last_seen, opened_today } and "now" (ms). 'live' = open in the last 5 minutes.
export const LIVE_MS = 5 * 60 * 1000;
export function presenceOf(row, now = Date.now()) {
  if (!row) return 'unknown';
  const t = row.last_seen ? Date.parse(row.last_seen) : NaN;
  if (Number.isFinite(t) && now - t <= LIVE_MS) return 'live';
  return row.opened_today ? 'today' : 'none';
}

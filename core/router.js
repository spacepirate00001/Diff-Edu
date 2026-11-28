// Routes live in the # part of the address, so the phone's back button works and a reload lands on the same page.
// parse / match / guard are pure (tested); start / go / replace / back touch the browser.
import { tabIds } from '../roles/tabs.js';

// The study pages of a guardian (features/study/study.js lists the same names; a test keeps them equal).
export const STUDY_PAGES = ['report', 'results', 'att', 'homework', 'routine', 'revision', 'materials', 'ratings', 'goals', 'certs'];
// The student's pages (step 3). /learn = "পড়া" and its sub-pages, /play = "খেলা", /me = the student's own profile. The word list is one place (tests read it).
export const LEARN_PAGES = ['syllabus', 'materials', 'quiz', 'mistakes', 'practice', 'revision', 'exams', 'results', 'report', 'homework', 'merit', 'ratings', 'goals', 'certs', 'flash', 'doubts', 'focus', 'diffy'];
export const PLAY_PAGES = ['tournament', 'teams', 'games', 'board', 'shop', 'decor', 'chat', 'duel', 'memes'];
// The teacher's pages (step 4). /class/* under "ক্লাস", /contact/* under "যোগাযোগ", /more/automation and /more/me under "আরও". One word list, tests read it.
export const CLASS_PAGES = ['attend', 'rate', 'homework', 'students', 'all'];
export const CONTACT_PAGES = ['guardians', 'doubts', 'notice'];
export const TEACHER_MORE = ['automation', 'me'];
// Step 5: the teacher's exam work under "আরও" (features/exams/route.js). marks and approve also open one item: /more/marks/:id, /more/approve/:id.
export const EXAM_PAGES = ['marks', 'upload', 'approve', 'qbank', 'cards', 'paper'];
// Step 6: the admin's office pages under "অফিস" (features/office/route.js); the teacher's honorarium is /more/honorarium.
export const OFFICE_PAGES = ['fees', 'admissions', 'notices', 'honorarium', 'family', 'feedback', 'people', 'corrections', 'routine', 'all'];
export const PUBLIC = ['/welcome', '/login', '/admission'];
export const GATE = ['/pin-set', '/consent'];

export function parse(hash) {
  let h = String(hash || '').replace(/^#/, '');
  try { h = decodeURIComponent(h); } catch { /* keep as typed */ }
  const [pathPart, queryPart = ''] = h.split('?');
  const path = '/' + pathPart.split('/').filter(Boolean).join('/');
  const query = Object.fromEntries(new URLSearchParams(queryPart));
  return { path: path === '/' ? '' : path, segs: path.split('/').filter(Boolean), query };
}
// Static table. roles: who may enter (omit = every signed-in role). Tab roots are added per role in tabRoutes().
export const ROUTES = [
  { path: '/welcome', public: true }, { path: '/login', public: true }, { path: '/admission', public: true },
  { path: '/pin-set', gate: true }, { path: '/consent', gate: true, roles: ['guardian'] },
  { path: '/inbox' }, { path: '/inbox/:id' }, { path: '/search' },
  { path: '/more/display' }, { path: '/more/pin' }, { path: '/more/privacy', roles: ['guardian'] }, { path: '/more/pending' }, { path: '/more/help' }, { path: '/more/licenses' },
  ...STUDY_PAGES.map(n => ({ path: '/study/' + n, roles: ['guardian'] })),
  { path: '/more/fees', roles: ['guardian'] }, { path: '/more/profile', roles: ['guardian'] },
  { path: '/contact/chat', roles: ['guardian'] }, { path: '/contact/friends', roles: ['guardian'] },
  ...LEARN_PAGES.map(n => ({ path: '/learn/' + n, roles: ['student'] })), { path: '/learn/quiz/:id', roles: ['student'] },
  ...PLAY_PAGES.map(n => ({ path: '/play/' + n, roles: ['student'] })), { path: '/play/games/:game', roles: ['student'] }, { path: '/play/chat/:peer', roles: ['student'] }, { path: '/me/profile', roles: ['student'] },
  ...CLASS_PAGES.map(n => ({ path: '/class/' + n, roles: ['teacher'] })),
  ...CONTACT_PAGES.map(n => ({ path: '/contact/' + n, roles: ['teacher'] })), { path: '/contact/guardians/:sid', roles: ['teacher'] },
  ...TEACHER_MORE.map(n => ({ path: '/more/' + n, roles: ['teacher'] })), { path: '/more/push' },
  ...EXAM_PAGES.map(n => ({ path: '/more/' + n, roles: ['teacher'] })), { path: '/more/marks/:id', roles: ['teacher'] }, { path: '/more/approve/:id', roles: ['teacher'] }, { path: '/more/paper/:id', roles: ['teacher'] }, { path: '/more/paper/:id/edit', roles: ['teacher'] },
  ...OFFICE_PAGES.map(n => ({ path: '/office/' + n, roles: ['admin'] })), { path: '/more/honorarium', roles: ['teacher'] }, { path: '/more/memes', roles: ['teacher', 'admin'] },
  { path: '/f/:id' }, { path: '/exam/:id', roles: ['student'] },
];
const matchPath = (pattern, segs) => {
  const p = pattern.split('/').filter(Boolean);
  if (p.length !== segs.length) return null;
  const params = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = segs[i]; else if (p[i] !== segs[i]) return null;
  }
  return params;
};
// -> { route, params } | null. role decides which tab roots exist.
export function match(path, role) {
  const segs = path.split('/').filter(Boolean);
  if (segs.length === 1 && role && tabIds(role).includes(segs[0])) return { route: { path: '/' + segs[0], tab: true }, params: {} };
  for (const route of ROUTES) { const params = matchPath(route.path, segs); if (params) return { route, params }; }
  return null;
}
// The decision. ctx = { signedIn, role, gate: null | '/pin-set' | '/consent', featureOff: (routeParams) => bool }
// -> { ok:true, route, params } | { ok:false, redirect, why }
export function guard(path, ctx) {
  const role = ctx.role;
  const m = match(path, role);
  const home = '/today';
  if (!ctx.signedIn) {
    if (m && m.route.public) return { ok: true, ...m };
    return { ok: false, redirect: '/welcome', why: 'login' };
  }
  if (ctx.gate && !(m && m.route.gate && m.route.path === ctx.gate)) return { ok: false, redirect: ctx.gate, why: 'gate' };
  if (!m) return { ok: false, redirect: home, why: 'unknown' };
  if (m.route.public) return { ok: false, redirect: home, why: 'signed-in' };
  if (m.route.gate && !ctx.gate) return { ok: false, redirect: home, why: 'no-gate' };
  if (m.route.roles && !m.route.roles.includes(role)) return { ok: false, redirect: home, why: 'role' };
  if (!tabIds(role).length) return { ok: false, redirect: '/welcome', why: 'role-unknown' };
  if (ctx.featureOff?.(m)) return { ok: true, ...m, off: true };
  return { ok: true, ...m };
}
// Where to go after sign-in or on first open: the forced step (new PIN, consent), otherwise "আজ".
export function nextGate({ me, consentDone }) {
  if (!me) return null;
  if (me.must_change_pin) return '/pin-set';
  if (me.role === 'guardian' && consentDone === false) return '/consent';
  return null;
}

// ---- browser side ----
let onRoute = null;
export const here = () => parse(globalThis.location?.hash);
export function start(cb) {
  onRoute = cb;
  globalThis.addEventListener('hashchange', () => onRoute(here()));
  onRoute(here());
}
export const go = path => { if (here().path === path) onRoute?.(here()); else globalThis.location.hash = '#' + path; };
export const replace = path => { globalThis.history.replaceState(null, '', '#' + path); onRoute?.(here()); };
export const back = () => { if (globalThis.history.length > 1) globalThis.history.back(); else replace('/today'); };
// Tab switch: from "আজ" push (so back returns to "আজ"), from any other tab replace (back leaves the tab pile).
export function goTab(id) { const cur = here().segs[0]; if (cur === id) return; if (cur === 'today') go('/' + id); else replace('/' + id); }

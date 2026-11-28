// Start of the /next/ app: saved session -> profile -> forced steps (new PIN, consent) -> the shell with 4 tabs.
// Plain ES modules, no build step. Pages are loaded when first opened (import()), so the first download stays small.
import { installIcons } from './ui/icons.js';
import { h } from './ui/dom.js';
import { toast } from './ui/toast.js';
import { confirmBox } from './ui/dialog.js';
import { stateCard } from './ui/states.js';
import { prefs } from './core/prefs.js';
import { store } from './core/store.js';
import { net } from './core/net.js';
import { setTransport } from './core/http.js';
import { session } from './core/session.js';
import { features } from './core/features.js';
import { flags } from './core/flags.js';
import { kids } from './core/children.js';
import { sky } from './core/sky.js';
import { loadMe } from './core/account.js';
import { sel, rpc, rows } from './core/api.js';
import { self } from './core/student-self.js';
import { cache } from './core/cache.js';
import { dhakaDay } from './core/bn.js';
import { outbox, startFlushing, migrateLegacy } from './core/outbox-app.js';
import * as router from './core/router.js';
import { tabsFor, tabById, hasTab } from './roles/tabs.js';
import { createShell } from './roles/shell.js';
import { inbox } from './features/inbox/store.js';
import { presence } from './core/presence.js';
import { openSwitcher } from './features/switcher/child-switcher.js';

const root = document.getElementById('app');
const params = new URLSearchParams(location.search);
let shell = null, view = null, page = null, gate = null, consentDone = true, returnTo = null, navId = 0, sizeAsked = false, fake = null;

const me = () => session.me();
const signedIn = () => session.has() && !!me();
const withTimeout = (p, ms, dflt) => Promise.race([p, new Promise(r => setTimeout(() => r(dflt), ms))]);

// ---- what pages get ----
const ctx = {
  get me() { return me(); },
  go: router.go, replace: router.replace, back: router.back, goTab: router.goTab,
  openSearch: () => router.go('/search'), openInbox: () => router.go('/inbox'),
  unread: () => inbox.unread(), setUnread: () => {},
  openSwitcher, toast,
  logout: () => logout(), confirmLogout: () => confirmLogout(),
  afterSignIn: () => afterSignIn(), afterPinSet: () => afterGate(), afterConsent: () => { consentDone = true; return afterGate(); },
};

// ---- signing in and out ----
async function enterApp() {
  const m = me();
  inbox.reset(); features.reset(); kids.reset(); self.reset();
  if (!tabsFor(m.role)) return false;
  // The three first questions to the server go out together (they used to wait for each other), and a saved answer from the last visit
  // is used straight away while the fresh one loads quietly behind it. A failed or slow read never blocks the app.
  const uid = session.uid(), seenKey = 'de.next.consent.' + uid;
  const savedFeatures = cache.get(uid, 'features');
  const featuresP = features.load();
  if (savedFeatures && Array.isArray(savedFeatures.v)) features.set(savedFeatures.v);
  const consentP = m.role !== 'guardian' ? Promise.resolve(true)
    : sel('consents', `select=profile_id&profile_id=eq.${uid}&app_terms=is.true&limit=1`).then(r => {
      const ok = r.kind === 'ok' ? rows(r).length > 0 : true;   // a failed read never blocks the app: the question simply comes again next time it opens
      if (r.kind === 'ok') { if (ok) store.set(seenKey, '1'); else store.del(seenKey); }
      return ok;
    });
  const consentKnown = m.role !== 'guardian' || store.get(seenKey) === '1';
  await Promise.all([savedFeatures ? null : withTimeout(featuresP, 6000, null), consentKnown ? null : withTimeout(consentP, 6000, true)]);
  consentDone = consentKnown ? true : await withTimeout(consentP, 1, true);
  gate = router.nextGate({ me: m, consentDone });
  startFlushing();
  if (m.role === 'guardian') kids.load();
  if (m.role === 'student') self.load();
  if (m.role === 'student') presence.start();
  sky.load(); inbox.load();
  if (store.get('de.next.opened') !== dhakaDay()) { store.set('de.next.opened', dhakaDay()); rpc('log_app_open'); }
  return true;
}
async function afterSignIn() {
  if (!await enterApp()) return showNoApp();
  const back = returnTo && !router.PUBLIC.includes(returnTo) ? returnTo : null; returnTo = null;
  router.replace(gate || back || '/today');
}
async function afterGate() { gate = router.nextGate({ me: me(), consentDone }); router.replace(gate || '/today'); }
async function logout() {
  await session.signOut();
  inbox.reset(); features.reset(); kids.reset(); self.reset(); sky.forget(); gate = null; consentDone = true;
  router.replace('/welcome');
}
async function confirmLogout() {
  const rowsNow = await outbox.list(session.uid());
  const n = rowsNow.length;
  if (n && !await confirmBox({ title: 'লগআউট', text: `${n}টা কাজ এখনো সার্ভারে যায়নি। লগআউট করলেও ফোনে থাকবে, কিন্তু একই আইডিতে আবার লগইন না করা পর্যন্ত যাবে না। আগে নেট চালু করে "এখনই পাঠান" চাপাই ভালো।`, ok: 'তবুও লগআউট', cancel: 'না, থাক', danger: true })) return;
  logout();
}
function showNoApp() {
  teardown();
  root.replaceChildren(h('div', { class: 'de-screen full full--cream' }, h('main', { class: 'full__body' },
    stateCard({ kind: 'forbidden', title: 'এই ভূমিকার জন্য অ্যাপ নেই', text: 'অফিসে জানান।', mascot: false, action: 'লগআউট', onAction: () => logout() }))));
  finishBoot();
}
// a tapped notification asks the open app to go to its page (core/push.js routeForPush; sw.js sends the message)
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => { const p = e.data?.type === 'push-open' ? e.data.path : null; if (typeof p === 'string' && /^\/(?!\/)[\w/?=&.:%-]{0,200}$/.test(p)) router.go(p); });
session.onExpired(() => { returnTo = router.here().path; toast('আবার লগইন করুন'); router.replace('/login'); });

// ---- showing a page ----
function teardown() { try { page?.destroy?.(); } catch { /* ignore */ } page = null; if (shell) { shell.destroy(); shell = null; } view = null; }
function finishBoot() { document.documentElement.classList.add('booted'); const sp = document.getElementById('splash'); if (sp) { sp.classList.add('is-leaving'); setTimeout(() => sp.remove(), 200); } }
const TITLES = { '/inbox': 'ইনবক্স', '/more/display': 'থিম ও লেখার সাইজ', '/more/help': 'সাহায্য', '/more/licenses': 'ওপেন-সোর্স লাইসেন্স', '/more/pending': 'আরও' };

async function build(d) {
  const R = d.route.path, role = me()?.role;
  if (/^\/(learn|play|me)\//.test(R)) { const p = await (await import('./features/student/route.js')).studentPageFor(router.here().segs, ctx, d.query); return p ? { mode: 'shell', ...p } : null; }
  if (role === 'teacher' && /^\/(class\/|contact\/(guardians|doubts|notice)|more\/(automation|me))/.test(R)) { const p = await (await import('./features/teacher/route.js')).teacherPage(router.here().segs, ctx, d.query); return p ? { mode: 'shell', ...p } : null; }
  if ((role === 'teacher' || role === 'admin') && R === '/more/memes') return { mode: 'shell', tab: 'more', back: true, title: 'মিম অনুমোদন', result: (await import('./features/memes/memes.js')).memeReviewPage() };
  if (role === 'teacher' && /^\/more\/(marks|upload|approve|qbank|cards|paper)/.test(R)) { const p = await (await import('./features/exams/route.js')).examsPage(router.here().segs, ctx, d.query); return p ? { mode: 'shell', ...p } : null; }
  if ((role === 'teacher' && R === '/more/honorarium') || (role === 'admin' && R.startsWith('/office/'))) { const p = await (await import('./features/office/route.js')).officePage(router.here().segs, ctx, d.query); return p ? { mode: 'shell', ...p } : null; }
  if (R.startsWith('/study/')) { const p = await (await import('./features/study/route.js')).studyPage(R.slice(7), ctx, d.query); return p ? { mode: 'shell', tab: 'study', title: p.title, back: true, result: p.result } : null; }
  if (d.route.tab) { const mod = await import(`./roles/${role}.js`); const id = R.slice(1); return { mode: 'shell', tab: id, title: tabById(role, id).name, result: mod[role + 'Tab'](id, ctx) }; }
  switch (R) {
    case '/welcome': return { mode: 'full', result: (await import('./features/auth/welcome.js')).welcome(ctx) };
    case '/login': return { mode: 'full', result: (await import('./features/auth/login.js')).login(ctx) };
    case '/admission': return { mode: 'full', result: (await import('./features/admission/admission.js')).admission(ctx) };
    case '/pin-set': return { mode: 'full', result: (await import('./features/auth/pin-set.js')).pinSet(ctx, { forced: true }) };
    case '/more/pin': return { mode: 'full', result: (await import('./features/auth/pin-set.js')).pinSet(ctx, { forced: false }) };
    case '/consent': return { mode: 'full', result: (await import('./features/consent/consent.js')).consentPage(ctx, { first: true }) };
    case '/more/privacy': return { mode: 'full', result: (await import('./features/consent/consent.js')).consentPage(ctx, { first: false }) };
    case '/search': return { mode: 'full', result: (await import('./features/search/search.js')).searchPage(ctx) };
    case '/inbox': return { mode: 'shell', tab: null, title: 'ইনবক্স', back: true, result: (await import('./features/inbox/inbox.js')).inboxPage(ctx) };
    case '/more/fees': return { mode: 'shell', tab: 'more', title: 'ফি ও রসিদ', back: true, result: (await import('./features/fees/fees.js')).feesPage(ctx) };
    case '/more/profile': return { mode: 'shell', tab: 'more', title: 'প্রোফাইল ও সন্তান', back: true, result: (await import('./features/more/profile.js')).profilePage(ctx) };
    case '/contact/chat': return { mode: 'shell', tab: 'inbox', title: 'শিক্ষকদের সাথে কথা', back: true, result: (await import('./features/contact/chat.js')).chatPage(ctx) };
    case '/contact/friends': return { mode: 'shell', tab: 'inbox', title: 'বন্ধুদের সাথে চ্যাট', back: true, result: (await import('./features/contact/friends.js')).friendsPage(ctx) };
    case '/more/push': return { mode: 'shell', tab: 'more', title: 'ফোনে খবর', back: true, result: (await import('./features/more/push.js')).pushPage(ctx) };
    case '/more/display': return { mode: 'shell', tab: 'more', title: TITLES[R], back: true, result: (await import('./features/more/display.js')).displayPage() };
    case '/more/licenses': return { mode: 'shell', tab: 'more', title: TITLES[R], back: true, result: (await import('./features/more/licenses.js')).licensesPage() };
    case '/more/help': return { mode: 'shell', tab: 'more', title: TITLES[R], back: true, result: (await import('./features/more/help.js')).helpPage() };
    case '/more/pending': {
      const mod = await import(`./roles/${role}.js`);
      queueMicrotask(async () => (await import('./features/offline/pending-sheet.js')).openPending());
      return { mode: 'shell', tab: 'more', title: 'আরও', result: mod[role + 'Tab']('more', ctx) };
    }
    case '/f/:id': return { mode: 'shell', ...(await featurePage(d.params.id, role)) };
    case '/exam/:id': return { mode: 'shell', tab: 'study', title: 'পরীক্ষা', back: true, result: (await import('./features/exam/screen.js')).examPage(ctx, d.params.id) };
    default: return null;
  }
}
async function featurePage(id, role) {
  const { byId, visible } = await import('./features/search/registry.js');
  const f = byId[id];
  const { forbiddenState, unavailableState } = await import('./ui/states.js');
  if (!f || !f.roles.includes(role)) return { tab: null, title: 'পাতা', back: true, result: { node: forbiddenState(() => router.go('/today')) } };
  if (!visible(f, features)) return { tab: hasTab(role, f.home) ? f.home : null, title: f.name, back: true, result: { node: unavailableState('এই সুবিধা এখন বন্ধ', () => router.go('/today')) } };
  const { bn } = await import('./core/bn.js');
  return { tab: f.home, title: f.name, back: true, result: { node: h('section', { class: 'de-card coming-card' }, h('h2', { class: 'de-row__title', text: f.name }), h('p', { class: 'coming-step', text: `এই অংশ ধাপ ${bn(f.step)}-এ আসছে।` })) } };
}

async function navigate(loc) {
  const id = ++navId;
  let path = loc.path || (signedIn() ? '/today' : '/welcome');
  const d = router.guard(path, { signedIn: signedIn(), role: me()?.role, gate });
  if (!d.ok) {
    if (d.redirect === path) return;
    if (d.why === 'login' && !router.PUBLIC.includes(path)) returnTo = path;
    return router.replace(d.redirect);
  }
  d.query = loc.query;
  document.querySelectorAll('.de-sheet, .de-sheet-scrim, .de-dialog').forEach(e => e.remove());   // a sheet never stays open on top of another page
  let b;
  try { b = await build(d); } catch (e) { console.warn('page failed', e); b = null; }
  if (id !== navId) { b?.result?.destroy?.(); return; }
  if (!b) { teardown(); root.replaceChildren(h('div', { class: 'de-screen full full--cream' }, h('main', { class: 'full__body' }, stateCard({ kind: 'error', title: 'ইশ, পাতাটা খোলা যায়নি', text: 'আবার চেষ্টা করুন।', action: 'আবার চেষ্টা করুন', onAction: () => navigate(router.here()) })))); return finishBoot(); }
  if (b.mode === 'full') {
    try { page?.destroy?.(); } catch { /* ignore */ }
    if (shell) { shell.destroy(); shell = null; }
    page = b.result; view = 'full';
    root.replaceChildren(page.node);
    page.onMount?.();
    (document.getElementById('page-title') || root).focus?.({ preventScroll: true });
    sky.apply();
  } else {
    if (view !== 'shell' || !shell) { teardown(); shell = createShell(root, ctx, { fakeUpdate: fake && params.get('update') === '1' }); view = 'shell'; }
    shell.show(b.result, { title: b.title, tab: b.tab, back: b.back });
    page = b.result;
    if (!sizeAsked && !prefs.get().sizeAsked && !gate) { sizeAsked = true; (await import('./features/more/display.js')).openSizeSheet(); }
  }
  finishBoot();
}
inbox.on(() => shell?.paintBells());

// ---- start ----
async function start() {
  installIcons();
  prefs.apply();
  window.addEventListener('online', () => net.setBrowser(false));
  window.addEventListener('offline', () => net.setBrowser(true));
  net.setBrowser(!navigator.onLine);
  // Fake mode: only on localhost / 127.0.0.1 / *.test, never on the real address.
  const role = params.get('fake');
  if (role) {
    const { createFake, fakeAllowed } = await import('./core/fake/server.js');
    if (fakeAllowed(location.hostname)) {
      const { ACCOUNTS } = await import('./core/fake/fixtures.js');
      fake = createFake(params);
      setTransport(fake.transport);
      sky.setFake(Object.fromEntries(params));
      // ?flag=online_pay,diffy_chat switches the named flags on in fake mode only (they are OFF by default, core/flags.js)
      String(params.get('flag') || '').split(',').forEach(n => flags.force(n.trim(), true));
      if (params.get('keep') !== '1') store.keys().filter(k => k.startsWith('de.next.c.') || k.startsWith('de.next.kid.') || k.startsWith('de.next.inboxSeen.') || k === 'de.next.opened').forEach(k => store.del(k));
      prefs.transient({ text: params.get('text') === 'large' ? 'large' : 'normal', theme: params.get('theme') || 'auto', sizeAsked: params.get('size') !== 'ask' });
      if (params.get('session') === 'none') session.set(null); else if (ACCOUNTS[role]) session.set(fake.session(ACCOUNTS[role]));
      // &outbox=3 (waiting writes, best with &state=offline) or &outbox=failed (one the server will refuse)
      const waiting = params.get('outbox');
      if (waiting && session.uid()) {
        const rows0 = await outbox.list(session.uid());
        if (!rows0.length) for (let i = 0; i < (waiting === 'failed' ? 1 : Number(waiting) || 3); i++) await outbox.add({ uid: session.uid(), method: 'POST', path: waiting === 'failed' ? '/rest/v1/period_attendance' : '/rest/v1/rpc/log_exam_event', body: { n: i }, label: ['হাজিরা', 'রেটিং', 'পরীক্ষার তথ্য'][i % 3] });
      }
      document.body.prepend(h('div', { id: 'fake-strip', class: 'fake-strip', role: 'note', text: 'নকল তথ্য · এটা আসল নয়' }));
      document.documentElement.classList.add('is-fake');
      window.DeFake = fake;
      window.DeDebug = { ctx, net, inbox, kids, router, session, outbox, prefs, sky, features };
    }
  }
  await migrateLegacy();
  sky.apply(); sky.startClock();
  // The printed QR code (/?install=1) opens the coaching landing page + install guide first, then the normal start (as the old app did).
  if (/[?&](install|guide)=1/.test(location.search)) {
    try { const { DeGuide } = await import('./features/landing/guide.js'); if (DeGuide.wanted()) await DeGuide.show(); } catch (e) { console.error(e); } // a broken guide must never block the app
  }
  if (session.has()) {
    // A saved copy of the profile from the last visit opens the app at once; the fresh copy loads behind it (a changed role reloads the app).
    const saved = cache.get(session.uid(), 'me');
    let r;
    if (saved && saved.v && saved.v.id === session.uid()) {
      session.setMe(saved.v); r = { me: saved.v, kind: 'ok', stale: true };
      loadMe().then(f => { if (f.me && f.me.role !== saved.v.role) location.reload(); }).catch(() => {});
    } else r = await loadMe();
    if (r.me) { if (!await enterApp()) return showNoApp(); }
    else if (r.kind === 'noprofile') await session.signOut();   // no net and no saved copy: the welcome page shows, the saved session stays
  }
  router.start(navigate);
}
start().catch(e => { console.error(e); document.getElementById('boot-fail')?.classList.add('show'); });

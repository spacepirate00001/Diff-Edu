// Offline helper for the app (served from the site root). Its cache is 'diffedu-next-vN'. It also removes the old app's caches ('diffedu-pwa-*').
// A new version installs quietly and WAITS; the page asks the person ("এখন নিন") before it takes over. Change V when any file changes.
const V = 'diffedu-next-v28';
const FILES = ['boot.js', 'core/account.js', 'core/api.js', 'core/automation.js', 'core/bn.js', 'core/cache.js', 'core/children.js', 'core/config.js', 'core/errors.js', 'core/features.js', 'core/flags.js', 'core/http.js', 'core/name-search.js', 'core/net.js', 'core/outbox-app.js', 'core/outbox.js', 'core/pin.js', 'core/prefs.js', 'core/push.js', 'core/router.js', 'core/session.js', 'core/sky.js', 'core/store.js', 'core/student-self.js', 'features/admission/admission.js', 'features/auth/forgot.js', 'features/auth/login.js', 'features/auth/pin-set.js', 'features/auth/welcome.js', 'features/consent/consent.js', 'features/consent/purposes.js', 'features/contact/chat.js', 'features/contact/contact.js', 'features/contact/friends.js', 'features/contact/rules.js', 'features/diffy/diffy-chat.js', 'features/diffy/rules.js', 'features/exam/exam.js', 'features/exam/screen.js', 'features/exams/approve.js', 'features/feedback/feedback.js', 'features/feedback/logic.js', 'features/exams/cards.js', 'features/exams/data.js', 'features/exams/logic.js', 'features/exams/marks.js', 'features/exams/paper-data.js', 'features/exams/paper-logic.js', 'features/exams/paper-pages.js', 'features/exams/paper-print.js', 'features/exams/qbank.js', 'features/exams/route.js', 'features/exams/upload.js', 'features/fees/api.js', 'features/fees/fees.js', 'features/fees/logic.js', 'features/fees/pay.js', 'features/inbox/detail.js', 'features/inbox/inbox.js', 'features/inbox/model.js', 'features/inbox/sources.js', 'features/inbox/speak.js', 'features/inbox/store.js', 'features/landing/fonts/atma-700.woff2', 'features/landing/fonts/hind-400.woff2', 'features/landing/fonts/hind-700.woff2', 'features/landing/guide.css', 'features/landing/guide.js', 'features/more/display.js', 'features/more/help.js', 'features/more/more.js', 'features/more/profile.js', 'features/more/push.js', 'features/office/admissions.js', 'features/office/corrections.js', 'features/office/data.js', 'features/office/family.js', 'features/office/feedback.js', 'features/office/fees.js', 'features/office/honorarium.js', 'features/office/hub.js', 'features/office/logic.js', 'features/office/notices.js', 'features/office/people.js', 'features/office/routine.js', 'features/office/route.js', 'features/office/ui.js', 'features/offline/banner.js', 'features/offline/pending-sheet.js', 'features/search/registry.js', 'features/search/search.js', 'features/student/cards.js', 'features/student/chat.js', 'features/student/common.js', 'features/student/css.js', 'features/student/extra.js', 'features/student/canvas.js', 'features/student/fx.js', 'features/student/games-action.js', 'features/student/games-fpv.js', 'features/student/games-new.js', 'features/student/games-more.js', 'features/student/games.js', 'features/student/learn.js', 'features/student/logic.js', 'features/student/play.js', 'features/student/practice.js', 'features/student/questions-play.js', 'features/student/questions.js', 'features/student/player.js', 'features/student/profile.js', 'features/student/route.js', 'features/student/today.js', 'features/study/calc.js', 'features/study/card-print.js', 'features/study/data.js', 'features/study/pages.js', 'features/study/report.js', 'features/study/route.js', 'features/study/study.js', 'features/switcher/child-switcher.js', 'features/teacher/attend.js', 'features/teacher/automation.js', 'features/teacher/call.js', 'features/teacher/class.js', 'features/teacher/contact.js', 'features/teacher/css.js', 'features/teacher/data.js', 'features/teacher/doubts.js', 'features/teacher/guardians.js', 'features/teacher/homework.js', 'features/teacher/logic.js', 'features/teacher/me.js', 'features/teacher/notice.js', 'features/teacher/rate.js', 'features/teacher/route.js', 'features/teacher/students.js', 'features/teacher/today.js', 'features/teacher/ui.js', 'features/today/extras.js', 'features/today/today.js', 'features/today/v7.js', 'features/update/apk-nudge.js', 'features/update/update-banner.js', 'index.html', 'manifest.webmanifest', 'print.css', 'print.html', 'print.js', 'roles/admin.js', 'roles/coming.js', 'roles/guardian.js', 'roles/shell.js', 'roles/student.js', 'roles/tabs.js', 'roles/teacher.js', 'ui/app.css', 'ui/aicons.css', 'ui/aicons.js', 'ui/appbar.js', 'ui/assets/diff-edu-logo.svg', 'ui/assets/diffy-sprite.svg', 'ui/assets/diffy-weather.svg', 'ui/bottomnav.js', 'ui/chip.js', 'ui/components.css', 'ui/datapage.js', 'ui/dialog.js', 'ui/diffy.js', 'ui/dom.js', 'ui/field.js', 'ui/fonts/OFL-LICENSE.txt', 'ui/fonts/anek-bangla-bengali-wght-normal.woff2', 'ui/fonts/anek-bangla-latin-wght-normal.woff2', 'ui/icons.js', 'ui/motion.css', 'ui/navrow.js', 'ui/page.js', 'ui/pinpad.js', 'ui/savebar.js', 'ui/sheet.js', 'ui/states.js', 'ui/student.css', 'ui/teacher.css', 'ui/toast.js', 'ui/today.css', 'ui/tokens.css', 'ui/weather.js'];

self.addEventListener('install', e => {
  // cache: 'reload' so a new version never installs files left in the browser's HTTP cache
  e.waitUntil(caches.open(V).then(c => c.addAll(FILES.map(u => new Request(u, { cache: 'reload' })))));
});
self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => (k.startsWith('diffedu-next-') && k !== V) || k.startsWith('diffedu-pwa-')).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  const scope = new URL(self.registration.scope).pathname;
  if (!u.pathname.startsWith(scope)) return;
  // the page is the same file for every address (#/today, ?fake=...), files are served from the cache first
  e.respondWith(caches.match(r.mode === 'navigate' ? 'index.html' : r, { ignoreSearch: true }).then(hit => hit || fetch(r)));
});

// ---- Web Push (step 4, behind flag web_push; the server half is a draft, nothing sends yet) ----
// The sender (functions/web-push-sender) puts the short Bangla text and the page to open in the payload: { title, body, kind, tag, path }. Nothing else is shown.
const safe = p => (typeof p === 'string' && /^\/[\w/?=&.:%-]{0,200}$/.test(p) && !p.startsWith('//') ? p : '/inbox');
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { /* a push that is not JSON still shows a plain line */ }
  e.waitUntil(self.registration.showNotification(String(d.title || 'Diff Edu').slice(0, 60), {
    body: String(d.body || 'নতুন খবর এসেছে').slice(0, 200), lang: 'bn', tag: d.tag ? String(d.tag).slice(0, 80) : undefined, icon: 'ui/assets/diff-edu-logo.svg', data: { path: safe(d.path) } }));
});
// A tap opens the app on the right page: an open window is focused and told where to go (boot.js listens), otherwise a new window opens there.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const path = safe(e.notification.data && e.notification.data.path);
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => c.url.startsWith(self.registration.scope));
    if (open) { open.postMessage({ type: 'push-open', path }); return open.focus(); }
    return self.clients.openWindow(self.registration.scope + '#' + path);
  }));
});

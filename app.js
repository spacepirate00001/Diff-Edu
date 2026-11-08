'use strict';
// Diff Edu PWA — core: config, Supabase client, offline outbox, router, login, PIN.
// Role screens live in family.js (guardian/student) and teacher.js (teacher/admin), loaded after login.
// Same Supabase backend as the Android app; RLS decides what each user sees. Keep copy/look in step with the APK.
const CFG = {
  url: 'https://uwbyxwxfhrffrrqvheft.supabase.co',
  key: 'sb_publishable_fXPLUYRqvrz9d6i9xL2IAQ_tmtZ194t', // publishable key: safe to ship, RLS protects data
  slug: 'diff-edu',
};
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const bn = n => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
const ascii = s => String(s ?? '').replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d));
const MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
const fmtDate = d => { const x = new Date(d); return `${bn(x.getDate())} ${MONTHS[x.getMonth()]}`; };
const taka = n => '৳' + bn(Math.round(n));
const dhakaToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2400); };
const SHIFTS = [
  { id: 'morning', bn: 'সকাল', time: '৭:০০ – ৯:০০' },
  { id: 'afternoon', bn: 'বিকেল', time: '৩:০০ – ৫:০০' },
  { id: 'night', bn: 'রাত', time: '৭:০০ – ৯:০০' },
];

// ---------- storage (try/catch: private windows may block it) ----------
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem('de.' + k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('de.' + k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem('de.' + k); } catch {} },
};

// ---------- APK nudge (Android only: iPhone can't install an APK) ----------
const APK_URL = CFG.url + '/storage/v1/object/public/app-updates/DiffEdu.apk';
const isAndroid = /Android/i.test(navigator.userAgent);
let apkSize = null;
if (isAndroid) fetch(CFG.url + '/storage/v1/object/public/app-updates/version.json', { cache: 'no-store' })
  .then(r => r.json()).then(v => { apkSize = v.size; }).catch(() => {});
const sizeText = () => apkSize ? ` (${bn((apkSize / 1048576).toFixed(1))} MB)` : '';
const apkBanner = () => isAndroid
  ? `<div class="card apk"><b>অ্যান্ড্রয়েড অ্যাপটি নিন</b><div class="mute">ছোট অ্যাপ, দ্রুত চলে, নেট ছাড়াও কাজ করে, নোটিফিকেশন আসে।</div><a class="primary" href="${APK_URL}" download>অ্যাপ ডাউনলোড${sizeText()}</a></div>` : '';
function apkPopup() {
  if (!isAndroid || document.querySelector('.sheet')) return;
  const last = store.get('apkAsked') || 0;
  if (Date.now() - last < 3 * 864e5) return; // at most once every 3 days
  store.set('apkAsked', Date.now());
  const d = document.createElement('div');
  d.className = 'sheet-bg';
  d.innerHTML = `<div class="sheet" role="dialog" aria-label="অ্যান্ড্রয়েড অ্যাপ"><h2>অ্যান্ড্রয়েড অ্যাপ ব্যবহার করুন</h2>
    <p class="mute">একই আইডি ও পিন দিয়ে ঢুকবেন। অ্যাপে নোটিফিকেশন সাথে সাথে আসে, নেট ছাড়াও হাজিরা নেওয়া যায়, আর চলেও দ্রুত।</p>
    <a class="primary" href="${APK_URL}" download>অ্যাপ ডাউনলোড${sizeText()}</a>
    <p class="mute small">ডাউনলোডের পর ফাইলটি খুলুন। "অজানা উৎস" জিজ্ঞেস করলে অনুমতি দিন।</p>
    <button class="link" id="later">এখন না, ওয়েবেই চালাই</button></div>`;
  document.body.appendChild(d);
  const close = () => d.remove();
  d.querySelector('#later').onclick = close;
  d.onclick = e => { if (e.target === d) close(); };
}

// ---------- Supabase ----------
const S = { access: null, refresh: store.get('rt'), uid: store.get('uid'), me: null };
const isOfflineErr = e => !e.status; // fetch threw: no internet / DNS / timeout

async function raw(method, path, body, { auth = true, prefer, retried } = {}) {
  if (auth && !S.access && S.refresh) await refresh();
  const h = { apikey: CFG.key, Accept: 'application/json' };
  if (auth && S.access) h.Authorization = 'Bearer ' + S.access;
  if (body !== undefined && body !== null) h['Content-Type'] = 'application/json';
  if (prefer) h.Prefer = prefer;
  const r = await fetch(CFG.url + path, { method, headers: h, body: body == null ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
  if (r.status === 401 && auth && !retried && await refresh()) return raw(method, path, body, { auth, prefer, retried: true });
  const t = await r.text();
  if (!r.ok) { const e = new Error(`HTTP ${r.status}`); e.status = r.status; e.body = t; throw e; }
  return t ? JSON.parse(t) : null;
}
let refreshing = null;
function refresh() {
  if (!S.refresh) return Promise.resolve(false);
  // One refresh at a time: Supabase refresh tokens are single-use.
  return refreshing ||= (async () => {
    try {
      const o = await raw('POST', '/auth/v1/token?grant_type=refresh_token', { refresh_token: S.refresh }, { auth: false });
      saveSession(o); return true;
    } catch (e) { if (e.status === 400 || e.status === 401) signOut(true); return false; }
    finally { refreshing = null; }
  })();
}
function saveSession(o) {
  S.access = o.access_token; S.refresh = o.refresh_token; S.uid = o.user.id;
  store.set('rt', S.refresh); store.set('uid', S.uid);
}
const sel = (table, q) => raw('GET', `/rest/v1/${table}?${q}`);
const rpc = (fn, args = {}) => raw('POST', `/rest/v1/rpc/${fn}`, args);
const inList = ids => `in.(${ids.join(',')})`;
const PROFILE_COLS = 'id,full_name,role,login_id,phone,coaching_id,must_change_pin';

// ---------- offline outbox (same rules as the APK's Outbox) ----------
// Class writes (attendance, ratings, marks, class logs) are kept in order and sent when the internet is back.
const outbox = {
  all: () => store.get('outbox') || [],
  mine: () => outbox.all().filter(i => i.uid === S.uid),
  save: list => store.set('outbox', list.slice(-2000)),
  add(item) { const l = outbox.all(); l.push({ ...item, uid: S.uid, at: Date.now() }); outbox.save(l); },
};
async function writeOrQueue(method, path, body, prefer = 'return=minimal') {
  if (outbox.mine().length) { await flushOutbox(); if (outbox.mine().length) { outbox.add({ method, path, body, prefer }); return false; } }
  try { await raw(method, path, body, { prefer }); return true; }
  catch (e) { if (!isOfflineErr(e)) throw e; outbox.add({ method, path, body, prefer }); return false; }
}
let flushing = false;
async function flushOutbox() {
  if (flushing || !S.uid) return 0;
  flushing = true; let sent = 0;
  try {
    for (const item of outbox.mine()) {
      try { await raw(item.method, item.path, item.body, { prefer: item.prefer }); }
      catch (e) {
        // keep when offline, signed out, rate-limited or server down; drop data the server will never accept
        if (isOfflineErr(e) || e.status === 401 || e.status === 408 || e.status === 429 || e.status >= 500) break;
        console.warn('outbox dropped', item.path, e.status);
      }
      outbox.save(outbox.all().filter(x => !(x.at === item.at && x.path === item.path && x.uid === item.uid)));
      sent++;
    }
  } finally { flushing = false; }
  return sent;
}
setInterval(() => { if (navigator.onLine && outbox.mine().length) flushOutbox().then(n => n && toast(`${bn(n)}টি জমা তথ্য পাঠানো হয়েছে`)); }, 15000);

// ---------- auth ----------
function creds(id, pin) { id = ascii(id).trim().toLowerCase(); return [`${id}@${CFG.slug}.diffedu.app`, `de-${pin}-${id}`]; }
async function signIn(id, pin) {
  const [email, password] = creds(id, pin);
  saveSession(await raw('POST', '/auth/v1/token?grant_type=password', { email, password }, { auth: false }));
  S.me = (await sel('profiles', `select=${PROFILE_COLS}&id=eq.${S.uid}`))[0];
  store.set('me', S.me);
}
async function changePin(newPin) {
  const [, password] = creds(S.me.login_id, newPin);
  try { await raw('PUT', '/auth/v1/user', { password }); }
  catch (e) { if (!(e.status === 422 && /same_password/.test(e.body || ''))) throw e; } // already saved on a retry
  for (let i = 0; i < 3; i++) {
    try { await rpc('pin_changed'); S.me.must_change_pin = false; store.set('me', S.me); return; }
    catch (e) { await new Promise(r => setTimeout(r, 800 * (i + 1))); }
  }
  throw new Error('flag');
}
function signOut(silent) {
  if (S.access) fetch(CFG.url + '/auth/v1/logout', { method: 'POST', headers: { apikey: CFG.key, Authorization: 'Bearer ' + S.access } }).catch(() => {});
  S.access = S.refresh = S.uid = S.me = null;
  ['rt', 'uid', 'me', 'kid'].forEach(store.del);
  // drop cached data of the previous user (the outbox stays: it is per user and sent on their next login)
  try { Object.keys(localStorage).filter(k => k.startsWith('de.c.')).forEach(k => localStorage.removeItem(k)); } catch {}
  if (!silent) toast('বের হয়েছেন');
  go('login');
}
const isStaff = () => S.me && (S.me.role === 'teacher' || S.me.role === 'admin');

// ---------- cached reads (last-seen copy when offline) ----------
let offlineFlag = false;
async function cached(key, fn) {
  try { const v = await fn(); store.set('c.' + key, v); return v; }
  catch (e) {
    const old = store.get('c.' + key);
    if (old && isOfflineErr(e)) { offlineFlag = true; return old; }
    throw e;
  }
}

// ---------- router ----------
// Each screen: { title, tab, back?, render(el, param) } — render fills el and binds its own events.
const SCREENS = {};
let TABS = [];          // [{ id, label }], set by the role module
const view = $('#view');
let route = 'login', param = null, renderSeq = 0;

function go(r, p = null) {
  route = r; param = p;
  const logged = r !== 'login';
  const sc = SCREENS[r];
  $('#bar').hidden = !logged; $('#tabs').hidden = !logged || !TABS.length;
  $('#title').textContent = sc?.title ? (typeof sc.title === 'function' ? sc.title(p) : sc.title) : 'ডিফ এডু';
  $('#back').hidden = !sc?.back;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === (sc?.tab || r)));
  history.replaceState(null, '', '#' + r + (p != null ? ':' + encodeURIComponent(p) : ''));
  window.scrollTo(0, 0);
  render();
}
function back() { const sc = SCREENS[route]; go(typeof sc?.back === 'function' ? sc.back(param) : (sc?.back || TABS[0]?.id || 'home')); }

async function render() {
  const seq = ++renderSeq;
  offlineFlag = false;
  if (route === 'login') return loginView();
  if (S.me?.must_change_pin) return pinView(true);
  const sc = SCREENS[route];
  if (!sc) return go(TABS[0]?.id || 'login');
  view.innerHTML = '<div class="skel"></div><div class="skel"></div><div class="skel"></div>';
  const el = document.createElement('div');
  try {
    await sc.render(el, param);
    if (seq !== renderSeq) return; // user navigated away while loading
    if (offlineFlag) el.insertAdjacentHTML('afterbegin', '<div class="offline">অফলাইন — শেষ দেখা তথ্য</div>');
    view.replaceChildren(el);
    el.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { const [r, p] = b.dataset.go.split(':'); go(r, p ?? null); }));
  } catch (e) {
    if (seq !== renderSeq) return;
    console.error(e);
    view.innerHTML = `<div class="card"><p>তথ্য আনা যায়নি${isOfflineErr(e) ? ' (ইন্টারনেট নেই?)' : ''}।</p><button class="primary" id="retry">আবার চেষ্টা</button></div>`;
    $('#retry').onclick = render;
  }
}

function setTabs(tabs) {
  TABS = tabs;
  $('#tabs').innerHTML = tabs.map(t => `<button data-tab="${t.id}">${t.label}</button>`).join('');
  $('#tabs').querySelectorAll('button').forEach(b => b.onclick = () => go(b.dataset.tab));
}
const loaded = {};
function loadScript(src) {
  return loaded[src] ||= new Promise((ok, fail) => {
    const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => { delete loaded[src]; fail(new Error('load ' + src)); };
    document.head.appendChild(s);
  });
}
async function enterApp(startRoute) {
  await loadScript(isStaff() ? 'teacher.js' : 'family.js');
  const [r, p] = (startRoute || '').split(':');
  go(SCREENS[r] ? r : TABS[0].id, p ? decodeURIComponent(p) : null);
}

// ---------- login & PIN ----------
function loginView() {
  view.innerHTML = `<div class="login"><img class="logo" src="icon.svg" alt=""><h1>ডিফ এডু</h1><div class="mute">লগইন আইডি ও পিন দিন</div>
    <form id="f" autocomplete="on"><label for="id">লগইন আইডি (মোবাইল নম্বর বা রোল)</label><input id="id" name="username" inputmode="text" autocomplete="username" required>
    <label for="pin">পিন</label><input id="pin" name="password" type="password" inputmode="numeric" autocomplete="current-password" required>
    <div class="err" id="err"></div><button class="primary" id="go">ঢুকুন</button></form>
    ${isAndroid ? `<p class="mute" style="margin-top:20px">অ্যান্ড্রয়েড ফোনে অ্যাপটি ভালো চলে — <a href="${APK_URL}" download>অ্যাপ ডাউনলোড করুন</a></p>` : ''}</div>`;
  $('#f').onsubmit = async ev => {
    ev.preventDefault();
    const b = $('#go'); b.disabled = true; b.textContent = 'অপেক্ষা করুন…'; $('#err').textContent = '';
    try {
      await signIn($('#id').value, ascii($('#pin').value));
      await enterApp();
    } catch (e) {
      $('#err').textContent = e.status === 400 ? 'আইডি বা পিন ঠিক নয়।' : 'ইন্টারনেট সংযোগ দেখুন।';
      b.disabled = false; b.textContent = 'ঢুকুন';
    }
  };
}

function pinView(forced) {
  $('#tabs').hidden = !!forced || !TABS.length; $('#back').hidden = !!forced;
  if (forced) $('#title').textContent = 'নতুন পিন';
  view.innerHTML = `<div class="login"><h1>${forced ? 'নতুন পিন দিন' : 'পিন বদলান'}</h1><div class="mute">পরের বার থেকে এই পিন দিয়ে লগইন করবেন।</div>
    <form id="pf"><label for="np">নতুন পিন (৪–৬ সংখ্যা)</label><input id="np" type="password" inputmode="numeric" autocomplete="new-password" maxlength="6" required>
    <label for="np2">আবার লিখুন</label><input id="np2" type="password" inputmode="numeric" autocomplete="new-password" maxlength="6" required>
    <div class="err" id="perr"></div><button class="primary" id="pgo">পিন সংরক্ষণ করুন</button></form></div>`;
  $('#pf').onsubmit = async ev => {
    ev.preventDefault();
    const a = ascii($('#np').value), b = ascii($('#np2').value), err = $('#perr');
    if (!/^\d{4,6}$/.test(a)) { err.textContent = 'পিন ৪ থেকে ৬ সংখ্যার হতে হবে।'; return; }
    if (a !== b) { err.textContent = 'দুই জায়গায় পিন মেলেনি।'; return; }
    if (a === '1234' || a === '2580') { err.textContent = 'এটা সহজ পিন। অন্য পিন বাছুন।'; return; }
    const btn = $('#pgo'); btn.disabled = true; btn.textContent = 'সংরক্ষণ হচ্ছে…'; err.textContent = '';
    try { await changePin(a); toast('নতুন পিন সংরক্ষিত ✓'); go(TABS[0]?.id || 'home'); }
    catch (e) {
      err.textContent = e.message === 'flag' ? 'নতুন পিন চালু হয়েছে, তবে পুরোপুরি জমা হয়নি। আবার একই পিন দিয়ে সংরক্ষণ চাপুন।' : 'সংরক্ষণ করা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।';
      btn.disabled = false; btn.textContent = 'পিন সংরক্ষণ করুন';
    }
  };
}
SCREENS.pin = { title: 'পিন বদলান', tab: 'more', back: 'more', render: async () => { setTimeout(() => pinView(false)); } };

// ---------- boot ----------
$('#back').onclick = back;
$('#logout').onclick = () => {
  const n = outbox.mine().length;
  if (n && !confirm(`${bn(n)}টি তথ্য এখনো সার্ভারে যায়নি। আবার এই আইডিতে লগইন না করা পর্যন্ত পাঠানো হবে না। তবুও বের হবেন?`)) return;
  signOut();
};
window.addEventListener('online', () => { if (route !== 'login') { flushOutbox(); render(); } });

(async function boot() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (S.refresh) {
    S.me = store.get('me');
    if (!S.me || !S.me.coaching_id) {
      try { await refresh(); S.me = (await sel('profiles', `select=${PROFILE_COLS}&id=eq.${S.uid}`))[0]; store.set('me', S.me); } catch {}
    }
  }
  if (S.me) { try { await enterApp(location.hash.slice(1)); } catch { view.innerHTML = '<div class="card">অ্যাপ খোলা যায়নি। ইন্টারনেট দেখে আবার খুলুন।</div>'; } }
  else go('login');
})();

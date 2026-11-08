'use strict';
// Diff Edu PWA — core: config, Supabase client, offline outbox, stack navigation, shared UI kit,
// welcome/login/admission/PIN/consent. Role screens: family.js (guardian/student), teacher.js (teacher/admin),
// loaded after login. Same Supabase backend and the same look, order and Bangla copy as the APK.
const CFG = {
  url: 'https://uwbyxwxfhrffrrqvheft.supabase.co',
  key: 'sb_publishable_fXPLUYRqvrz9d6i9xL2IAQ_tmtZ194t', // publishable key: safe to ship, RLS protects data
  slug: 'diff-edu',
};
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const bn = n => String(n ?? '').replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
const ascii = s => String(s ?? '').replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d));
const MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
const DAYS = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
const fmtDate = d => { if (!d) return ''; const x = new Date(String(d).length === 10 ? d + 'T00:00:00' : d); return `${bn(x.getDate())} ${MONTHS[x.getMonth()]}`; };
const fmtDateY = d => { if (!d) return ''; const x = new Date(String(d).length === 10 ? d + 'T00:00:00' : d); return `${bn(x.getDate())} ${MONTHS[x.getMonth()]} ${bn(x.getFullYear())}`; };
const fmtTime = t => {
  if (!t) return '';
  const [h, m] = new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Dhaka' }).split(':').map(Number);
  const part = h < 12 ? 'সকাল' : h < 16 ? 'দুপুর' : h < 18 ? 'বিকেল' : 'রাত';
  return `${part} ${bn(h % 12 || 12)}:${bn(String(m).padStart(2, '0'))}`;
};
const taka = n => '৳' + bn(Math.round(+n || 0).toLocaleString('en-IN'));
const num = v => { const x = +v; return bn(Number.isInteger(x) ? x : x.toFixed(1)); };
const dhakaToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
const daysAgo = n => { const d = new Date(dhakaToday() + 'T00:00:00'); d.setDate(d.getDate() - n); return d.toLocaleDateString('en-CA'); };
const monthStart = () => dhakaToday().slice(0, 7) + '-01';
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600); };
const SHIFTS = [
  { id: 'morning', bn: 'সকাল', time: '৭:০০ – ৯:০০', icon: 'sunrise' },
  { id: 'afternoon', bn: 'বিকেল', time: '৩:০০ – ৫:০০', icon: 'sun' },
  { id: 'night', bn: 'রাত', time: '৭:০০ – ৯:০০', icon: 'moon' },
];
const shiftBn = id => SHIFTS.find(s => s.id === id)?.bn || '';

// ---------- storage (try/catch: private windows may block it) ----------
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem('de.' + k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('de.' + k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem('de.' + k); } catch {} },
};
if (store.get('big')) document.body.classList.add('big');

// ---------- UI kit (mirrors ui/components/*.kt) ----------
const I = name => (typeof ICONS !== 'undefined' && (ICONS[name] || ICONS.ai_spark)) || '';
const chip = (icon, size = 44) => `<span class="ichip ${size === 40 ? 's40' : size === 42 ? 's42' : ''}">${I(icon)}</span>`;
const goAttr = go => go ? ` data-go="${esc(go)}"` : '';
const fun = (icon, title, go, { sub, tint = 'white', badge } = {}) =>
  `<button class="fun t-${tint}"${goAttr(go)}>${chip(icon)}<b>${esc(title)}</b>${sub ? `<span class="small">${esc(sub)}</span>` : ''}${badge ? `<span class="pill white badge">${esc(badge)}</span>` : ''}</button>`;
const compact = (icon, title, go, badge) => `<button class="compact"${goAttr(go)}>${chip(icon, 40)}<b>${esc(title)}</b>${badge ? `<span class="small mute">${esc(badge)}</span>` : ''}</button>`;
const action = (icon, title, hint, go) => `<button class="action"${goAttr(go)}>${chip(icon, 42)}<div><b>${esc(title)}</b><span>${esc(hint)}</span></div></button>`;
const grid2 = tiles => `<div class="grid2">${tiles.join('')}</div>`;
const grid3 = tiles => `<div class="grid3">${tiles.join('')}</div>`;
const empty = (icon, text) => `<div class="empty"><div class="circ">${I(icon)}</div><div>${text}</div></div>`;
const pill = (t, cls = '') => `<span class="pill ${cls}">${esc(t)}</span>`;
const section = t => `<div class="section">${esc(t)}</div>`;
const bar = (frac, color) => `<div class="bar"${color ? ` style="--c:${color}"` : ''}><i style="width:${Math.max(0, Math.min(1, frac)) * 100}%"></i></div>`;
const skel = (n = 3) => '<div class="skel"></div>'.repeat(n);
const avatar = name => `<span class="av">${esc((name || '?').trim().charAt(0))}</span>`;
const chipRow = (items, cur, attr = 'data-chip') => `<div class="chips">${items.map(([v, l]) => `<button class="chip-btn ${String(v) === String(cur) ? 'on' : ''}" ${attr}="${esc(v ?? '')}">${esc(l)}</button>`).join('')}</div>`;
const scoreClass = t => t >= 8 ? 'g' : t >= 5 ? 'm' : 'b';
function sheet(html, onOpen) {
  const d = document.createElement('div');
  d.className = 'sheet-bg';
  d.innerHTML = `<div class="sheet" role="dialog">${html}</div>`;
  document.body.appendChild(d);
  const close = () => d.remove();
  d.onclick = e => { if (e.target === d) close(); };
  d.querySelectorAll('[data-close]').forEach(b => b.onclick = close);
  onOpen?.(d.firstChild, close);
  return close;
}
function confirmSheet(title, text, okLabel = 'হ্যাঁ', danger = false) {
  return new Promise(res => {
    sheet(`<h2>${esc(title)}</h2><div class="mute">${text}</div><button class="btn ${danger ? 'coral' : ''}" id="cok">${esc(okLabel)}</button><button class="link" data-close>বাতিল</button>`, (el, close) => {
      el.querySelector('#cok').onclick = () => { close(); res(true); };
      el.parentNode.addEventListener('click', e => { if (e.target === el.parentNode || e.target.hasAttribute('data-close')) res(false); });
    });
  });
}

// ---------- APK nudge (Android only: iPhone can't install an APK) ----------
const APK_URL = CFG.url + '/storage/v1/object/public/app-updates/DiffEdu.apk';
const isAndroid = /Android/i.test(navigator.userAgent);
let apkSize = null;
if (isAndroid) fetch(CFG.url + '/storage/v1/object/public/app-updates/version.json', { cache: 'no-store' })
  .then(r => r.json()).then(v => { apkSize = v.size; }).catch(() => {});
const sizeText = () => apkSize ? ` (${bn((apkSize / 1048576).toFixed(1))} MB)` : '';
const apkBanner = () => isAndroid
  ? `<div class="card apk"><h3>অ্যান্ড্রয়েড অ্যাপটি নিন</h3><div class="mute">ছোট অ্যাপ, দ্রুত চলে, নেট ছাড়াও কাজ করে, নোটিফিকেশন আসে।</div><a class="btn" style="margin-top:10px" href="${APK_URL}" download>অ্যাপ ডাউনলোড${sizeText()}</a></div>` : '';
function apkPopup() {
  if (!isAndroid || document.querySelector('.sheet')) return;
  if (Date.now() - (store.get('apkAsked') || 0) < 3 * 864e5) return; // at most once every 3 days
  store.set('apkAsked', Date.now());
  sheet(`<h2>অ্যান্ড্রয়েড অ্যাপ ব্যবহার করুন</h2>
    <div class="mute">একই আইডি ও পিন দিয়ে ঢুকবেন। অ্যাপে নোটিফিকেশন সাথে সাথে আসে, নেট ছাড়াও হাজিরা নেওয়া যায়, আর চলেও দ্রুত।</div>
    <a class="btn" href="${APK_URL}" download>অ্যাপ ডাউনলোড${sizeText()}</a>
    <div class="mute small">ডাউনলোডের পর ফাইলটি খুলুন। "অজানা উৎস" জিজ্ঞেস করলে অনুমতি দিন।</div>
    <button class="link" data-close>এখন না, ওয়েবেই চালাই</button>`);
}

// ---------- Supabase ----------
const S = { access: null, refresh: store.get('rt'), uid: store.get('uid'), me: null };
const isOfflineErr = e => !e.status; // fetch threw: no internet / DNS / timeout

async function raw(method, path, body, { auth = true, prefer, retried, headers } = {}) {
  if (auth && !S.access && S.refresh) await refresh();
  const h = { apikey: CFG.key, Accept: 'application/json', ...(headers || {}) };
  if (auth && S.access) h.Authorization = 'Bearer ' + S.access;
  if (body != null && !(body instanceof Blob)) h['Content-Type'] = 'application/json';
  if (prefer) h.Prefer = prefer;
  const r = await fetch(CFG.url + path, { method, headers: h, body: body == null ? undefined : (body instanceof Blob || typeof body === 'string' ? body : JSON.stringify(body)) });
  if (r.status === 401 && auth && !retried && await refresh()) return raw(method, path, body, { auth, prefer, retried: true, headers });
  const t = await r.text();
  if (!r.ok) { const e = new Error(`HTTP ${r.status}`); e.status = r.status; e.body = t; throw e; }
  try { return t ? JSON.parse(t) : null; } catch { return t; }
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
const ins = (table, row, q = '') => raw('POST', `/rest/v1/${table}${q ? '?' + q : ''}`, row, { prefer: 'return=representation' });
const upsert = (table, row, onConflict) => raw('POST', `/rest/v1/${table}?on_conflict=${onConflict}`, row, { prefer: 'return=representation,resolution=merge-duplicates' });
const upd = (table, filter, patch) => raw('PATCH', `/rest/v1/${table}?${filter}`, patch, { prefer: 'return=representation' });
const del = (table, filter) => { if (!filter) throw new Error('delete without filter'); return raw('DELETE', `/rest/v1/${table}?${filter}`, null, { prefer: 'return=minimal' }); };
const rpc = (fn, args = {}) => raw('POST', `/rest/v1/rpc/${fn}`, args);
const fn = (name, body) => raw('POST', `/functions/v1/${name}`, body);
const inList = ids => `in.(${ids.join(',')})`;
const enc = encodeURIComponent;
async function signedUrl(bucket, path, seconds = 600) {
  const o = await raw('POST', `/storage/v1/object/sign/${bucket}/${path}`, { expiresIn: seconds });
  const s = o.signedURL || o.signedUrl;
  return CFG.url + '/storage/v1' + (s.startsWith('/') ? s : '/' + s);
}
const upload = (bucket, path, blob, type) => raw('POST', `/storage/v1/object/${bucket}/${path}`, blob, { headers: { 'Content-Type': type } });
const PROFILE_COLS = 'id,full_name,role,login_id,phone,coaching_id,must_change_pin';

// ---------- offline outbox (same rules as the APK's Outbox) ----------
const outbox = {
  all: () => store.get('outbox') || [],
  mine: () => outbox.all().filter(i => i.uid === S.uid),
  save: list => store.set('outbox', list.slice(-2000)),
  add(item) { const l = outbox.all(); l.push({ ...item, uid: S.uid, at: Date.now() + Math.random() }); outbox.save(l); },
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
      outbox.save(outbox.all().filter(x => x.at !== item.at));
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
  ['rt', 'uid', 'me', 'kid', 'consent'].forEach(store.del);
  try { Object.keys(localStorage).filter(k => k.startsWith('de.c.')).forEach(k => localStorage.removeItem(k)); } catch {}
  if (!silent) toast('বের হয়েছেন');
  location.hash = ''; stack.length = 0; nav.reset('welcome');
}
const isStaff = () => S.me && (S.me.role === 'teacher' || S.me.role === 'admin');
const isAdmin = () => S.me?.role === 'admin';
function confirmLogout() {
  const n = outbox.mine().length;
  if (n) return confirmSheet('লগআউট', `${bn(n)}টি তথ্য এখনো সার্ভারে যায়নি। লগআউট করলেও ফোনে থেকে যাবে, কিন্তু আবার এই আইডিতে লগইন না করা পর্যন্ত পাঠানো হবে না। আগে ইন্টারনেট চালু করে "এখন পাঠান" চাপাই ভালো।`, 'তবুও লগআউট', true).then(ok => ok && signOut());
  signOut();
}

// ---------- cached reads (last-seen copy when offline) ----------
let offlineFlag = false;
async function cached(key, loader) {
  try { const v = await loader(); store.set('c.' + key, v); return v; }
  catch (e) {
    const old = store.get('c.' + key);
    if (old && isOfflineErr(e)) { offlineFlag = true; return old; }
    throw e;
  }
}
async function coachingId() { return S.me?.coaching_id; }

// ---------- navigation (stack, like the APK's Nav) ----------
// Screen: { title, sub?, hdr?, dark?, trail?(param) -> html, home?: true, render(el, param) }
const SCREENS = {};
const view = $('#view');
const stack = [];           // [{ r, p }]
let renderSeq = 0;
const cur = () => stack[stack.length - 1] || { r: 'welcome', p: null };
const nav = {
  go(r, p = null) { stack.push({ r, p }); show(); },
  replace(r, p = null) { stack.pop(); stack.push({ r, p }); show(); },
  back() { if (stack.length > 1) { stack.pop(); show(-1); } else if (S.me) nav.reset(homeRoute()); },
  reset(r, p = null) { stack.length = 0; stack.push({ r, p }); show(); },
};
const go = (r, p) => nav.go(r, p);
const homeRoute = () => !S.me ? 'welcome' : isStaff() ? 't.home' : S.me.role === 'student' ? 's.home' : 'g.home';
function saveStack() { try { sessionStorage.setItem('de.stack', JSON.stringify(stack)); } catch {} }

function show(dir = 1) {
  const { r, p } = cur();
  const sc = SCREENS[r];
  if (!sc) { nav.reset(homeRoute()); return; }
  const v = x => typeof x === 'function' ? x(p) : x;
  document.body.classList.toggle('dark-bg', !!sc.dark);
  $('#bar').hidden = !!sc.dark;
  $('#bar').style.setProperty('--hdr', v(sc.hdr) || (store.get('hdr') && !isStaff() ? store.get('hdr') : 'var(--teal)'));
  $('#title').textContent = v(sc.title) || 'ডিফ এডু';
  const sub = v(sc.sub); $('#sub').textContent = sub || ''; $('#sub').hidden = !sub;
  $('#back').hidden = !!sc.home || stack.length <= 1;
  $('#trail').innerHTML = sc.trail ? sc.trail(p) : '';
  $('#trail').querySelectorAll('[data-logout]').forEach(b => b.onclick = confirmLogout);
  $('#trail').querySelectorAll('[data-go]').forEach(bindGo);
  saveStack();
  if (dir >= 0) window.scrollTo(0, 0);
  render();
}
function bindGo(b) { b.addEventListener('click', () => { const s = b.dataset.go; const i = s.indexOf(':'); i < 0 ? go(s) : go(s.slice(0, i), s.slice(i + 1)); }); }
// Sub-title computed after loading (e.g. the child's name)
function setSub(t) { $('#sub').textContent = t || ''; $('#sub').hidden = !t; }
function setTitle(t) { $('#title').textContent = t; }

async function render() {
  const seq = ++renderSeq;
  offlineFlag = false;
  const { r, p } = cur();
  const sc = SCREENS[r];
  if (S.me?.must_change_pin && !sc.dark && r !== 'pin') return nav.reset('pin', 'forced');
  view.innerHTML = skel(3);
  const el = document.createElement('div');
  el.className = 'screen';
  el.style.cssText = 'display:flex;flex-direction:column;gap:12px';
  try {
    await sc.render(el, p);
    if (seq !== renderSeq) return; // user navigated away while loading
    if (offlineFlag) el.insertAdjacentHTML('afterbegin', '<div class="offline">অফলাইন — শেষ দেখা তথ্য</div>');
    view.replaceChildren(el);
    el.querySelectorAll('[data-go]').forEach(bindGo);
    sc.after?.(el, p);
  } catch (e) {
    if (seq !== renderSeq) return;
    console.error(e);
    view.innerHTML = `<div class="card">${empty('wifi_off', `তথ্য আনা যায়নি${isOfflineErr(e) ? ' (ইন্টারনেট নেই?)' : ''}।`)}<button class="btn" id="retry">আবার চেষ্টা করুন</button></div>`;
    $('#retry').onclick = render;
  }
}
const rerender = () => render();

const loaded = {};
function loadScript(src) {
  return loaded[src] ||= new Promise((ok, fail) => {
    const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => { delete loaded[src]; fail(new Error('load ' + src)); };
    document.head.appendChild(s);
  });
}
async function enterApp(restore) {
  await loadScript(isStaff() ? 'teacher.js' : 'family.js');
  if (S.me.role === 'guardian' && !store.get('consent')) {
    // Guardians confirm consent once before using the app (same as the APK).
    try {
      const c = await sel('consents', `select=profile_id&profile_id=eq.${S.uid}&app_terms=is.true&limit=1`);
      if (c.length) store.set('consent', true); else return nav.reset('consent');
    } catch { /* table missing or offline: don't block */ }
  }
  if (restore?.length && SCREENS[restore[restore.length - 1].r]) { stack.length = 0; restore.forEach(x => stack.push(x)); show(); }
  else nav.reset(homeRoute());
}

// ---------- welcome / login / admission / pin ----------
const back44 = `<button class="dback" data-back aria-label="ফিরে যান">${'<svg viewBox="0 0 24 24"><path d="M15 5L8 12L15 19" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'}</button>`;
SCREENS.welcome = { dark: true, home: true, render: async (el) => {
  el.innerHTML = `<div class="welcome"><div class="rule"></div>
    <img class="wlogo" src="logo.svg" alt="ডিফ এডু">
    <div class="wordmark">Different Academic<br>&amp; Exam Care</div><div class="since">SINCE 2008</div>
    <div class="tag">Every child is Different.</div>
    <div class="grid2 roles">
      ${roleTile('role_guardian', 'অভিভাবক', 'Guardian', 'login:guardian')}${roleTile('role_student', 'শিক্ষার্থী', 'Student', 'login:student')}
      ${roleTile('role_teacher', 'শিক্ষক ও অ্যাডমিন', 'Teacher / Admin', 'login:teacher')}${roleTile('role_admission', 'ভর্তি তথ্য', 'Admission', 'admission')}
    </div>
    ${isAndroid ? `<a class="apklink" href="${APK_URL}" download>অ্যান্ড্রয়েড অ্যাপ ডাউনলোড করুন</a>` : ''}<div class="rule"></div></div>`;
} };
const roleTile = (icon, t, c, go) => `<button class="rtile" data-go="${go}"><span class="ring">${I(icon)}</span><b>${t}</b><span>${c}</span></button>`;

SCREENS.login = { dark: true, render: async (el, role) => {
  const heading = { guardian: 'অভিভাবক লগইন', student: 'শিক্ষার্থী লগইন', teacher: 'শিক্ষক ও অ্যাডমিন লগইন' }[role] || 'লগইন';
  el.innerHTML = `<div class="dlogin">${back44}<div class="rule"></div>
    <img class="llogo" src="logo.svg" alt=""><h1>${heading}</h1><div class="lsub">কোচিং থেকে দেওয়া আইডি ও পিন দিন</div>
    <form id="f" autocomplete="on">
      <div class="dfield"><span>${I('field_id') || ''}</span><input id="id" name="username" placeholder="আইডি" autocomplete="username" required></div>
      <div class="dfield"><span>${I('lock')}</span><input id="pin" name="password" type="password" inputmode="numeric" maxlength="6" placeholder="পিন (৪–৬ সংখ্যা)" autocomplete="current-password" required><button type="button" id="eye" aria-label="পিন দেখুন">${I('eye')}</button></div>
      <div class="err center" id="err"></div>
      <button class="dbtn" id="go" disabled>লগইন করুন</button>
    </form>
    <div class="lsub">পিন ভুলে গেলে কোচিং অফিসে যোগাযোগ করুন।</div></div>`;
  const idI = el.querySelector('#id'), pinI = el.querySelector('#pin'), b = el.querySelector('#go');
  const can = () => { b.disabled = !(idI.value.trim() && /^\d{4,6}$/.test(ascii(pinI.value))); };
  idI.oninput = pinI.oninput = () => { pinI.value = ascii(pinI.value).replace(/\D/g, '').slice(0, 6); el.querySelector('#err').textContent = ''; can(); };
  el.querySelector('#eye').onclick = () => { pinI.type = pinI.type === 'password' ? 'text' : 'password'; el.querySelector('#eye').innerHTML = I(pinI.type === 'password' ? 'eye' : 'eye_off'); };
  el.querySelector('[data-back]').onclick = () => nav.back();
  el.querySelector('#f').onsubmit = async ev => {
    ev.preventDefault(); if (b.disabled) return;
    b.disabled = true; b.textContent = 'অপেক্ষা করুন…';
    try { await signIn(idI.value, ascii(pinI.value)); await enterApp(); }
    catch (e) { el.querySelector('#err').textContent = e.status === 400 ? 'আইডি অথবা পিন সঠিক নয়। আবার চেষ্টা করুন।' : 'ইন্টারনেট সংযোগ দেখুন।'; b.textContent = 'লগইন করুন'; can(); }
  };
} };

SCREENS.admission = { title: 'ভর্তি তথ্য', sub: 'Diff Edu · কুষ্টিয়া', render: async (el) => {
  el.innerHTML = `<div class="card"><h2>আমাদের সম্পর্কে</h2><div class="mute">শ্রেণি ১–৮ এর শিক্ষার্থীদের জন্য যত্নশীল পাঠদান, নিয়মিত পরীক্ষা ও অভিভাবকের সাথে প্রতিদিনের যোগাযোগ।</div>
      <div class="row"><span>শিফট</span><b>সকাল · বিকেল · রাত</b></div><div class="row"><span>অফিস</span><a href="tel:01711678818">${bn('01711-678818')}</a></div></div>
    <div class="card"><h2>ভর্তির আগ্রহ জানান</h2><div class="mute">ফর্ম পূরণ করলে অফিস থেকে আপনাকে ফোন করা হবে।</div>
      <form id="af"><label>শিক্ষার্থীর নাম</label><input id="an" required maxlength="80">
      <label>শ্রেণি</label><select id="ac">${[1, 2, 3, 4, 5, 6, 7, 8].map(c => `<option value="${c}">শ্রেণি ${bn(c)}</option>`).join('')}</select>
      <label>অভিভাবকের মোবাইল নম্বর</label><input id="ap" inputmode="tel" required maxlength="14" placeholder="01XXXXXXXXX">
      <label>বার্তা (ঐচ্ছিক)</label><textarea id="am" maxlength="500"></textarea>
      <div class="err" id="aerr"></div><button class="btn" id="asend">পাঠান</button></form></div>`;
  el.querySelector('#af').onsubmit = async ev => {
    ev.preventDefault();
    const phone = ascii(el.querySelector('#ap').value).replace(/\D/g, '').replace(/^880/, '0');
    if (!/^01\d{9}$/.test(phone)) { el.querySelector('#aerr').textContent = 'সঠিক মোবাইল নম্বর দিন (০১ দিয়ে শুরু, ১১ সংখ্যা)।'; return; }
    const b = el.querySelector('#asend'); b.disabled = true; b.textContent = 'পাঠানো হচ্ছে…';
    try {
      await raw('POST', '/rest/v1/rpc/submit_admission_inquiry', { p_slug: CFG.slug, p_student_name: el.querySelector('#an').value.trim(), p_class_level: +el.querySelector('#ac').value, p_phone: phone, p_message: el.querySelector('#am').value.trim() || null }, { auth: false });
      el.innerHTML = `<div class="card good">${empty('party', 'ধন্যবাদ! আপনার তথ্য পাওয়া গেছে। অফিস থেকে শীঘ্রই ফোন করা হবে।')}</div>`;
    } catch (e) {
      el.querySelector('#aerr').textContent = e.status === 400 || /limit|too many/i.test(e.body || '') ? 'আজ এই নম্বর থেকে অনেকবার পাঠানো হয়েছে। পরে চেষ্টা করুন বা অফিসে ফোন করুন।' : 'পাঠানো যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।';
      b.disabled = false; b.textContent = 'পাঠান';
    }
  };
} };

SCREENS.pin = { title: p => p === 'forced' ? 'নতুন পিন' : 'পিন বদলান', home: p => p === 'forced', render: async (el, mode) => {
  const forced = mode === 'forced';
  el.innerHTML = `<div class="card"><h2>${forced ? 'নিজের পিন ঠিক করুন' : 'পিন বদলান'}</h2>
    <div class="mute">${forced ? 'নিরাপত্তার জন্য প্রথমবার নিজের একটি নতুন পিন দিন। পরের বার থেকে এই পিন দিয়ে লগইন করবেন।' : 'নতুন পিন দিন। পরের বার থেকে এই পিন দিয়ে লগইন করবেন।'}</div>
    <form id="pf"><label>নতুন পিন (৪–৬ সংখ্যা)</label><input id="np" type="password" inputmode="numeric" autocomplete="new-password" maxlength="6" required>
    <label>আবার লিখুন</label><input id="np2" type="password" inputmode="numeric" autocomplete="new-password" maxlength="6" required>
    <div class="err" id="perr"></div><button class="btn" id="pgo">পিন সংরক্ষণ করুন</button></form></div>
    ${forced ? '<button class="btn ghost" data-logout>লগআউট</button>' : ''}`;
  el.querySelectorAll('[data-logout]').forEach(b => b.onclick = () => signOut());
  el.querySelector('#pf').onsubmit = async ev => {
    ev.preventDefault();
    const a = ascii(el.querySelector('#np').value), b2 = ascii(el.querySelector('#np2').value), err = el.querySelector('#perr');
    if (!/^\d{4,6}$/.test(a)) { err.textContent = 'পিন ৪ থেকে ৬ সংখ্যার হতে হবে।'; return; }
    if (a !== b2) { err.textContent = 'দুই জায়গায় পিন মেলেনি।'; return; }
    if (a === '1234' || a === '2580') { err.textContent = 'এটা সহজ পিন। অন্য পিন বাছুন।'; return; }
    const btn = el.querySelector('#pgo'); btn.disabled = true; btn.textContent = 'সংরক্ষণ হচ্ছে…'; err.textContent = '';
    try { await changePin(a); toast('নতুন পিন সংরক্ষিত হয়েছে ✓'); nav.reset(homeRoute()); }
    catch (e) {
      err.textContent = e.message === 'flag' ? 'নতুন পিন চালু হয়ে গেছে, তবে সার্ভারে পুরোপুরি জমা হয়নি। আবার একই নতুন পিন দিয়ে সংরক্ষণ চাপুন।' : 'সংরক্ষণ করা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।';
      btn.disabled = false; btn.textContent = 'পিন সংরক্ষণ করুন';
    }
  };
} };

SCREENS.consent = { title: 'সম্মতি', home: true, render: async (el) => {
  el.innerHTML = `<div class="card"><h2>আপনার সন্তানের তথ্য</h2><div class="mute">ডিফ এডু আপনার সন্তানের নাম, শ্রেণি, উপস্থিতি, পরীক্ষার ফল, ফি ও শিক্ষকের মন্তব্য সংরক্ষণ করে, যাতে আপনি ও শিক্ষক একসাথে অগ্রগতি দেখতে পারেন। কোনো বিজ্ঞাপন বা ট্র্যাকিং নেই। AI-এর কিছু ফিচারে Google Gemini ব্যবহার হয়। যেকোনো সময় "আমার তথ্য ও গোপনীয়তা" থেকে তথ্য মুছে ফেলার অনুরোধ করতে পারবেন।</div></div>
    <button class="btn" id="agree">আমি সম্মতি দিচ্ছি</button><button class="btn ghost" data-logout>লগআউট</button>`;
  el.querySelectorAll('[data-logout]').forEach(b => b.onclick = () => signOut());
  el.querySelector('#agree').onclick = async () => {
    try { await upsert('consents', { profile_id: S.uid, coaching_id: S.me.coaching_id, app_terms: true, updated_at: new Date().toISOString() }, 'profile_id'); } catch (e) { console.warn(e); }
    store.set('consent', true); nav.reset(homeRoute());
  };
} };

// ---------- boot ----------
$('#back').onclick = () => nav.back();
window.addEventListener('online', () => { if (S.me) { flushOutbox(); render(); } });
window.addEventListener('popstate', () => {});

(async function boot() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (S.refresh) {
    S.me = store.get('me');
    if (!S.me || !S.me.coaching_id) {
      try { await refresh(); S.me = (await sel('profiles', `select=${PROFILE_COLS}&id=eq.${S.uid}`))[0]; store.set('me', S.me); } catch {}
    }
  }
  let restore = null; try { restore = JSON.parse(sessionStorage.getItem('de.stack')); } catch {}
  if (S.me) { try { await enterApp(restore); } catch (e) { console.error(e); view.innerHTML = '<div class="card">অ্যাপ খোলা যায়নি। ইন্টারনেট দেখে আবার খুলুন।</div>'; } }
  else nav.reset('welcome');
})();

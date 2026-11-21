'use strict';
// Diff Edu /next/: login, role-based tabs (empty for now), token refresh, offline queue.
// Own keys only: auth 'diffedu-next-auth', outbox 'de.next.outbox'. Never reads or writes the old app's
// 'de.rt' (refresh token) or 'de.outbox', so the two apps cannot log each other out or send each other's queue.
// No lock is needed: this app has its own refresh token. Two tabs of /next/ are handled in doRefresh().
const CFG = {
  url: 'https://uwbyxwxfhrffrrqvheft.supabase.co',
  key: 'sb_publishable_fXPLUYRqvrz9d6i9xL2IAQ_tmtZ194t', // publishable key: safe to ship, RLS protects data
  slug: 'diff-edu',
};
const AUTH_KEY = 'diffedu-next-auth';
const OUTBOX_KEY = 'de.next.outbox';
const ME_COLS = 'id,full_name,role,coaching_id';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const bn = n => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
const ascii = s => String(s ?? '').replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d));
const DAYS = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
const MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
// Dhaka calendar date, in Bangla digits: "শুক্রবার, ২১ নভেম্বর ২০২৬"
function dhakaDate() {
  const [y, m, d] = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' }).split('-').map(Number);
  return `${DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${bn(d)} ${MONTHS[m - 1]} ${bn(y)}`;
}

// Icons: 24px stroke icons, drawn inline so the page needs no extra file.
const PATHS = {
  home: '<path d="M3 11l9-8 9 8v8a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
  file: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5c0-1 1-1.5 2.5-1.5s2.5.6 2.5 1.5-1 1.5-2.5 1.5-2.5.6-2.5 1.5 1 1.5 2.5 1.5 2.5-.5 2.5-1.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
  wifi: '<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1"/>',
  wifiOff: '<path d="M3 3l18 18M2 9a15 15 0 0 1 5-3M22 9a15 15 0 0 0-3-2M5 12.5a10 10 0 0 1 4-2.5M19 12.5a10 10 0 0 0-2-1.4M8.5 16a5 5 0 0 1 3-1.5M12 19.5h0"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h0"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
};
const svg = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[n]}</svg>`;

// Tabs per role. Role group -> [tab id, label, icon]. Roles not listed get no tabs.
const ROLE_GROUP = { guardian: 'family', student: 'family', teacher: 'staff', admin: 'admin' };
const TABS = {
  family: [['today', 'আজ', 'home'], ['report', 'রিপোর্ট', 'file'], ['notice', 'নোটিশ', 'bell'], ['me', 'আমি', 'user']],
  staff: [['attend', 'হাজিরা', 'check'], ['report', 'রিপোর্ট', 'file'], ['notice', 'নোটিশ', 'bell'], ['me', 'আমি', 'user']],
  admin: [['today', 'আজ', 'home'], ['attend', 'হাজিরা', 'check'], ['fee', 'ফি', 'coin'], ['me', 'আমি', 'user']],
};
const ROLE_LABEL = { guardian: 'অভিভাবক', student: 'শিক্ষার্থী', teacher: 'শিক্ষক', admin: 'অ্যাডমিন' };
// Empty-state copy: [title, what appears here, icon]
const EMPTY = {
  today: ['আজকের কিছু নেই', 'আজকের হাজিরা ও খবর এখানে আসবে।', 'home'],
  attend: ['আজকের হাজিরা খালি', 'ক্লাস বেছে নিলে হাজিরা নেওয়া যাবে।', 'check'],
  report: ['এখনো রিপোর্ট কার্ড নেই', 'প্রকাশিত রিপোর্ট কার্ড এখানে দেখা যাবে।', 'file'],
  notice: ['এখনো কোনো নোটিশ নেই', 'কোচিংয়ের নোটিশ এখানে আসবে।', 'bell'],
  fee: ['ফি-র তালিকা খালি', 'মাসের ফি তৈরি হলে এখানে দেখা যাবে।', 'coin'],
};

// ---------- state ----------
let session = null;   // { access, refresh, uid, me } — me = last-seen profile, kept for offline use
let tab = null;
let online = navigator.onLine;

// ---------- storage (try/catch: private windows may block it) ----------
function readSession() { try { return JSON.parse(localStorage.getItem(AUTH_KEY)); } catch { return null; } }
function writeSession() { try { localStorage.setItem(AUTH_KEY, JSON.stringify(session)); } catch {} }
function clearSession() { session = null; try { localStorage.removeItem(AUTH_KEY); } catch {} }

// ---------- API (fetch against Supabase REST and auth; no SDK, no build step) ----------
async function api(method, path, body, { auth = true, retried = false, prefer } = {}) {
  const headers = { apikey: CFG.key, 'Content-Type': 'application/json' };
  if (auth && session?.access) headers.Authorization = 'Bearer ' + session.access;
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(CFG.url + path, { method, headers, body: body == null ? undefined : JSON.stringify(body) });
  if (r.status === 401 && auth && !retried && await refresh()) return api(method, path, body, { auth, retried: true, prefer });
  const text = await r.text();
  if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; e.body = text; throw e; }
  try { return text ? JSON.parse(text) : null; } catch { return text; }
}

// One refresh at a time in this tab. Refresh tokens are single-use, so a second tab of /next/ that
// refreshed first leaves a newer token in storage; adopt that instead of signing out.
let refreshing = null;
function refresh() { return refreshing ||= doRefresh().finally(() => { refreshing = null; }); }
async function doRefresh() {
  const used = session?.refresh;
  if (!used) return false;
  try {
    const s = await api('POST', '/auth/v1/token?grant_type=refresh_token', { refresh_token: used }, { auth: false });
    session = { ...session, access: s.access_token, refresh: s.refresh_token, uid: s.user.id };
    writeSession();
    return true;
  } catch (e) {
    const stored = readSession();
    if (stored?.refresh && stored.refresh !== used) { session = stored; return true; }
    if (e.status === 400 || e.status === 401) { clearSession(); render(); }
    return false;
  }
}

// ---------- auth ----------
// Same login ID and PIN as the old app, so one account works in both.
function creds(id, pin) { return [`${id}@${CFG.slug}.diffedu.app`, `de-${pin}-${id}`]; }
async function signIn(id, pin) {
  const [email, password] = creds(id, pin);
  const s = await api('POST', '/auth/v1/token?grant_type=password', { email, password }, { auth: false });
  session = { access: s.access_token, refresh: s.refresh_token, uid: s.user.id, me: null };
  writeSession();
  await loadMe();
}
async function loadMe() {
  const rows = await api('GET', `/rest/v1/profiles?select=${ME_COLS}&id=eq.${session.uid}`);
  session.me = rows?.[0] || null;
  writeSession();
}
function signOut() {
  const s = session;
  clearSession();
  if (s?.access) fetch(CFG.url + '/auth/v1/logout', { method: 'POST', headers: { apikey: CFG.key, Authorization: 'Bearer ' + s.access } }).catch(() => {});
  tab = null;
  render();
  toast('বের হয়েছেন');
}

// ---------- offline queue (same rules as the old app: keep on network loss, drop on a server refusal) ----------
const outbox = {
  all() { try { return JSON.parse(localStorage.getItem(OUTBOX_KEY)) || []; } catch { return []; } },
  mine() { return outbox.all().filter(i => i.uid === session?.uid); },
  save(list) { try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(list.slice(-2000))); } catch {} },
  add(item) {
    const list = outbox.all();
    list.push({ ...item, uid: session.uid, id: Date.now() + '-' + Math.random().toString(36).slice(2), at: Date.now() });
    outbox.save(list);
  },
};
let flushing = false;
async function flushOutbox() {
  if (flushing || !session?.access) return;
  flushing = true;
  try {
    for (const item of outbox.mine()) {
      try { await api(item.method, item.path, item.body, { prefer: item.prefer }); }
      catch (e) {
        if (!e.status || e.status === 401) return;   // still offline or signed out: keep the queue
        console.warn('outbox dropped', item.path, e.status);
      }
      outbox.save(outbox.all().filter(x => x.id !== item.id));
    }
  } finally { flushing = false; }
}
setInterval(() => { if (online && outbox.mine().length) flushOutbox(); }, 15000);

// ---------- UI ----------
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2600);
}
const statusHtml = () => online
  ? `<span class="status on">${svg('wifi')}অনলাইন</span>`
  : `<span class="status off" title="শেষ দেখা তথ্য দেখানো হচ্ছে">${svg('wifiOff')}অফলাইন</span>`;

function loginHtml() {
  return `<main class="login"><section class="card login-card">
    <div class="mark" aria-hidden="true">ডি</div>
    <h1>ডিফ এডু</h1>
    <p class="muted">লগইন আইডি ও পিন দিয়ে ঢুকুন</p>
    <form id="login" novalidate>
      <label for="lid">লগইন আইডি</label>
      <input id="lid" autocomplete="username" autocapitalize="none" spellcheck="false" required>
      <label for="lpin">পিন (৪–৬ সংখ্যা)</label>
      <div class="field">${svg('lock')}<input id="lpin" type="password" inputmode="numeric" maxlength="6" autocomplete="current-password" required></div>
      <p class="notice" id="err" role="alert" hidden></p>
      <button class="btn" type="submit" id="go">ঢুকুন</button>
    </form>
  </section></main>`;
}

function pageHtml(me) {
  if (tab === 'me') {
    return `<section class="card"><h2>${esc(me.full_name || 'নাম নেই')}</h2><p class="muted">${esc(ROLE_LABEL[me.role] || '')}</p></section>
      <button class="btn ghost" data-act="logout">${svg('lock')}বের হন</button>`;
  }
  const [title, text, icon] = EMPTY[tab];
  return `${tab === 'today' ? `<p class="date">${esc(dhakaDate())}</p>` : ''}
    <section class="card empty"><span class="circle">${svg(icon)}</span><h2>${esc(title)}</h2><p>${esc(text)}</p></section>`;
}

function shellHtml(me, tabs) {
  return `<header class="top">
      <div class="brand"><span class="mark" aria-hidden="true">ডি</span><div><h1>ডিফ এডু</h1><p class="muted">${esc(me.full_name || '')}</p></div></div>
      ${statusHtml()}
    </header>
    <main class="page">${pageHtml(me)}</main>
    <nav class="tabs" aria-label="প্রধান মেনু">${tabs.map(([id, label, icon]) =>
      `<button class="tab" data-tab="${id}"${id === tab ? ' aria-current="page"' : ''}>${svg(icon)}<span>${label}</span></button>`).join('')}</nav>`;
}

function render() {
  const root = $('#app');
  const me = session?.me;
  if (!me) { root.innerHTML = loginHtml(); return; }
  const group = ROLE_GROUP[me.role];
  if (!group) {
    root.innerHTML = `<main class="page"><section class="card empty"><span class="circle">${svg('alert')}</span>
      <h2>এই ভূমিকার জন্য অ্যাপ এখনো নেই</h2><p>অ্যাডমিনের সাথে কথা বলুন।</p></section>
      <button class="btn ghost" data-act="logout">${svg('lock')}বের হন</button></main>`;
    return;
  }
  const tabs = TABS[group];
  if (!tabs.some(t => t[0] === tab)) tab = tabs[0][0];
  root.innerHTML = shellHtml(me, tabs);
}

// ---------- events ----------
document.addEventListener('submit', async e => {
  if (e.target.id !== 'login') return;
  e.preventDefault();
  const id = ascii($('#lid').value).trim().toLowerCase();
  const pin = ascii($('#lpin').value).replace(/\D/g, '');
  if (!id || !/^\d{4,6}$/.test(pin)) return showLoginError('আইডি আর ৪–৬ সংখ্যার পিন দিন');
  $('#go').disabled = true;
  try {
    await signIn(id, pin);
    tab = null;
    render();
    flushOutbox();
  } catch (err) {
    if (session && !session.me) clearSession();   // signed in but profile not loaded: start clean
    showLoginError(!err.status ? 'ইন্টারনেট নেই। সংযোগ দেখে আবার চেষ্টা করুন'
      : err.status === 400 || err.status === 401 ? 'আইডি বা পিন মিলছে না'
      : 'এখন ঢোকা যাচ্ছে না। একটু পরে আবার চেষ্টা করুন');
  }
});
// Show the login error in place, so the typed ID stays in the form.
function showLoginError(msg) {
  if (!$('#login')) $('#app').innerHTML = loginHtml();
  const err = $('#err');
  err.hidden = false;
  err.innerHTML = svg('alert') + '<span></span>';
  err.querySelector('span').textContent = msg;
  $('#go').disabled = false;
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-tab]');
  if (t) { tab = t.dataset.tab; render(); return; }
  if (e.target.closest('[data-act="logout"]')) signOut();
});

window.addEventListener('online', () => { online = true; if (session?.me) render(); flushOutbox(); });
window.addEventListener('offline', () => { online = false; if (session?.me) render(); });

// ---------- start ----------
async function boot() {
  session = readSession();
  if (session?.access) {
    try { await loadMe(); }
    catch (e) {
      // Offline: keep the cached profile and show the last-seen screen. A refused session is cleared by api().
      if (e.status) clearSession();
    }
  }
  if (session && !session.me) clearSession();   // no profile and no network: ask to log in again
  render();
  if (session?.me) flushOutbox();
}
boot();

'use strict';
// Diff Edu PWA — guardian & student view. Same Supabase backend as the Android app; RLS decides what each user sees.
const CFG = {
  url: 'https://uwbyxwxfhrffrrqvheft.supabase.co',
  key: 'sb_publishable_fXPLUYRqvrz9d6i9xL2IAQ_tmtZ194t', // publishable key: safe to ship, RLS protects data
  slug: 'diff-edu',
};
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const bn = n => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
const MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
const fmtDate = d => { const x = new Date(d); return `${bn(x.getDate())} ${MONTHS[x.getMonth()]}`; };
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2200); };

// ---------- storage (try/catch: private windows may block it) ----------
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem('de.' + k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('de.' + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem('de.' + k); } catch {} },
};

// ---------- Supabase ----------
const S = { access: null, refresh: store.get('rt'), uid: store.get('uid'), me: null };

async function raw(method, path, body, { auth = true, prefer, retried } = {}) {
  if (auth && !S.access && S.refresh) await refresh();
  const h = { apikey: CFG.key, Accept: 'application/json' };
  if (auth && S.access) h.Authorization = 'Bearer ' + S.access;
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (prefer) h.Prefer = prefer;
  const r = await fetch(CFG.url + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  if (r.status === 401 && auth && !retried && await refresh()) return raw(method, path, body, { auth, prefer, retried: true });
  const t = await r.text();
  if (!r.ok) { const e = new Error(`HTTP ${r.status}`); e.status = r.status; e.body = t; throw e; }
  return t ? JSON.parse(t) : null;
}
async function refresh() {
  if (!S.refresh) return false;
  try {
    const o = await raw('POST', '/auth/v1/token?grant_type=refresh_token', { refresh_token: S.refresh }, { auth: false });
    saveSession(o); return true;
  } catch (e) { if (e.status) signOut(true); return false; }
}
function saveSession(o) {
  S.access = o.access_token; S.refresh = o.refresh_token; S.uid = o.user.id;
  store.set('rt', S.refresh); store.set('uid', S.uid);
}
const sel = (table, q) => raw('GET', `/rest/v1/${table}?${q}`);
const rpc = (fn, args = {}) => raw('POST', `/rest/v1/rpc/${fn}`, args);

// Same mapping as the Android app (SupabaseHttp.credentials).
function creds(id, pin) { id = id.trim().toLowerCase(); return [`${id}@${CFG.slug}.diffedu.app`, `de-${pin}-${id}`]; }
async function signIn(id, pin) {
  const [email, password] = creds(id, pin);
  saveSession(await raw('POST', '/auth/v1/token?grant_type=password', { email, password }, { auth: false }));
  S.me = (await sel('profiles', `select=id,full_name,role,login_id,must_change_pin&id=eq.${S.uid}`))[0];
  store.set('me', S.me);
}
// Same as the Android app: new password = de-<pin>-<id>, then pin_changed() clears the flag.
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
  ['rt', 'uid', 'me'].forEach(store.del);
  if (!silent) toast('বের হয়েছেন');
  go('login');
}

// ---------- data (with last-seen offline copy) ----------
async function cached(key, fn) {
  try { const v = await fn(); store.set('c.' + key, v); return v; }
  catch (e) {
    const old = store.get('c.' + key);
    if (old && !e.status) { offlineFlag = true; return old; }
    throw e;
  }
}
let offlineFlag = false;
const D = {
  kids: () => cached('kids', async () => {
    const sel1 = 'id,class_level,roll,batch:batches(shift),profile:profiles!students_profile_id_fkey(full_name)';
    if (S.me.role === 'student') return sel('students', `select=${sel1}&profile_id=eq.${S.uid}`);
    const l = await sel('guardian_students', `select=student_id&guardian_id=eq.${S.uid}`);
    if (!l.length) return [];
    return sel('students', `select=${sel1}&id=in.(${l.map(x => x.student_id).join(',')})`);
  }),
  att: id => cached('att' + id, () => sel('attendance', `select=date,check_in,check_out&student_id=eq.${id}&order=date.desc&limit=60`)),
  marks: id => cached('marks' + id, () => sel('marks', `select=obtained,exam:exams(title,exam_date,full_marks,subject:subjects(name))&student_id=eq.${id}`)),
  fees: id => cached('fees' + id, () => sel('fees', `select=month,amount,paid_amount,status,method&student_id=eq.${id}&order=month.desc`)),
  notices: () => cached('notices', () => sel('notices', 'select=id,title,body,created_at&order=created_at.desc&limit=30')),
  notes: () => cached('notes', () => sel('guardian_notes', 'select=id,student_id,day,title,body,read_at&order=updated_at.desc&limit=40')),
  hw: cls => cached('hw' + cls, () => sel('homework', `select=title,due_date,subject:subjects(name)&class_level=eq.${cls}&order=due_date.asc`)),
};

// ---------- UI ----------
const view = $('#view');
let route = 'home', kid = store.get('kid');
const TITLES = { home: 'ডিফ এডু', att: 'হাজিরা', marks: 'নম্বর', fees: 'ফি', more: 'আরও', notices: 'নোটিশ', notes: 'বার্তা', hw: 'বাড়ির কাজ' };

function go(r) {
  route = r;
  const logged = r !== 'login';
  $('#bar').hidden = !logged; $('#tabs').hidden = !logged;
  $('#title').textContent = TITLES[r] || 'ডিফ এডু';
  const sub = ['notices', 'notes', 'hw'].includes(r);
  $('#back').hidden = !sub;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === (sub ? 'more' : r)));
  history.replaceState(null, '', '#' + r);
  render();
}

async function render() {
  const myRoute = route;
  offlineFlag = false;
  if (route === 'login') return loginView();
  if (S.me?.must_change_pin) return pinView();
  view.innerHTML = '<div class="skel"></div><div class="skel"></div><div class="skel"></div>';
  try {
    const kids = await D.kids();
    if (!kids.length && !['notices', 'more'].includes(route)) { view.innerHTML = '<div class="card">কোনো শিক্ষার্থী যুক্ত নেই। অফিসে যোগাযোগ করুন।</div>'; return; }
    if (!kid || !kids.find(k => k.id === kid)) kid = kids[0]?.id;
    const k = kids.find(x => x.id === kid);
    const html = await SCREENS[route](k, kids);
    if (myRoute !== route) return; // user navigated away while loading
    view.innerHTML = (offlineFlag ? '<div class="offline">অফলাইন — শেষ দেখা তথ্য</div>' : '') + kidPicker(kids) + html;
    view.querySelectorAll('.kids button').forEach(b => b.onclick = () => { kid = b.dataset.id; store.set('kid', kid); render(); });
    view.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
  } catch (e) {
    view.innerHTML = `<div class="card"><p>তথ্য আনা যায়নি${e.status ? '' : ' (ইন্টারনেট নেই?)'}।</p><button class="primary" id="retry">আবার চেষ্টা</button></div>`;
    $('#retry').onclick = render;
  }
}

const kidName = k => k.profile?.full_name || 'শিক্ষার্থী';
const kidPicker = kids => kids.length > 1 ? `<div class="kids">${kids.map(k => `<button data-id="${k.id}" class="${k.id === kid ? 'on' : ''}">${esc(kidName(k))}</button>`).join('')}</div>` : '';
const taka = n => '৳' + bn(Math.round(n));
const dhakaToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });

const SCREENS = {
  async home(k) {
    const [att, fees, notes] = await Promise.all([D.att(k.id), D.fees(k.id), D.notes().catch(() => [])]);
    const today = att.find(a => a.date === dhakaToday());
    const month = dhakaToday().slice(0, 7);
    const present = att.filter(a => a.date.startsWith(month) && a.check_in).length;
    const due = fees.filter(f => f.status !== 'paid').reduce((s, f) => s + (f.amount - f.paid_amount), 0);
    const unread = notes.filter(n => !n.read_at).length;
    return `<div class="card"><h2>${esc(kidName(k))}</h2><div class="mute">শ্রেণি ${bn(k.class_level)}${k.roll ? ' · রোল ' + esc(bn(k.roll)) : ''}</div>
      <div class="row"><span>আজ</span><span class="chip ${today?.check_in ? 'ok' : ''}">${today?.check_in ? 'উপস্থিত' : 'এখনো আসেনি'}</span></div>
      <div class="row"><span>এ মাসে উপস্থিতি</span><b>${bn(present)} দিন</b></div></div>
      ${due > 0 ? `<div class="card" data-go="fees"><h2>বকেয়া ফি</h2><div class="big bad">${taka(due)}</div><div class="mute">বিস্তারিত দেখুন ›</div></div>` : ''}
      ${unread ? `<div class="card" data-go="notes"><h2>নতুন বার্তা</h2><div class="big">${bn(unread)}টি</div></div>` : ''}`;
  },
  async att(k) {
    const att = await D.att(k.id);
    const by = Object.fromEntries(att.map(a => [a.date, a]));
    const now = new Date(); const y = now.getFullYear(), m = now.getMonth();
    const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate(), td = dhakaToday();
    let cells = '<div class="mute">র</div><div class="mute">সো</div><div class="mute">ম</div><div class="mute">বু</div><div class="mute">বৃ</div><div class="mute">শু</div><div class="mute">শ</div>';
    for (let i = 0; i < first; i++) cells += '<div></div>';
    for (let d = 1; d <= days; d++) {
      const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const a = by[ds]; const fri = new Date(y, m, d).getDay() === 5;
      cells += `<div class="${a?.check_in ? 'p' : ds < td && !fri ? 'a' : 'h'}">${bn(d)}</div>`;
    }
    const time = t => t ? new Date(t).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dhaka' }) : '—';
    return `<div class="card"><h2>${MONTHS[m]}</h2><div class="cal">${cells}</div><p class="mute">সবুজ = উপস্থিত · লাল = অনুপস্থিত</p></div>
      <div class="card"><h2>সাম্প্রতিক</h2>${att.slice(0, 10).map(a => `<div class="row"><span>${fmtDate(a.date)}</span><span class="mute">${time(a.check_in)}${a.check_out ? ' – ' + time(a.check_out) : ''}</span></div>`).join('') || '<div class="mute">এখনো কিছু নেই</div>'}</div>`;
  },
  async marks(k) {
    const ms = (await D.marks(k.id)).filter(m => m.exam);
    ms.sort((a, b) => (b.exam.exam_date || '').localeCompare(a.exam.exam_date || ''));
    return `<div class="card"><h2>পরীক্ষার ফল</h2>${ms.map(m => {
      const pct = m.obtained == null ? null : Math.round(m.obtained / m.exam.full_marks * 100);
      return `<div class="row"><div>${esc(m.exam.subject?.name || '')} <span class="mute">${esc(m.exam.title)}${m.exam.exam_date ? ' · ' + fmtDate(m.exam.exam_date) : ''}</span></div><b class="${pct != null && pct < 40 ? 'bad' : ''}">${m.obtained == null ? '—' : bn(m.obtained) + '/' + bn(m.exam.full_marks)}</b></div>`;
    }).join('') || '<div class="mute">এখনো কোনো ফল নেই</div>'}</div>`;
  },
  async fees(k) {
    const fs = await D.fees(k.id);
    return `<div class="card"><h2>মাসিক ফি</h2>${fs.map(f => {
      const d = new Date(f.month);
      const st = f.status === 'paid' ? '<span class="chip ok">পরিশোধিত</span>' : f.status === 'partial' ? `<span class="chip bad">বাকি ${taka(f.amount - f.paid_amount)}</span>` : '<span class="chip bad">বাকি</span>';
      return `<div class="row"><div>${MONTHS[d.getMonth()]} ${bn(d.getFullYear())}<div class="mute">${taka(f.amount)}</div></div>${st}</div>`;
    }).join('') || '<div class="mute">কোনো ফি নেই</div>'}</div>
    <p class="mute">ফি অফিসে জমা দিন; জমা হলে এখানে দেখা যাবে।</p>`;
  },
  async more() {
    return `<div class="card" data-go="notices"><h2>নোটিশ বোর্ড</h2><div class="mute">কোচিংয়ের নোটিশ ›</div></div>
      <div class="card" data-go="notes"><h2>বার্তা</h2><div class="mute">হাজিরা ও ক্লাস স্কোরের বার্তা ›</div></div>
      <div class="card" data-go="hw"><h2>বাড়ির কাজ</h2><div class="mute">শ্রেণি অনুযায়ী ›</div></div>
      <div class="card"><h2>${esc(S.me.full_name)}</h2><div class="mute">লগইন আইডি: ${esc(S.me.login_id)}</div></div>`;
  },
  async notices() {
    const ns = await D.notices();
    return ns.map(n => `<div class="card"><h2>${esc(n.title)}</h2><div class="mute">${fmtDate(n.created_at)}</div><p style="white-space:pre-wrap">${esc(n.body)}</p></div>`).join('') || '<div class="card mute">কোনো নোটিশ নেই</div>';
  },
  async notes(k, kids) {
    const ns = await D.notes();
    const unread = ns.filter(n => !n.read_at).map(n => n.id);
    if (unread.length && !offlineFlag) rpc('mark_notes_read', { p_ids: unread }).catch(() => {});
    const name = id => kidName(kids.find(x => x.id === id) || {});
    return ns.map(n => `<div class="card"><h2>${esc(n.title)} ${n.read_at ? '' : '<span class="chip bad">নতুন</span>'}</h2><div class="mute">${esc(name(n.student_id))} · ${fmtDate(n.day)}</div><p>${esc(n.body)}</p></div>`).join('') || '<div class="card mute">কোনো বার্তা নেই</div>';
  },
  async hw(k) {
    const hs = await D.hw(k.class_level);
    return `<div class="card"><h2>শ্রেণি ${bn(k.class_level)}</h2>${hs.map(h => `<div class="row"><div>${esc(h.title)}<div class="mute">${esc(h.subject?.name || '')}</div></div><span class="mute">${h.due_date ? fmtDate(h.due_date) : ''}</span></div>`).join('') || '<div class="mute">কোনো কাজ নেই</div>'}</div>`;
  },
};

function loginView() {
  view.innerHTML = `<div class="login"><img class="logo" src="icon.svg" alt=""><h1>ডিফ এডু</h1><div class="mute">লগইন আইডি ও পিন দিন</div>
    <form id="f" autocomplete="on"><label for="id">লগইন আইডি (মোবাইল নম্বর বা রোল)</label><input id="id" name="username" inputmode="text" autocomplete="username" required>
    <label for="pin">পিন</label><input id="pin" name="password" type="password" inputmode="numeric" autocomplete="current-password" required>
    <div class="err" id="err"></div><button class="primary" id="go">ঢুকুন</button></form></div>`;
  $('#f').onsubmit = async ev => {
    ev.preventDefault();
    const b = $('#go'); b.disabled = true; b.textContent = 'অপেক্ষা করুন…'; $('#err').textContent = '';
    try {
      await signIn($('#id').value, $('#pin').value);
      if (!['guardian', 'student'].includes(S.me.role)) { signOut(true); $('#err').textContent = 'শিক্ষক ও অ্যাডমিনের জন্য অ্যান্ড্রয়েড অ্যাপ ব্যবহার করুন।'; b.disabled = false; b.textContent = 'ঢুকুন'; return; }
      go('home');
    } catch (e) {
      $('#err').textContent = e.status === 400 ? 'আইডি বা পিন ঠিক নয়।' : 'ইন্টারনেট সংযোগ দেখুন।';
      b.disabled = false; b.textContent = 'ঢুকুন';
    }
  };
}

function pinView() {
  $('#tabs').hidden = true; $('#back').hidden = true;
  view.innerHTML = `<div class="login"><h1>নতুন পিন দিন</h1><div class="mute">পরের বার থেকে এই পিন দিয়ে লগইন করবেন।</div>
    <form id="pf"><label for="np">নতুন পিন (৪–৬ সংখ্যা)</label><input id="np" type="password" inputmode="numeric" autocomplete="new-password" maxlength="6" required>
    <label for="np2">আবার লিখুন</label><input id="np2" type="password" inputmode="numeric" autocomplete="new-password" maxlength="6" required>
    <div class="err" id="perr"></div><button class="primary" id="pgo">পিন সংরক্ষণ করুন</button></form></div>`;
  const digits = s => s.replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d));
  $('#pf').onsubmit = async ev => {
    ev.preventDefault();
    const a = digits($('#np').value), b = digits($('#np2').value), err = $('#perr');
    if (!/^\d{4,6}$/.test(a)) { err.textContent = 'পিন ৪ থেকে ৬ সংখ্যার হতে হবে।'; return; }
    if (a !== b) { err.textContent = 'দুই জায়গায় পিন মেলেনি।'; return; }
    if (a === '1234' || a === '2580') { err.textContent = 'এটা সহজ পিন। অন্য পিন বাছুন।'; return; }
    const btn = $('#pgo'); btn.disabled = true; btn.textContent = 'সংরক্ষণ হচ্ছে…'; err.textContent = '';
    try { await changePin(a); toast('নতুন পিন সংরক্ষিত ✓'); go('home'); }
    catch (e) {
      err.textContent = e.message === 'flag' ? 'নতুন পিন চালু হয়েছে, তবে পুরোপুরি জমা হয়নি। আবার একই পিন দিয়ে সংরক্ষণ চাপুন।' : 'সংরক্ষণ করা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।';
      btn.disabled = false; btn.textContent = 'পিন সংরক্ষণ করুন';
    }
  };
}

// ---------- boot ----------
$('#back').onclick = () => go('more');
$('#logout').onclick = () => signOut();
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => go(b.dataset.tab));
window.addEventListener('online', () => route !== 'login' && render());

(async function boot() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (S.refresh) {
    S.me = store.get('me');
    if (!S.me) { try { await refresh(); S.me = (await sel('profiles', `select=id,full_name,role,login_id,must_change_pin&id=eq.${S.uid}`))[0]; store.set('me', S.me); } catch {} }
  }
  if (S.me) { const h = location.hash.slice(1); go(SCREENS[h] ? h : 'home'); } else go('login');
})();

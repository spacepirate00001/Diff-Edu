'use strict';
// Profile, change requests and help — mirror ui/screens/profile/ProfileScreen.kt, RequestScreens.kt and ui/screens/HelpScreen.kt.
// Routes: profile, my.requests (everyone), a.requests (admin), help. Avatar helpers live in app.js (hydrateAvatars, refreshAvatar).
(function () {
  const AVATAR_MAX = 300 * 1024;        // the server-side rule (Kotlin: MAX_AVATAR_BYTES)
  const AVATAR_TARGET = 250000;         // resize until the JPEG is at most this
  const MIN_CHARS = 3, MAX_CHARS = 500, NOTE_CHARS = 300;
  const OFFICE_DIAL = '01711678818', OFFICE_SHOW = '০১৭১১-৬৭৮৮১৮';
  const ROLE_BN = { admin: 'অ্যাডমিন', teacher: 'শিক্ষক', guardian: 'অভিভাবক', student: 'শিক্ষার্থী' };
  const KINDS = [['name', 'নাম'], ['phone', 'ফোন নম্বর'], ['class', 'ক্লাস'], ['shift', 'শিফট'], ['photo', 'ছবি'], ['other', 'অন্য কিছু']];
  const kindBn = db => (KINDS.find(k => k[0] === db) || KINDS[5])[1];
  const FAQ = [
    ['পিন ভুলে গেলে কী করব?', 'অফিসে ফোন করে আপনার লগইন আইডি বলুন। অফিস একটি নতুন পিন দেবে। পরের লগইনে নিজের পিন বানিয়ে নিন।'],
    ['সন্তানের উপস্থিতি কোথায় দেখব?', "হোম থেকে সন্তানকে বেছে নিন, তারপর 'উপস্থিতি' চাপুন।"],
    ['ফলাফল আর রিপোর্ট কার্ড কোথায়?', "হোম থেকে সন্তানকে বেছে নিন। 'রিপোর্ট কার্ড' চাপলে সাপ্তাহিক ফল দেখবেন।"],
    ['ছবি বা নম্বর বদলাতে চাইলে?', "প্রোফাইল খুলে 'ছবি বদলান' চাপতে পারেন। নম্বর বা অন্য তথ্য বদলাতে 'পরিবর্তনের অনুরোধ' চাপুন, অফিস বদলটি করে দেবে।"],
    ['নেট না থাকলে কী হয়?', 'অ্যাপ শেষবার পাওয়া তথ্য দেখায়। শিক্ষকের উপস্থিতি ফোনে থাকে, নেট ফিরলে পাঠিয়ে দেওয়া হয়।'],
    ['অ্যাপ আপডেট কীভাবে করব?', "ব্রাউজারে বা হোম স্ক্রিনের অ্যাপে নতুন সংস্করণ নিজে থেকেই আসে। কিছু না বদলালে অ্যাপটি বন্ধ করে আবার খুলুন।"],
  ];

  const initialOf = name => (name || '').trim().charAt(0).toUpperCase();
  const kidName = k => k?.profile?.full_name || 'শিক্ষার্থী';
  const uniq = a => [...new Set(a)];
  const chips = (items, on) => items.map(([v, l]) => `<button class="rq-chip${on(v) ? ' on' : ''}" data-v="${esc(v)}" aria-pressed="${on(v) ? 'true' : 'false'}">${esc(l)}</button>`).join('');
  const statusPill = s => s === 'pending' ? pill('অপেক্ষায়', 'sun') : s === 'done' ? pill('হয়ে গেছে', 'good') : s === 'rejected' ? pill('হবে না', 'coral') : pill(s);
  const myAvatarObject = () => `${S.me?.coaching_id}/${S.uid}.jpg`;

  /** Error line for a failed send. 403 / 42501 / row-level security = the daily limit on the server (10 a day). */
  function sendError(e) {
    const m = `${e?.body || ''} ${e?.message || ''}`;
    return (e?.status === 403 || /row-level security|42501|403/.test(m))
      ? 'আজ অনেক বার পাঠানো হয়ে গেছে। কাল আবার চেষ্টা করুন।'
      : 'পাঠানো যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।';
  }
  /** Children of this guardian (name + id), for the "কোন সন্তানের জন্য?" chips. Empty for everyone else. */
  async function myKids() {
    if (S.me?.role !== 'guardian') return [];
    const l = await sel('guardian_students', `select=student_id&guardian_id=eq.${S.uid}`);
    if (!l.length) return [];
    return sel('students', `select=id,profile:profiles!students_profile_id_fkey(full_name)&id=${inList(l.map(x => x.student_id))}`);
  }

  // ---------- photo: pick -> 320x320 center crop -> JPEG (EXIF rotation honoured) ----------
  /** Picked file -> JPEG Blob. Lowers quality 0.8 -> 0.4 until it is at most AVATAR_TARGET bytes. Null if unreadable. */
  async function avatarBlob(file) {
    let src = null, url = null;
    try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch {
      // older browsers: an <img> from an object URL (modern ones apply the EXIF orientation themselves)
      try { url = URL.createObjectURL(file); src = new Image(); src.src = url; await src.decode(); }
      catch { if (url) URL.revokeObjectURL(url); return null; }
    }
    const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
    if (!w || !h) { src.close?.(); if (url) URL.revokeObjectURL(url); return null; }
    const side = Math.min(w, h);
    const cv = document.createElement('canvas');
    cv.width = cv.height = 320;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, (w - side) / 2, (h - side) / 2, side, side, 0, 0, 320, 320);
    src.close?.(); if (url) URL.revokeObjectURL(url);
    let blob = null;
    for (const q of [0.8, 0.7, 0.6, 0.5, 0.4]) {
      blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', q));
      if (!blob) return null;
      if (blob.size <= AVATAR_TARGET) break;
    }
    return blob;
  }

  const setMsg = (el, t) => { const m = el.querySelector('#pf-msg'); if (m) m.textContent = t; };
  const setBtns = (el, on) => el.querySelectorAll('.pf-acts button').forEach(b => { b.disabled = !on; });

  async function savePhoto(el, file) {
    setBtns(el, false); setMsg(el, 'ছবি পাঠানো হচ্ছে…');
    let blob = null;
    try { blob = await avatarBlob(file); } catch { blob = null; }
    if (!blob) { setBtns(el, true); setMsg(el, 'ছবিটি খোলা যাচ্ছে না। অন্য একটা ছবি দিন।'); return; }
    const path = myAvatarObject();
    try {
      if (blob.size > AVATAR_MAX) throw new Error('avatar larger than 300 KB');
      await upload('avatars', path, blob, 'image/jpeg', true);   // overwrite the same object name
      await rpc('set_my_avatar', { p_path: path });
      await refreshAvatar(path);
      if (cur().r === 'profile') rerender();
    } catch {
      setBtns(el, true); setMsg(el, 'ছবিটি সংরক্ষণ করা গেল না। ইন্টারনেট দেখে আবার চেষ্টা করুন।');
    }
  }

  async function removePhoto(el) {
    setBtns(el, false); setMsg(el, 'ছবি সরানো হচ্ছে…');
    try {
      await rpc('clear_my_avatar');
      raw('DELETE', `/storage/v1/object/avatars/${myAvatarObject()}`).catch(() => {});   // best effort, like the APK
      await refreshAvatar(null);
      if (cur().r === 'profile') rerender();
    } catch {
      setBtns(el, true); setMsg(el, 'ছবিটি সরানো গেল না। আবার চেষ্টা করুন।');
    }
  }

  // ---------- profile ----------
  SCREENS.profile = { title: 'আমার প্রোফাইল', render: async (el) => {
    let me = null;
    try {
      me = (await sel('profiles', `select=id,full_name,role,login_id,phone,avatar_path&id=eq.${S.uid}`))[0] || null;
      if (me) AV.path = me.avatar_path || null;
    } catch { me = null; }
    const head = me ? `<div class="pf-head">
        <div class="pf-av" data-avatar><span class="hav-i">${esc(initialOf(me.full_name))}</span></div>
        <h2 class="pf-name">${esc(me.full_name)}</h2>
        <span class="pill teal">${esc(ROLE_BN[me.role] || '')}</span>
      </div>
      <div class="card">
        <div class="pf-kv"><span>লগইন আইডি</span><b>${esc(me.login_id)}</b></div>
        <div class="pf-kv"><span>ফোন</span><b>${esc(me.phone ? bn(me.phone) : 'দেওয়া নেই')}</b></div>
      </div>
      <div class="pf-acts">
        <button class="btn" id="pf-pick">ছবি বদলান</button>
        ${me.avatar_path ? '<button class="btn sun" id="pf-rm">ছবি সরান</button>' : ''}
        <input type="file" id="pf-file" accept="image/*" hidden>
        <div class="mute pf-msg" id="pf-msg" aria-live="polite"></div>
      </div>` : empty('alert', 'প্রোফাইল খোলা যাচ্ছে না। ইন্টারনেট দেখে আবার খুলুন।');
    el.innerHTML = head + `
      <div class="card tap" data-go="my.requests"><h3>পরিবর্তনের অনুরোধ</h3><div class="mute">নাম, নম্বর বা অন্য কিছু বদলাতে চান?</div></div>
      ${me?.role === 'admin' ? '<div class="card tap" data-go="a.requests"><h3>অনুরোধের তালিকা</h3><div class="mute">সবার পাঠানো অনুরোধ দেখুন ও সিদ্ধান্ত নিন</div></div>' : ''}
      <div class="card tap" data-go="help"><h3>সহায়তা</h3><div class="mute">সাধারণ প্রশ্নের উত্তর ও অফিসের নম্বর</div></div>
      <div class="mute center">ডিফ এডু</div>`;
    if (!me) return;
    const file = el.querySelector('#pf-file');
    el.querySelector('#pf-pick').onclick = () => file.click();
    file.onchange = () => { const f = file.files?.[0]; file.value = ''; if (f) savePhoto(el, f); };
    el.querySelector('#pf-rm')?.addEventListener('click', () => removePhoto(el));
  } };

  // ---------- my change requests (everyone) ----------
  SCREENS['my.requests'] = { title: 'পরিবর্তনের অনুরোধ', sub: 'কিছু ভুল বা বদলাতে চান? অ্যাডমিনকে জানান', render: async (el) => {
    const kids = await myKids();
    const st = { kind: null, child: kids.length === 1 ? kids[0].id : null, busy: false, busyId: '', notice: '', bad: false };
    const $ = s => el.querySelector(s);
    el.innerHTML = `<div class="card">
        <h3>নতুন অনুরোধ</h3>
        <div class="rq-label">কোন বিষয়ে?</div>
        <div class="rq-grid" id="rq-kinds"></div>
        ${kids.length ? '<div class="rq-label">কোন সন্তানের জন্য?</div><div class="rq-grid two" id="rq-kids"></div>' : ''}
        <div class="rq-label">কী বদলাতে চান?</div>
        <textarea id="rq-text" rows="3" maxlength="${MAX_CHARS}" aria-label="কী বদলাতে চান?"></textarea>
        <div class="rq-count"><span class="mute" id="rq-hint"></span><span class="mute" id="rq-cnt"></span></div>
        <button class="btn" id="rq-send" disabled>পাঠান</button>
        <div class="rq-notice" id="rq-notice" aria-live="polite"></div>
      </div>
      <div class="section">আপনার অনুরোধ</div>
      <div id="rq-list" class="rq-list">${skel(2)}</div>`;

    const paint = () => {
      $('#rq-kinds').innerHTML = chips(KINDS, v => v === st.kind);
      if (kids.length) $('#rq-kids').innerHTML = chips(kids.map(k => [k.id, kidName(k)]), v => v === st.child);
      const text = $('#rq-text').value, t = text.trim();
      $('#rq-hint').textContent = t.length < MIN_CHARS ? `কমপক্ষে ${bn(MIN_CHARS)} অক্ষর লিখুন` : '';
      $('#rq-cnt').textContent = `${bn(text.length)}/${bn(MAX_CHARS)}`;
      const send = $('#rq-send');
      send.disabled = !(st.kind && t.length >= MIN_CHARS && !st.busy);
      send.textContent = st.busy ? 'অপেক্ষা করুন…' : 'পাঠান';
      const n = $('#rq-notice');
      n.textContent = st.notice; n.classList.toggle('bad', st.bad);
    };
    const loadMine = async () => {
      const box = $('#rq-list');
      try {
        const rows = await sel('profile_requests', `select=id,kind,message,status,admin_note,created_at&profile_id=eq.${S.uid}&order=created_at.desc&limit=100`);
        box.innerHTML = rows.length
          ? rows.map(r => `<div class="card rq-card">
              <div class="rq-top">${pill(kindBn(r.kind), 'teal')}<span class="mute rq-date">${fmtDateY(r.created_at)}</span>${statusPill(r.status)}</div>
              <div class="rq-msg">${esc(r.message)}</div>
              ${r.admin_note ? `<div class="mute">অ্যাডমিন: ${esc(r.admin_note)}</div>` : ''}
              ${r.status === 'pending' ? `<button class="link rq-wd" data-withdraw="${esc(r.id)}"${st.busyId === r.id ? ' disabled' : ''}>${st.busyId === r.id ? 'ফিরিয়ে নেওয়া হচ্ছে…' : 'ফিরিয়ে নিন'}</button>` : ''}
            </div>`).join('')
          : empty('inbox', 'এখনো কোনো অনুরোধ নেই। সব ঠিকঠাক তাহলে।');
      } catch { box.innerHTML = empty('alert', 'অনুরোধ আনা যাচ্ছে না। ইন্টারনেট দেখে আবার খুলুন।'); }
    };

    $('#rq-kinds').onclick = e => { const b = e.target.closest('[data-v]'); if (b) { st.kind = b.dataset.v; paint(); } };
    if (kids.length) $('#rq-kids').onclick = e => { const b = e.target.closest('[data-v]'); if (b) { st.child = st.child === b.dataset.v ? null : b.dataset.v; paint(); } };
    $('#rq-text').oninput = paint;
    $('#rq-send').onclick = async () => {
      const text = $('#rq-text').value.trim();
      st.busy = true; st.notice = ''; st.bad = false; paint();
      try {
        await ins('profile_requests', { coaching_id: S.me.coaching_id, kind: st.kind, message: text, about_student_id: st.child || null });
        st.kind = null; $('#rq-text').value = ''; st.child = kids.length === 1 ? kids[0].id : null;
        st.notice = 'পৌঁছে গেছে, অ্যাডমিন দেখবেন।';
        loadMine();
      } catch (e) { st.bad = true; st.notice = sendError(e); }
      finally { st.busy = false; paint(); }
    };
    $('#rq-list').onclick = async e => {
      const b = e.target.closest('[data-withdraw]');
      if (!b) return;
      st.busyId = b.dataset.withdraw; st.notice = ''; st.bad = false;
      b.disabled = true; b.textContent = 'ফিরিয়ে নেওয়া হচ্ছে…';
      try {
        await del('profile_requests', `id=eq.${enc(st.busyId)}&status=eq.pending&profile_id=eq.${S.uid}`);
      } catch { st.bad = true; st.notice = 'ফিরিয়ে নেওয়া গেল না। আবার চেষ্টা করুন।'; }
      st.busyId = '';
      paint(); loadMine();
    };
    paint();
    loadMine();
  } };

  // ---------- admin: all requests, decide each one ----------
  SCREENS['a.requests'] = { title: 'অনুরোধের তালিকা', sub: 'সবার পাঠানো পরিবর্তনের অনুরোধ', render: async (el) => {
    const st = { pending: true, busyId: '', notice: '', bad: false };
    const $ = s => el.querySelector(s);
    el.innerHTML = `<div class="rq-hint mute">নাম, ফোন বা ক্লাস বদলাতে আগে "প্রোফাইল সম্পাদনা"-তে বদলান, তারপর এখানে "হয়ে গেছে" চাপুন। অ্যাপ নিজে থেকে কিছু বদলায় না।</div>
      <div class="rq-grid two" id="rq-filter">
        <button class="rq-chip" data-f="1">অপেক্ষায়</button>
        <button class="rq-chip" data-f="0">সব</button>
      </div>
      <div class="rq-notice" id="rq-notice" aria-live="polite"></div>
      <div id="rq-list" class="rq-list">${skel(2)}</div>`;

    const paint = () => {
      $('#rq-filter').querySelectorAll('[data-f]').forEach(b => {
        const on = (b.dataset.f === '1') === st.pending;
        b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      const n = $('#rq-notice');
      n.textContent = st.notice; n.classList.toggle('bad', st.bad);
    };
    const draw = async () => {
      const list = $('#rq-list');
      try {
        const rows = await sel('profile_requests', `select=id,profile_id,about_student_id,kind,message,status,admin_note,created_at&order=created_at.desc&limit=300${st.pending ? '&status=eq.pending' : ''}`);
        if (!rows.length) { list.innerHTML = empty('inbox', st.pending ? 'এখন অপেক্ষায় কোনো অনুরোধ নেই। সব ঠিক আছে।' : 'কোনো অনুরোধ নেই।'); return; }
        const pids = uniq(rows.map(r => r.profile_id).filter(Boolean));
        const sids = uniq(rows.map(r => r.about_student_id).filter(Boolean));
        const [who, kids] = await Promise.all([
          pids.length ? sel('profiles', `select=id,full_name,role&id=${inList(pids)}`) : [],
          sids.length ? sel('students', `select=id,profile:profiles!students_profile_id_fkey(full_name)&id=${inList(sids)}`) : [],
        ]);
        const W = Object.fromEntries(who.map(p => [p.id, p]));
        const K = Object.fromEntries(kids.map(s => [s.id, s.profile?.full_name || '']));
        list.innerHTML = rows.map(r => {
          const w = W[r.profile_id] || {}, busy = st.busyId === r.id, dis = busy ? ' disabled' : '';
          return `<div class="card rq-card" data-req="${esc(r.id)}">
            <div class="rq-top"><div style="flex:1;min-width:0"><h3>${esc(w.full_name || 'নামহীন')}</h3>${ROLE_BN[w.role] ? `<div class="mute small">${esc(ROLE_BN[w.role])}</div>` : ''}</div>${statusPill(r.status)}</div>
            <div class="rq-top">${pill(kindBn(r.kind), 'teal')}<span class="mute rq-date">${fmtDateY(r.created_at)}</span></div>
            ${K[r.about_student_id] ? `<div><b>সন্তান: ${esc(K[r.about_student_id])}</b></div>` : ''}
            <div class="rq-msg">${esc(r.message)}</div>
            ${r.admin_note ? `<div class="mute">অ্যাডমিন: ${esc(r.admin_note)}</div>` : ''}
            ${r.status === 'pending' ? `<input class="rq-note" maxlength="${NOTE_CHARS}" aria-label="অ্যাডমিনের মন্তব্য (ঐচ্ছিক, সর্বোচ্চ ${bn(NOTE_CHARS)})" placeholder="অ্যাডমিনের মন্তব্য (ঐচ্ছিক, সর্বোচ্চ ${bn(NOTE_CHARS)})"${dis ? ' disabled' : ''}>
              <div class="rq-acts">
                <button class="btn" data-d="1"${dis}>${busy ? '…' : 'হয়ে গেছে'}</button>
                <button class="btn coral" data-d="0"${dis}>${busy ? '…' : 'হবে না'}</button>
              </div>` : ''}
          </div>`;
        }).join('');
      } catch { list.innerHTML = empty('alert', 'অনুরোধ আনা যাচ্ছে না। ইন্টারনেট দেখে আবার খুলুন।'); }
    };
    const decide = async (card, id, done) => {
      const note = card.querySelector('.rq-note')?.value.trim() || null;
      st.busyId = id; st.notice = ''; st.bad = false;
      card.querySelectorAll('button, input').forEach(x => { x.disabled = true; });
      try {
        await rpc('decide_profile_request', { p_id: id, p_status: done ? 'done' : 'rejected', p_note: note });
        st.notice = done ? 'হয়ে গেছে বলে রাখা হলো।' : 'হবে না বলে রাখা হলো।';
      } catch { st.bad = true; st.notice = 'সিদ্ধান্ত রাখা গেল না। আবার চেষ্টা করুন।'; }
      st.busyId = '';
      paint(); draw();
    };

    $('#rq-filter').onclick = e => {
      const b = e.target.closest('[data-f]');
      if (!b) return;
      st.pending = b.dataset.f === '1';
      paint(); draw();
    };
    $('#rq-list').onclick = e => {
      const b = e.target.closest('[data-d]');
      if (!b) return;
      const card = b.closest('[data-req]');
      decide(card, card.dataset.req, b.dataset.d === '1');
    };
    paint();
    draw();
  } };

  // ---------- help ----------
  SCREENS.help = { title: 'সহায়তা', sub: 'সাধারণ প্রশ্নের উত্তর', render: async (el) => {
    el.innerHTML = `<div class="card">
        <h3>কোচিং অফিস</h3>
        <div class="help-no">${OFFICE_SHOW}</div>
        <a class="btn" href="tel:${OFFICE_DIAL}">অফিসে ফোন করুন</a>
      </div>
      ${FAQ.map(([q, a], i) => `<button class="card help-q" data-i="${i}" aria-expanded="false">
          <div class="help-top"><b>${esc(q)}</b><span class="help-pm" aria-hidden="true">+</span></div>
          <div class="mute help-a" hidden>${esc(a)}</div>
        </button>`).join('')}
      <div class="mute center">ডিফ এডু</div>`;
    el.querySelectorAll('.help-q').forEach(b => b.addEventListener('click', () => {
      const open = b.getAttribute('aria-expanded') !== 'true';
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
      b.querySelector('.help-pm').textContent = open ? '−' : '+';
      b.querySelector('.help-a').hidden = !open;
    }));
  } };
})();

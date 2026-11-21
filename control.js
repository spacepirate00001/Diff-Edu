'use strict';
// "সার্ভার থেকে নিয়ন্ত্রণ" (admin only): which tiles each role's HOME shows, their order and names, and a banner.
// Saves app_config (key home.<role>); the homes read the same row through app.js (loadHomeConfig, applyHomeConfig, homeBanner).
// No row = the default home. Titles are the DEFAULT titles the home screens draw (family.js, teacher.js).
(function () {
  const CTL_ROLES = [['guardian', 'অভিভাবক'], ['student', 'শিক্ষার্থী'], ['teacher', 'শিক্ষক'], ['admin', 'অ্যাডমিন']];
  const LABEL = { guardian: 'অভিভাবক', student: 'শিক্ষার্থী', teacher: 'শিক্ষক', admin: 'অ্যাডমিন' };
  const TONES = [['info', 'সাধারণ'], ['warn', 'সতর্কবার্তা']];
  const BANNER_MAX = 300;

  // Sections and tiles per role, copied from the home screens (family.js g.home / s.home, teacher.js t.home).
  // Teacher and admin homes share the daily / exams / progress / talk sections; the admin-only ones are listed on their own.
  const TILE_REGISTRY = {
    guardian: [
      { title: 'পড়ালেখা ও অগ্রগতি', tiles: ['পরীক্ষার ফল', 'রেটিং ও প্রশংসা', 'শিক্ষা উপকরণ', 'ভয়েস মেসেজ', 'লক্ষ্য', 'সার্টিফিকেট'] },
      { title: 'যোগাযোগ ও নোটিশ', tiles: ['শিক্ষকের সাথে যোগাযোগ', 'শিক্ষকের সাথে মিটিং', 'সব নোটিশ', 'দৈনিক বার্তা', 'পরিচালকের বার্তা'] },
      { title: 'ফি ও অ্যাকাউন্ট', tiles: ['ফি ও পরিশোধ', 'পিন বদলান', 'আমার তথ্য ও গোপনীয়তা'] },
    ],
    student: [
      { title: 'পড়া ও ফলাফল', tiles: ['রিপোর্ট কার্ড', 'আমার রেটিং ও কার্ড', 'কুইজ ও লিডারবোর্ড', 'সিলেবাস ও বইয়ের পৃষ্ঠা', 'শিক্ষা উপকরণ', 'AI পড়ার সহায়ক', 'প্রশ্ন বক্স', 'ভুলের খাতা', 'ফ্ল্যাশকার্ড'] },
      { title: 'খেলা ও অভ্যাস', tiles: ['ফোকাস টাইমার', 'কুইজ ডুয়েল', 'সাপ্তাহিক চ্যালেঞ্জ', 'শব্দ ও বানান', 'শিক্ষামূলক খেলা', 'দৈনিক ধাঁধা', 'পয়েন্টের দোকান'] },
      { title: 'আমার জিনিস', tiles: ['আমার লক্ষ্য', 'সার্টিফিকেট', 'মুখস্থ পড়া ও ভয়েস', 'সব নোটিশ', 'পিন বদলাও'] },
    ],
    teacher: [
      { title: 'প্রতিদিনের ক্লাস', tiles: ['উপস্থিতি গ্রহণ', 'আজ কার হাজিরা', 'ক্লাস রেটিং', 'শিক্ষার্থীদের সংকেত', 'আগে বের হওয়ার সংকেত', 'প্রশ্ন বক্স', 'ভয়েস ও মুখস্থ পড়া', 'CCTV যাচাই'] },
      { title: 'পরীক্ষা ও ফলাফল', tiles: ['নম্বর এন্ট্রি', 'রিপোর্ট কার্ড ও টপার', 'পরীক্ষার রুটিন', 'পরীক্ষার পরিকল্পনা', 'প্রশ্ন ব্যাংক', 'AI প্রশ্নপত্র তৈরি', 'AI খাতা মূল্যায়ন', 'সিট প্ল্যান'] },
      { title: 'শিক্ষার্থী ও অগ্রগতি', tiles: ['ঝুঁকিতে থাকা শিক্ষার্থী', 'ব্যাচ তুলনা', 'সাপ্তাহিক চ্যালেঞ্জ', 'সিলেবাস ট্র্যাকার', 'ফ্ল্যাশকার্ড', 'শিক্ষা উপকরণ'] },
      { title: 'যোগাযোগ ও নোটিশ', tiles: ['নোটিশ পাঠান', 'সকল নোটিশ', 'অভিভাবকদের বার্তা', 'অভিভাবক মিটিং', 'পরিচালকের বার্তা'] },
      { title: 'অফিস', tiles: ['ছুটি ও বদলি', 'আমার সম্মানী', 'আমার অনুরোধ', 'পিন বদলান'] },
    ],
    admin: [
      { title: 'ব্যবস্থাপনা', tiles: ['অ্যাকাউন্ট ব্যবস্থাপনা', 'প্রোফাইল সম্পাদনা', 'ক্লাস রুটিন', 'পরিবর্তনের অনুরোধ', 'নম্বর সংশোধন', 'ফি ব্যবস্থাপনা', 'শিক্ষকদের সম্মানী', 'পরিবর্তনের ইতিহাস'] },
      { title: 'প্রতিদিনের ক্লাস', tiles: ['উপস্থিতি গ্রহণ', 'আজ কার হাজিরা', 'ক্লাস রেটিং', 'শিক্ষার্থীদের সংকেত', 'আগে বের হওয়ার সংকেত', 'প্রশ্ন বক্স', 'ভয়েস ও মুখস্থ পড়া', 'CCTV যাচাই'] },
      { title: 'পরীক্ষা ও ফলাফল', tiles: ['নম্বর এন্ট্রি', 'রিপোর্ট কার্ড ও টপার', 'পরীক্ষার রুটিন', 'পরীক্ষার পরিকল্পনা', 'প্রশ্ন ব্যাংক', 'AI প্রশ্নপত্র তৈরি', 'AI খাতা মূল্যায়ন', 'সিট প্ল্যান'] },
      { title: 'শিক্ষার্থী ও অগ্রগতি', tiles: ['ঝুঁকিতে থাকা শিক্ষার্থী', 'ব্যাচ তুলনা', 'সাপ্তাহিক চ্যালেঞ্জ', 'সিলেবাস ট্র্যাকার', 'ফ্ল্যাশকার্ড', 'শিক্ষা উপকরণ'] },
      { title: 'যোগাযোগ ও নোটিশ', tiles: ['নোটিশ পাঠান', 'সকল নোটিশ', 'অভিভাবকদের বার্তা', 'অভিভাবক মিটিং', 'পরিচালকের বার্তা'] },
      { title: 'আমার অফিস', tiles: ['ছুটি ও বদলি', 'পিন বদলান'] },
    ],
  };

  const flatTiles = role => TILE_REGISTRY[role].flatMap(s => s.tiles);
  const cfgKey = role => 'home.' + role;
  let st = null;          // the editor's state for the role on screen
  let seq = 0;            // latest open() wins when the role chips are tapped quickly
  let lastRole = 'guardian';

  /** Editor state from the saved row (or the defaults). Titles the editor does not know are kept as they are. */
  function loadState(role, row) {
    const c = homeCfgClean(row?.value) || { hide: [], order: [], rename: {}, banner: null };
    const names = flatTiles(role);
    const rank = t => { const i = c.order.indexOf(t); return i < 0 ? 1e9 : i; };
    const order = names.map((t, i) => ({ t, i })).sort((a, b) => rank(a.t) - rank(b.t) || a.i - b.i).map(x => x.t);
    return {
      role, row, order,
      hide: new Set(c.hide),
      rename: { ...c.rename },
      banner: c.banner ? { ...c.banner } : { text: '', tone: 'info', until: '' },
    };
  }

  /** The JSON to save: empty parts are left out, so a plain home saves {}. */
  function buildValue() {
    const v = {};
    if (st.hide.size) v.hide = [...st.hide];
    if (st.order.join('|') !== flatTiles(st.role).join('|')) v.order = st.order.slice();
    if (Object.keys(st.rename).length) v.rename = { ...st.rename };
    const b = st.banner, text = b.text.trim();
    if (text) v.banner = { text, tone: b.tone === 'warn' ? 'warn' : 'info', ...(b.until ? { until: b.until } : {}) };
    return v;
  }

  function moveTile(title, dir, sec) {
    const inSec = st.order.filter(t => sec.tiles.includes(t));
    const i = inSec.indexOf(title), j = i + dir;
    if (i < 0 || j < 0 || j >= inSec.length) return;
    const a = st.order.indexOf(inSec[i]), b = st.order.indexOf(inSec[j]);
    [st.order[a], st.order[b]] = [st.order[b], st.order[a]];
  }

  const swBtn = (title, hidden, attr) => `<button class="ctl-sw${hidden ? '' : ' on'}" role="switch" aria-checked="${hidden ? 'false' : 'true'}" ${attr}="${esc(title)}">${hidden ? 'লুকানো' : 'দেখাবে'}</button>`;

  function secsHtml() {
    return TILE_REGISTRY[st.role].map(sec => {
      const hidden = st.hide.has(sec.title), rn = st.rename[sec.title] || '';
      const tiles = st.order.filter(t => sec.tiles.includes(t));
      return `<div class="card ctl-sec${hidden ? ' off' : ''}">
        <div class="ctl-top"><h3>${esc(rn || sec.title)}</h3>${swBtn(sec.title, hidden, 'data-sec-hide')}</div>
        <div class="ctl-row"><input class="ctl-name" data-sec-name="${esc(sec.title)}" value="${esc(rn)}" placeholder="${esc(sec.title)}" maxlength="80" aria-label="${esc(sec.title)} এর নতুন নাম"></div>
        ${tiles.map((t, i) => `<div class="ctl-tile${st.hide.has(t) ? ' off' : ''}">
          <div class="ctl-top"><span class="ctl-tn">${esc(st.rename[t] || t)}</span>${swBtn(t, st.hide.has(t), 'data-hide')}</div>
          <div class="ctl-row"><input class="ctl-name" data-name="${esc(t)}" value="${esc(st.rename[t] || '')}" placeholder="${esc(t)}" maxlength="80" aria-label="${esc(t)} এর নতুন নাম">
            <button class="ctl-mv" data-mv="${esc(t)}" data-dir="-1" aria-label="উপরে নিন"${i === 0 ? ' disabled' : ''}>▲</button>
            <button class="ctl-mv" data-mv="${esc(t)}" data-dir="1" aria-label="নিচে নিন"${i === tiles.length - 1 ? ' disabled' : ''}>▼</button></div>
        </div>`).join('')}
      </div>`;
    }).join('');
  }

  function bannerHtml() {
    const b = st.banner;
    return `<div class="card ctl-banner">
      <h3>উপরের বার্তা</h3>
      <div class="mute small">হোমের একদম উপরে একটি কার্ড হয়ে দেখাবে। খালি রাখলে কিছু দেখাবে না।</div>
      <label for="ctl-bt">বার্তা (৩০০ অক্ষর পর্যন্ত)</label>
      <textarea id="ctl-bt" maxlength="${BANNER_MAX}">${esc(b.text)}</textarea>
      <div class="mute small" id="ctl-bc">${bn(b.text.length)}/${bn(BANNER_MAX)}</div>
      <div class="chips ctl-chips">${chipRow(TONES, b.tone, 'data-tone')}</div>
      <label for="ctl-bu">কবে পর্যন্ত দেখাবে (ঐচ্ছিক)</label>
      <input type="date" id="ctl-bu" value="${esc(b.until)}">
    </div>`;
  }

  /** Live preview: exactly what the role's home will draw for the current draft (same code path as the homes). */
  function preview(el) {
    const cfg = homeCfgClean(buildValue());
    let h = homeBanner(cfg);
    for (const sec of TILE_REGISTRY[st.role]) {
      const shown = applyHomeConfig(cfg, sec.title, sec.tiles.map(t => ['', t, '']));
      if (!shown) continue;
      h += `<div class="ctl-pv"><b>${esc(shown.title)}</b><div class="ctl-pv-tiles">${shown.tiles.map(t => `<span class="pill">${esc(t[1])}</span>`).join('')}</div></div>`;
    }
    el.querySelector('#ctl-pv').innerHTML = h || '<div class="mute">এই হোমে কিছুই দেখাবে না।</div>';
  }

  async function whoLine(el, row) {
    const box = el.querySelector('#ctl-meta');
    if (!box) return;
    if (!row?.updated_at) { box.textContent = 'এখনো কোনো বদল নেই। এই হোমটি ডিফল্ট রূপে চলছে।'; return; }
    box.textContent = `সর্বশেষ বদল: ${fmtDateY(row.updated_at)}, ${fmtTime(row.updated_at)}`;
    if (!row.updated_by) return;
    try {
      const p = await sel('profiles', `select=full_name&id=eq.${row.updated_by}`);
      if (p[0]?.full_name && st?.row === row) box.textContent += ` · ${p[0].full_name}`;
    } catch { /* the date is enough */ }
  }

  function paint(el) {
    el.innerHTML = `
      <div class="ctl-hint">এখানকার বদল সবার অ্যাপে কিছুক্ষণের মধ্যে দেখা যাবে।</div>
      <div class="chips ctl-chips" role="group" aria-label="কোন হোম">${chipRow(CTL_ROLES, st.role, 'data-role')}</div>
      <div class="mute small" id="ctl-meta"></div>
      <div id="ctl-banner">${bannerHtml()}</div>
      <div class="section">হোমে কী দেখাবে</div>
      <div id="ctl-secs">${secsHtml()}</div>
      <div class="section">এভাবে দেখাবে</div>
      <div class="card" id="ctl-pv"></div>
      <button class="btn" id="ctl-save">সংরক্ষণ</button>
      <button class="btn ghost" id="ctl-reset"${st.row ? '' : ' disabled'}>ডিফল্টে ফেরান</button>`;
    preview(el);
    whoLine(el, st.row);
  }

  /** Loads the role's row and draws the editor for it. */
  async function open(el, role) {
    const my = ++seq;
    lastRole = role;
    el.innerHTML = '<div class="skel"></div><div class="skel"></div>';
    let row = null;
    try {
      const rows = await sel('app_config', `select=value,updated_at,updated_by&key=eq.${cfgKey(role)}`);
      row = rows?.[0] || null;
    } catch (e) {
      if (my === seq) el.innerHTML = `<div class="card">${empty('wifi_off', `তথ্য আনা যায়নি${isOfflineErr(e) ? ' (ইন্টারনেট নেই?)' : ''}।`)}</div>`;
      return;
    }
    if (my !== seq) return;
    st = loadState(role, row);
    paint(el);
  }

  async function save(el, btn) {
    const role = st.role, coaching = S.me?.coaching_id;
    if (!coaching) return toast('আবার লগইন করে চেষ্টা করুন।');
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = 'সংরক্ষণ হচ্ছে…';
    try {
      const value = buildValue();
      const r = await upsert('app_config', { coaching_id: coaching, key: cfgKey(role), value }, 'coaching_id,key');
      const row = (Array.isArray(r) && r[0]) || { value, updated_at: new Date().toISOString(), updated_by: S.uid };
      if (st.role === role) {
        st.row = row;
        el.querySelector('#ctl-reset').disabled = false;
        whoLine(el, row);
      }
      toast('সংরক্ষণ হয়েছে। সবার অ্যাপে কিছুক্ষণের মধ্যে দেখা যাবে।');
    } catch {
      toast('সংরক্ষণ হয়নি। নেট দেখে আবার চেষ্টা করুন।');
    } finally {
      btn.disabled = false; btn.textContent = label;
    }
  }

  async function reset(el) {
    const role = st.role;
    const ok = await confirmSheet('ডিফল্টে ফেরাবেন?', `${esc(LABEL[role])}-এর হোমের সব বদল মুছে যাবে। সব অংশ আগের নামে ও আগের ক্রমে দেখাবে।`, 'হ্যাঁ, ফেরান', true);
    if (!ok) return;
    try {
      await del('app_config', `coaching_id=eq.${S.me.coaching_id}&key=eq.${cfgKey(role)}`);
    } catch {
      return toast('ফেরানো যায়নি। নেট দেখে আবার চেষ্টা করুন।');
    }
    toast('ডিফল্টে ফিরিয়ে দেওয়া হয়েছে।');
    open(el, role);
  }

  SCREENS['a.control'] = { title: 'সার্ভার থেকে নিয়ন্ত্রণ', sub: 'হোমে কী দেখাবে, কোন নামে', render: async (el) => {
    // One listener per screen element: the editor redraws its own parts, the events stay here.
    el.onclick = e => {
      const b = e.target.closest('button');
      if (!b || !st) return;
      if (b.dataset.role) return open(el, b.dataset.role);
      if (b.dataset.tone) { st.banner.tone = b.dataset.tone; el.querySelector('#ctl-banner').innerHTML = bannerHtml(); return preview(el); }
      if (b.id === 'ctl-save') return save(el, b);
      if (b.id === 'ctl-reset') return reset(el);
      if (b.dataset.secHide != null) return toggle(b.dataset.secHide, el);
      if (b.dataset.hide != null) return toggle(b.dataset.hide, el);
      if (b.dataset.mv != null) {
        const sec = TILE_REGISTRY[st.role].find(s => s.tiles.includes(b.dataset.mv));
        if (sec) moveTile(b.dataset.mv, +b.dataset.dir, sec);
        el.querySelector('#ctl-secs').innerHTML = secsHtml();
        preview(el);
      }
    };
    el.oninput = e => {
      const i = e.target;
      if (!st) return;
      if (i.id === 'ctl-bt') {
        st.banner.text = i.value.slice(0, BANNER_MAX);
        el.querySelector('#ctl-bc').textContent = `${bn(st.banner.text.length)}/${bn(BANNER_MAX)}`;
      } else if (i.id === 'ctl-bu') {
        st.banner.until = i.value;
      } else if (i.dataset.name != null || i.dataset.secName != null) {
        const key = i.dataset.name ?? i.dataset.secName, v = i.value.trim();
        if (v) st.rename[key] = v.slice(0, 80); else delete st.rename[key];
      } else return;
      preview(el);
    };
    await open(el, lastRole);
  } };

  function toggle(title, el) {
    if (st.hide.has(title)) st.hide.delete(title); else st.hide.add(title);
    el.querySelector('#ctl-secs').innerHTML = secsHtml();
    preview(el);
  }

  // ---------- "অভিভাবক-খবর ও ছুটি" (admin only): live/silent switch, silent-mode result, "আজ ছুটি", camera health ----------
  // Reads sender_settings (13-sender-config.sql; attendance_paused from 13b-holiday-switch.sql), silent_mode_report
  // (32-silent-mode.sql, P3-T3) and gate_cameras (30-gate-heartbeat.sql). The refusal to go live must also be enforced in SQL
  // (P3-T3/P3-T9); this screen only mirrors it.
  const NS_MIN_SAMPLE = 200;        // marks in the report window; default, owner to confirm (P3-T3)
  const NS_MISS_MAX = 2;            // missed arrivals must stay below 2 %
  const NS_CAM_OFFLINE_MS = 2 * 60000; // one camera heartbeat threshold (C24 proposal)
  const NS_LIVE = [['silent', 'চুপচাপ (খবর যায় না)'], ['live', 'লাইভ (খবর যায়)']];
  const NS_HOLIDAY = [['off', 'বন্ধ'], ['on', 'ছুটি চালু']];
  let NS = null;

  // Settled read: one failed section does not hide the others.
  const settle = p => p.then(v => ({ v }), e => ({ e }));

  // silent_mode_report columns (32-silent-mode.sql): marks, wrong_child, missed, missed_pct (a fraction), status.
  function nsVerdict(rep) {
    const marks = +rep?.marks || 0;
    const wrong = +rep?.wrong_child || 0;
    const missPct = rep?.missed_pct != null ? +rep.missed_pct * 100 : (marks ? (+rep.missed || 0) / marks * 100 : null);
    const ok = marks >= NS_MIN_SAMPLE && wrong === 0 && missPct < NS_MISS_MAX;
    return { ok, marks, wrong, missPct, insufficient: marks < NS_MIN_SAMPLE };
  }

  async function nsOpen(el) {
    el.innerHTML = skel(3);
    const coaching = S.me?.coaching_id;
    const [s, r, c] = await Promise.all([
      settle(sel('sender_settings', `select=silent_mode,attendance_paused&coaching_id=eq.${coaching}`)),
      settle(rpc('silent_mode_report', { p_from: daysAgo(14), p_to: dhakaToday() })),
      settle(sel('gate_cameras', 'select=camera_name,last_seen_at&order=camera_name')),
    ]);
    const cfg = s.v?.[0];
    NS = {
      settingsErr: !!s.e,
      silent: cfg ? cfg.silent_mode !== false : true,   // no row = the safe default (silent)
      paused: !!cfg?.attendance_paused,
      rep: r.e ? undefined : (Array.isArray(r.v) ? r.v[0] : r.v),
      repErr: !!r.e,
      cams: c.v || null,
      camsErr: !!c.e,
      now: Date.now(),
    };
    nsPaint(el);
  }

  function nsPaint(el) {
    const v = NS.rep ? nsVerdict(NS.rep) : null;
    let rep;
    if (NS.repErr) rep = `<div class="mute">ফল আনা যায়নি।</div>`;
    else if (!v) rep = `<div class="mute">এখনো ফল নেই।</div>`;
    else rep = `
      <div>ভুল-শিশু মিল: <b class="${v.wrong === 0 ? 'ok' : 'bad'}">${bn(v.wrong)}</b> <span class="mute small">(লক্ষ্য ০)</span></div>
      <div>মিস করা আসা: <b class="${v.missPct !== null && v.missPct < NS_MISS_MAX ? 'ok' : 'bad'}">${v.missPct === null ? '—' : bn(v.missPct.toFixed(1)) + '%'}</b> <span class="mute small">(লক্ষ্য ${bn(NS_MISS_MAX)}%-এর কম)</span></div>
      <div class="mute small">নমুনা: ${bn(v.marks)} হাজিরা${v.insufficient ? ` · অপর্যাপ্ত, অন্তত ${bn(NS_MIN_SAMPLE)} লাগবে` : ''}</div>
      <div class="small"><b class="${v.ok ? 'ok' : 'bad'}">${v.ok ? 'শর্ত পূরণ হয়েছে' : 'শর্ত এখনো পূরণ হয়নি'}</b></div>`;

    let cams;
    if (NS.camsErr) cams = `<div class="mute">ক্যামেরার খবর আনা যায়নি।</div>`;
    else if (!NS.cams?.length) cams = `<div class="mute">এখনো কোনো ক্যামেরার খবর আসেনি।</div>`;
    else cams = NS.cams.map(x => {
      const on = NS.now - new Date(x.last_seen_at).getTime() <= NS_CAM_OFFLINE_MS;
      return `<div class="row-line"><span>${esc(x.camera_name)}</span><span class="small mute">${esc(fmtTime(x.last_seen_at))}</span> <b class="${on ? 'ok' : 'bad'}">${on ? 'চালু' : 'সাড়া নেই'}</b></div>`;
    }).join('');

    el.innerHTML = `
      <div class="ctl-hint">অভিভাবকদের ফোনে খবর যাবে কিনা, এখান থেকে ঠিক হয়।</div>
      ${NS.settingsErr ? '<div class="card"><div class="mute">সেটিং আনা যায়নি। নেট দেখে আবার চেষ্টা করুন।</div></div>' : ''}
      <div class="section">অভিভাবক-খবর</div>
      <div class="card">
        <h3>খবর কীভাবে যাবে</h3>
        <div class="mute small">চুপচাপ মোডে হাজিরার খবর যায় না, শুধু লগে থাকে। লাইভ করতে হলে নিচের "চুপচাপ মোডের ফল" শর্ত পূরণ হতে হবে।</div>
        <div class="chips" role="group" aria-label="খবর চালু বা বন্ধ">${chipRow(NS_LIVE, NS.silent ? 'silent' : 'live', 'data-live')}</div>
      </div>
      <div class="section">চুপচাপ মোডের ফল (শেষ ১৪ দিন)</div>
      <div class="card" id="ns-report">${rep}</div>
      <div class="section">আজ ছুটি</div>
      <div class="card">
        <div class="mute small">"ছুটি চালু" থাকলে হাজিরার স্বয়ংক্রিয় খবর (এসেছে, অনুপস্থিত, দেরি, বের হয়েছে) যাবে না। জরুরি নোটিশ যাবে।</div>
        <div class="chips" role="group" aria-label="আজ ছুটি">${chipRow(NS_HOLIDAY, NS.paused ? 'on' : 'off', 'data-holiday')}</div>
      </div>
      <div class="section">ক্যামেরা</div>
      <div class="card"><div class="mute small">২ মিনিটের বেশি সাড়া না পেলে ক্যামেরা "সাড়া নেই"।</div>${cams}</div>
      <button class="btn ghost" id="ns-reload">আবার দেখুন</button>`;
    el.querySelectorAll('button[data-live],button[data-holiday]').forEach(b => { if (NS.settingsErr) b.disabled = true; });
  }

  async function nsSave(el, patch, msg) {
    const coaching = S.me?.coaching_id;
    if (!coaching) return toast('আবার লগইন করে চেষ্টা করুন।');
    try {
      await upsert('sender_settings', { coaching_id: coaching, ...patch }, 'coaching_id');
    } catch (e) {
      // 36-legal-signoff.sql refuses silent_mode=false until the legal sign-off is recorded.
      if (patch.silent_mode === false && /legal sign-off/i.test(e.body || '')) return toast('আইনি সম্মতি (legal sign-off) এখনো নেওয়া হয়নি। তাই খবর লাইভ করা যাবে না।');
      return toast('সংরক্ষণ হয়নি। নেট দেখে আবার চেষ্টা করুন।');
    }
    toast(msg);
    nsOpen(el);
  }

  async function nsSetLive(el, live) {
    if (live === !NS.silent) return;
    if (live) {
      if (!NS.rep || !nsVerdict(NS.rep).ok) return toast('শর্ত পূরণ হয়নি। খবর চুপচাপ মোডেই থাকবে।');
      const yes = await confirmSheet('অভিভাবক-খবর চালু করবেন?', 'এরপর হাজিরার খবর সত্যিই অভিভাবকদের ফোনে যাবে।', 'হ্যাঁ, চালু করুন');
      if (!yes) return nsOpen(el);
    }
    nsSave(el, { silent_mode: !live }, live ? 'খবর চালু হয়েছে।' : 'চুপচাপ মোডে ফেরানো হয়েছে।');
  }

  SCREENS['a.notices'] = { title: 'অভিভাবক-খবর ও ছুটি', sub: 'খবর চালু বা বন্ধ, ক্যামেরা', render: async (el) => {
    el.onclick = e => {
      const b = e.target.closest('button');
      if (!b || !NS) return;
      if (b.id === 'ns-reload') return nsOpen(el);
      if (b.dataset.live != null) return nsSetLive(el, b.dataset.live === 'live');
      if (b.dataset.holiday != null) {
        const on = b.dataset.holiday === 'on';
        if (on !== NS.paused) nsSave(el, { attendance_paused: on }, on ? 'আজ ছুটি চালু হয়েছে।' : 'আজ ছুটি বন্ধ হয়েছে।');
      }
    };
    await nsOpen(el);
  } };

  // ---------- চ্যাট রিপোর্ট (admin only): reported student chat messages (P4-T4, plan C10) ----------
  // Reads the view chat_report_queue (41-chat-reports.sql: open reports only); closes with rpc resolve_chat_report.
  // Only phrases and stickers exist in chat, so the queue shows the phrase label, never free text.
  const CHAT_REASON = { rude: 'খারাপ কথা', unsafe: 'বিপজ্জনক', personal_info: 'ব্যক্তিগত তথ্য', other: 'অন্য' };
  SCREENS['a.chatreports'] = { title: 'চ্যাট রিপোর্ট', sub: 'রিপোর্ট করা বার্তা', render: async (el) => {
    const rows = await sel('chat_report_queue', 'select=report_id,sender_id,reason,reported_at,phrase_label&order=reported_at.desc&limit=100');
    // The view has only sender_id; read the names in a second query (embeds do not work through views).
    const names = {};
    if (rows.length) (await sel('profiles', `select=id,full_name&id=${inList([...new Set(rows.map(r => r.sender_id))])}`).catch(() => [])).forEach(p => names[p.id] = p.full_name);
    el.innerHTML = `<div class="ctl-hint">শিক্ষার্থী বা অভিভাবক যে বার্তা রিপোর্ট করেছেন, সেগুলো এখানে। দেখে "ঠিক আছে" চাপুন।</div>`
      + (rows.map(r => `<div class="card coral"><div class="mute small">${fmtDate(r.reported_at)} · ${esc(CHAT_REASON[r.reason] || r.reason)}</div><h3>${esc(r.phrase_label || '—')}</h3><div class="mute small">পাঠিয়েছেন: ${esc(names[r.sender_id] || '—')}</div><button class="pill good" data-rep="${esc(r.report_id)}" style="margin-top:6px">ঠিক আছে</button></div>`).join('') || empty('alert', 'এখন কোনো রিপোর্ট নেই।'));
    el.querySelectorAll('[data-rep]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      try { await rpc('resolve_chat_report', { p_report: b.dataset.rep }); toast('ঠিক আছে হিসেবে বন্ধ হয়েছে।'); SCREENS['a.chatreports'].render(el); }
      catch { b.disabled = false; toast('হয়নি'); }
    });
  } };
})();

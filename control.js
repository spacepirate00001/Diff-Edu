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
      { title: 'প্রতিদিনের ক্লাস', tiles: ['উপস্থিতি গ্রহণ', 'আজ কার হাজিরা', 'ক্লাস রেটিং', 'শিক্ষার্থীদের সংকেত', 'প্রশ্ন বক্স', 'ভয়েস ও মুখস্থ পড়া', 'CCTV যাচাই'] },
      { title: 'পরীক্ষা ও ফলাফল', tiles: ['নম্বর এন্ট্রি', 'রিপোর্ট কার্ড ও টপার', 'পরীক্ষার রুটিন', 'পরীক্ষার পরিকল্পনা', 'প্রশ্ন ব্যাংক', 'AI প্রশ্নপত্র তৈরি', 'AI খাতা মূল্যায়ন', 'সিট প্ল্যান'] },
      { title: 'শিক্ষার্থী ও অগ্রগতি', tiles: ['ঝুঁকিতে থাকা শিক্ষার্থী', 'ব্যাচ তুলনা', 'সাপ্তাহিক চ্যালেঞ্জ', 'সিলেবাস ট্র্যাকার', 'ফ্ল্যাশকার্ড', 'শিক্ষা উপকরণ'] },
      { title: 'যোগাযোগ ও নোটিশ', tiles: ['নোটিশ পাঠান', 'সকল নোটিশ', 'অভিভাবকদের বার্তা', 'অভিভাবক মিটিং', 'পরিচালকের বার্তা'] },
      { title: 'অফিস', tiles: ['ছুটি ও বদলি', 'আমার সম্মানী', 'আমার অনুরোধ', 'পিন বদলান'] },
    ],
    admin: [
      { title: 'ব্যবস্থাপনা', tiles: ['অ্যাকাউন্ট ব্যবস্থাপনা', 'প্রোফাইল সম্পাদনা', 'ক্লাস রুটিন', 'পরিবর্তনের অনুরোধ', 'নম্বর সংশোধন', 'ফি ব্যবস্থাপনা', 'শিক্ষকদের সম্মানী', 'পরিবর্তনের ইতিহাস'] },
      { title: 'প্রতিদিনের ক্লাস', tiles: ['উপস্থিতি গ্রহণ', 'আজ কার হাজিরা', 'ক্লাস রেটিং', 'শিক্ষার্থীদের সংকেত', 'প্রশ্ন বক্স', 'ভয়েস ও মুখস্থ পড়া', 'CCTV যাচাই'] },
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
})();

'use strict';
// "লেখা বদলান" (admin only): replace any text the apps show, found by its exact default text.
// Saves one app_config row (key 'strings') = { "<default text>": "<replacement>" }. app.js (applyTextOverrides) draws it everywhere
// except on this screen, which always shows the originals.
// The search list is app/pwa/strings-index.json (made by tools/gen-strings-index.py), fetched when the screen opens.
(function () {
  let INDEX = null;     // [{t, a, w}]: text, found in Android, found in PWA
  let ov = {};          // the saved map (working copy)
  let tab = 'find';     // 'find' | 'list'
  let q = '';           // search text
  let shown = [];       // the results on screen (index for the save buttons)
  let listKeys = [];    // the overrides on screen (index for the undo buttons)
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  async function fetchIndex() {
    if (INDEX) return INDEX;
    const r = await fetch('strings-index.json');
    if (!r.ok) throw new Error('index ' + r.status);
    const j = await r.json();
    if (!Array.isArray(j)) throw new Error('index shape');
    INDEX = j;
    return INDEX;
  }

  function findHtml() {
    return `<label class="txt-label" for="txt-q">কোন লেখা বদলাতে চান? খুঁজুন</label>
      <input id="txt-q" class="txt-q" type="search" value="${esc(q)}" placeholder="কোন লেখা বদলাতে চান? খুঁজুন" aria-label="কোন লেখা বদলাতে চান? খুঁজুন" autocomplete="off">
      <div id="txt-res">${resultsHtml()}</div>`;
  }

  function resultsHtml() {
    const needle = q.trim().toLowerCase();
    if (!needle) return '<div class="mute">উপরের ঘরে লিখে খুঁজুন। যেমন: "পরীক্ষা", "ফি"।</div>';
    const hits = (INDEX || []).filter(x => x.t.toLowerCase().includes(needle));
    shown = hits.slice(0, 40);
    if (!shown.length) return '<div class="mute">এই শব্দে কোনো লেখা পাওয়া যায়নি।</div>';
    const more = hits.length > shown.length ? `<div class="mute small">${bn(hits.length)}টির মধ্যে প্রথম ${bn(shown.length)}টি দেখানো হচ্ছে। আরও নির্দিষ্ট করে লিখুন।</div>` : '';
    return more + shown.map(itemHtml).join('');
  }

  function itemHtml(x, i) {
    const changed = has(ov, x.t), now = changed ? ov[x.t] : x.t;
    return `<div class="card txt-item">
      <div class="txt-pills">${x.a ? '<span class="pill">অ্যান্ড্রয়েড</span>' : ''}${x.w ? '<span class="pill">PWA</span>' : ''}${changed ? '<span class="pill teal">বদলানো আছে</span>' : ''}</div>
      <div class="txt-row"><span class="small mute">আসল লেখা</span><div class="txt-orig">${esc(x.t)}</div></div>
      <label class="txt-label" for="txt-ta-${i}">নতুন লেখা</label>
      <textarea id="txt-ta-${i}" class="txt-ta" data-i="${i}" maxlength="${TXT_LEN}">${esc(now)}</textarea>
      <button class="btn" data-save="${i}">সংরক্ষণ</button>
    </div>`;
  }

  function listHtml() {
    listKeys = Object.keys(ov).sort((a, b) => a.localeCompare(b, 'bn'));
    if (!listKeys.length) return empty('letters', 'এখনো কোনো লেখা বদলানো হয়নি।');
    return listKeys.map((from, i) => `<div class="card txt-item">
        <div class="txt-row"><span class="small mute">আসল লেখা</span><div class="txt-orig">${esc(from)}</div></div>
        <div class="txt-row"><span class="small mute">এখন যা দেখাবে</span><div class="txt-new">${esc(ov[from])}</div></div>
        <button class="btn ghost" data-undo="${i}">ফিরিয়ে দিন</button>
      </div>`).join('') + '<button class="btn coral" id="txt-all">সব ফিরিয়ে দিন</button>';
  }

  /** The whole screen body: hint, limits, the two tabs, then the chosen tab. */
  function paint(el) {
    const n = Object.keys(ov).length;
    el.innerHTML = `
      <div class="txt-hint">এখানকার বদল সবার অ্যাপে কিছুক্ষণের মধ্যে দেখা যাবে। শুধু হুবহু এই লেখাটি যেখানে আছে সেখানেই বদলাবে।</div>
      <div class="mute small">সর্বোচ্চ ${bn(TXT_MAX)}টি লেখা, প্রতিটি ${bn(TXT_LEN)} অক্ষরের মধ্যে।</div>
      <div class="chips ctl-chips" role="group" aria-label="কোন অংশ">${chipRow([['find', 'খুঁজুন'], ['list', `বদলানো লেখা (${bn(n)})`]], tab, 'data-tab')}</div>
      <div id="txt-body">${tab === 'list' ? listHtml() : findHtml()}</div>`;
  }

  /** Writes the WHOLE map (or deletes the row when it is empty), then keeps this phone's copy in step. */
  async function write(el, next, btn) {
    const coaching = S.me?.coaching_id;
    if (!coaching) return toast('আবার লগইন করে চেষ্টা করুন।');
    const label = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'সংরক্ষণ হচ্ছে…'; }
    try {
      if (Object.keys(next).length) await upsert('app_config', { coaching_id: coaching, key: 'strings', value: next }, 'coaching_id,key');
      else await del('app_config', `coaching_id=eq.${coaching}&key=eq.strings`);
      ov = { ...next };
      setTextOverrides(ov);
      toast('সংরক্ষণ হয়েছে। সবার অ্যাপে কিছুক্ষণের মধ্যে দেখা যাবে।');
      paint(el);
    } catch {
      toast('সংরক্ষণ হয়নি। নেট দেখে আবার চেষ্টা করুন।');
      if (btn?.isConnected) { btn.disabled = false; btn.textContent = label; }
    }
  }

  async function save(el, i, btn) {
    const x = shown[i];
    const ta = el.querySelector(`textarea[data-i="${i}"]`);
    if (!x || !ta) return;
    const to = ta.value.trim();
    if (!to) return toast('খালি রাখা যাবে না। আসল লেখায় ফিরতে চাইলে "ফিরিয়ে দিন" ব্যবহার করুন।');
    if (to.length > TXT_LEN) return toast(`একটি লেখা ${bn(TXT_LEN)} অক্ষরের বেশি হবে না।`);
    const next = { ...ov };
    if (to === x.t) {
      if (!has(ov, x.t)) return toast('এই লেখা আগের মতোই আছে।');
      delete next[x.t];                       // back to the original: the pair goes
    } else {
      if (!has(ov, x.t) && Object.keys(ov).length >= TXT_MAX) return toast(`সর্বোচ্চ ${bn(TXT_MAX)}টি লেখা বদলানো যাবে।`);
      next[x.t] = to;
    }
    await write(el, next, btn);
  }

  async function undo(el, i, btn) {
    const from = listKeys[i];
    if (!from || !has(ov, from)) return;
    const next = { ...ov };
    delete next[from];
    await write(el, next, btn);
  }

  async function resetAll(el, btn) {
    const ok = await confirmSheet('সব ফিরিয়ে দেবেন?', 'সব বদল মুছে যাবে। অ্যাপে আগের সব লেখাই আবার দেখাবে। আবার বদলাতে চাইলে নতুন করে লিখতে হবে।', 'হ্যাঁ, সব ফেরান', true);
    if (!ok) return;
    await write(el, {}, btn);
  }

  async function open(el) {
    tab = 'find'; q = '';
    el.innerHTML = '<div class="skel"></div><div class="skel"></div>';
    try {
      const [rows, idx] = await Promise.all([
        sel('app_config', 'select=value&key=eq.strings&limit=1'),
        fetchIndex(),
      ]);
      ov = Object.fromEntries(textOverridesClean(rows?.[0]?.value ?? null));
      setTextOverrides(ov);
      INDEX = idx;
    } catch (e) {
      el.innerHTML = `<div class="card">${empty('wifi_off', `তথ্য আনা যায়নি${isOfflineErr(e) ? ' (ইন্টারনেট নেই?)' : ''}।`)}</div>`;
      return;
    }
    paint(el);
  }

  SCREENS['a.texts'] = { title: 'লেখা বদলান', sub: 'অ্যাপের যেকোনো লেখা এখান থেকে বদলান', render: async (el) => {
    el.setAttribute('data-no-override', '');       // the editor always shows the originals
    el.onclick = e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.tab) { tab = b.dataset.tab; return paint(el); }
      if (b.dataset.save != null) return save(el, +b.dataset.save, b);
      if (b.dataset.undo != null) return undo(el, +b.dataset.undo, b);
      if (b.id === 'txt-all') return resetAll(el, b);
    };
    el.oninput = e => {
      if (e.target.id !== 'txt-q') return;
      q = e.target.value;
      const box = el.querySelector('#txt-res');
      if (box) box.innerHTML = resultsHtml();
    };
    await open(el);
  } };
})();

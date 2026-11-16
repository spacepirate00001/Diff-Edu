'use strict';
// Topic videos + in-app player. Videos live in the existing `materials` table (kind = 'video', url = YouTube link,
// subject_id + chapter = the topic), so no schema change is needed. Playback is always inside the app (YouTube's
// embed player in a frame) — nobody is sent to the YouTube app or site.
(function () {
  // ---------- YouTube link parsing ----------
  const ytId = u => {
    u = String(u || '').trim();
    if (/^[\w-]{11}$/.test(u)) return u;
    try {
      const x = new URL(u), h = x.hostname.replace(/^(www|m|music)\./, '');
      if (h === 'youtu.be') return x.pathname.slice(1).split('/')[0].match(/^[\w-]{11}$/)?.[0] || '';
      if (h === 'youtube.com' || h === 'youtube-nocookie.com') {
        if (x.searchParams.get('v')) return x.searchParams.get('v').match(/^[\w-]{11}$/)?.[0] || '';
        const m = x.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/); if (m) return m[1];
      }
    } catch {}
    return '';
  };
  window.ytId = ytId;
  const norm = s => String(s || '').toLowerCase().replace(/[\s:：,.\-–—_()?!।]+/g, ' ').trim();

  // ---------- the in-app player ----------
  // list: [{ id (youtube id), title, sub }], i: start index
  window.playVideo = function (list, i = 0) {
    if (navigator.onLine === false) return toast('ভিডিও দেখতে ইন্টারনেট লাগবে');
    list = (list || []).filter(v => v.id); if (!list.length) return toast('ভিডিও পাওয়া যায়নি');
    document.getElementById('vplayer')?.remove();
    const d = document.createElement('div'); d.id = 'vplayer'; d.className = 'vp';
    const draw = () => {
      const v = list[i];
      d.innerHTML = `<div class="vp-top"><button class="vp-x" data-x aria-label="বন্ধ করো">✕</button><div class="vp-t"><b>${esc(v.title)}</b>${v.sub ? `<span>${esc(v.sub)}</span>` : ''}</div></div>
        <div class="vp-box"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.id)}?autoplay=1&rel=0&modestbranding=1&playsinline=1&fs=1&disablekb=1&iv_load_policy=3" title="${esc(v.title)}" sandbox="allow-scripts allow-same-origin allow-presentation" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
        ${list.length > 1 ? `<div class="vp-list"><div class="vp-h">এই টপিকের আরও ভিডিও (${bn(i + 1)}/${bn(list.length)})</div>${list.map((x, k) => `<button class="vp-i ${k === i ? 'on' : ''}" data-k="${k}"><img src="https://i.ytimg.com/vi/${encodeURIComponent(x.id)}/mqdefault.jpg" alt="" loading="lazy"><span>${esc(x.title)}</span></button>`).join('')}</div>` : ''}`;
      d.querySelector('[data-x]').onclick = () => close();
      d.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { i = +b.dataset.k; draw(); });
    };
    // closing with ✕ also drops the history entry pushed above, so the next back press leaves the page as usual
    const close = (fromPop) => { d.remove(); document.body.style.overflow = ''; window.removeEventListener('popstate', onPop); if (!fromPop && history.state?.vp) history.back(); };
    const onPop = () => close(true);
    history.pushState({ vp: 1 }, ''); window.addEventListener('popstate', onPop); // phone back button closes the player first
    document.body.style.overflow = 'hidden';
    document.body.appendChild(d); draw();
  };

  // ---------- data ----------
  const VSEL = 'select=id,chapter,title,url,class_level,subject:subjects(id,name,name_bn)';
  const videosOf = cls => cached('vid' + cls, () => sel('materials', `${VSEL}&class_level=eq.${cls}&kind=eq.video&order=created_at`))
    .then(r => r.map(m => ({ ...m, yt: ytId(m.url) })).filter(m => m.yt));
  const subjName = m => m.subject?.name_bn || m.subject?.name || 'অন্যান্য';
  const toItem = m => ({ id: m.yt, title: m.title, sub: [subjName(m), m.chapter].filter(Boolean).join(' · ') });
  // Videos for a topic: same subject (when known) and the chapter text and the topic text contain each other.
  function matchVideos(vids, subject, topic) {
    const t = norm(topic), s = norm(subject);
    return vids.filter(m => {
      if (s) { const a = norm(m.subject?.name), b = norm(m.subject?.name_bn); if (a !== s && b !== s && !(a && (s.includes(a) || a.includes(s)))) return false; }
      const c = norm(m.chapter); if (!c) return false;
      // title counts only as whole words: a title "আলো" must not match the topic "আলোর প্রতিসরণ"
      const tt = norm(m.title);
      return t.includes(c) || c.includes(t) || (!!tt && (' ' + t + ' ').includes(' ' + tt + ' '));
    });
  }
  window.TopicVideos = { videosOf, matchVideos, toItem };

  // "ভিডিও দেখো" sheet for one topic (used by বুঝিনি, syllabus)
  window.topicVideoSheet = function (vids, topic) {
    if (!vids.length) return false;
    if (vids.length === 1) { playVideo(vids.map(toItem)); return true; }
    sheet(`<h2>${esc(topic)}</h2><div class="mute">ভিডিও বেছে নাও, অ্যাপের ভেতরেই চলবে।</div>${vids.map((m, k) => `<div class="card tap" data-v="${k}" style="display:flex;gap:10px;align-items:center"><span class="vp-play">▶</span><h3>${esc(m.title)}</h3></div>`).join('')}<button class="link" data-close>বন্ধ করো</button>`, (s, close) => {
      s.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { close(); playVideo(vids.map(toItem), +b.dataset.v); });
    });
    return true;
  };

  // ---------- online class (students, guardians, teachers) ----------
  let osubj = null;
  SCREENS.online = { title: 'অনলাইন ক্লাস', sub: c => 'ক্লাস ' + bn(c), render: async (el, cls) => {
    cls = +cls || 6;
    const vids = await videosOf(cls);
    const subs = [...new Set(vids.map(subjName))];
    if (!subs.includes(osubj)) osubj = subs[0] || null;
    const shown = vids.filter(m => subjName(m) === osubj);
    const by = {}; shown.forEach(m => (by[m.chapter || 'সাধারণ'] ||= []).push(m));
    el.innerHTML = (subs.length > 1 ? chipRow(subs.map(s => [s, s]), osubj, 'data-subj') : '') +
      (Object.entries(by).map(([ch, l]) => `<div class="card"><h3>${esc(ch)}</h3>${l.map(m => `<div class="row tap" data-play="${m.id}" style="gap:10px;align-items:center"><span class="vp-play">▶</span><span style="flex:1">${esc(m.title)}</span></div>`).join('')}</div>`).join('') ||
        empty('book', 'এই ক্লাসের ভিডিও এখনো যোগ করা হয়নি।'));
    el.querySelectorAll('[data-subj]').forEach(b => b.onclick = () => { osubj = b.dataset.subj; render(); });
    el.querySelectorAll('[data-play]').forEach(b => b.onclick = () => {
      const k = shown.findIndex(m => m.id === b.dataset.play), m = shown[k];
      const same = shown.filter(x => x.chapter === m.chapter); // playlist = same chapter
      playVideo(same.map(toItem), same.findIndex(x => x.id === m.id));
    });
  } };

  // ---------- add / manage links (teacher, admin) ----------
  const V = { cls: 6, subj: '', ch: '' };
  SCREENS['t.videos'] = { title: 'ভিডিও লিংক যোগ', sub: 'টপিক অনুযায়ী ইউটিউব ভিডিও', render: async (el) => {
    const [chs, subs, vids] = await Promise.all([
      sel('chapters', `select=subject,number,title&class_level=eq.${V.cls}&order=subject,number`).catch(() => []),
      sel('subjects', `select=id,name,name_bn&class_level=eq.${V.cls}&order=created_at`).catch(() => []),
      videosOf(V.cls).catch(() => []),
    ]);
    const seen = new Set(), sl = subs.filter(s => !seen.has(s.name) && seen.add(s.name));
    if (!sl.some(s => s.name === V.subj)) { V.subj = sl[0]?.name || ''; V.ch = ''; }
    const chl = chs.filter(c => c.subject === V.subj || sl.find(s => s.name === V.subj)?.name_bn === c.subject);
    const mine = vids.filter(m => m.subject?.name === V.subj);
    el.innerHTML = chipRow(CLASSES.map(c => [c, 'ক্লাস ' + bn(c)]), V.cls) +
      `<div class="card"><label>বিষয়</label><select id="vs">${sl.map(s => `<option value="${esc(s.name)}" ${s.name === V.subj ? 'selected' : ''}>${esc(s.name_bn || s.name)}</option>`).join('') || '<option value="">কোনো বিষয় নেই</option>'}</select>
      <label>টপিক / অধ্যায়</label><select id="vc"><option value="">— অধ্যায় বাছুন —</option>${chl.map(c => `<option value="${esc(c.title)}" ${c.title === V.ch ? 'selected' : ''}>${bn(c.number)}. ${esc(c.title)}</option>`).join('')}</select>
      <input id="vcx" maxlength="120" placeholder="অথবা টপিকের নাম নিজে লিখুন" style="margin-top:6px">
      <label>ভিডিও লিংক (প্রতি লাইনে একটি; চাইলে "শিরোনাম | লিংক")</label><textarea id="vl" rows="5" placeholder="https://youtu.be/xxxxxxxxxxx&#10;ভগ্নাংশের যোগ | https://www.youtube.com/watch?v=xxxxxxxxxxx"></textarea>
      <div class="err" id="verr"></div><button class="btn" id="vgo">ভিডিও যোগ করুন</button></div>` +
      section('এই বিষয়ে যোগ করা ভিডিও (' + bn(mine.length) + ')') +
      (mine.map(m => `<div class="card" style="display:flex;gap:10px;align-items:center"><span class="vp-play" data-pl="${m.id}">▶</span><div style="flex:1"><h3>${esc(m.title)}</h3><div class="mute small">${esc(m.chapter || 'টপিক নেই')}</div></div><button class="pill" data-vd="${m.id}">মুছুন</button></div>`).join('') || '<div class="mute">এখনো কোনো ভিডিও নেই।</div>');
    el.querySelectorAll('[data-chip]').forEach(b => b.onclick = () => { V.cls = +b.dataset.chip; V.subj = ''; V.ch = ''; render(); });
    el.querySelector('#vs').onchange = e => { V.subj = e.target.value; V.ch = ''; render(); };
    el.querySelector('#vc').onchange = e => { V.ch = e.target.value; };
    el.querySelectorAll('[data-pl]').forEach(b => b.onclick = () => playVideo(mine.map(toItem), mine.findIndex(x => x.id === b.dataset.pl)));
    el.querySelectorAll('[data-vd]').forEach(b => b.onclick = async () => {
      if (!await confirmSheet('মুছবেন?', 'ভিডিওটি তালিকা থেকে সরে যাবে।', 'মুছুন', true)) return;
      try { await del('materials', `id=eq.${b.dataset.vd}`); render(); } catch { toast('হয়নি'); }
    });
    el.querySelector('#vgo').onclick = async () => {
      const err = el.querySelector('#verr'), btn = el.querySelector('#vgo'); err.textContent = '';
      const topic = el.querySelector('#vcx').value.trim() || el.querySelector('#vc').value;
      const rows = el.querySelector('#vl').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
        const p = l.split('|'), url = p.pop().trim(), t = p.join('|').trim();
        return { url, t, id: ytId(url) };
      });
      if (!V.subj) return err.textContent = 'আগে বিষয় বাছুন।';
      if (!topic) return err.textContent = 'টপিক বাছুন বা লিখুন — নইলে সমস্যা জানালে ভিডিও মিলবে না।';
      if (!rows.length) return err.textContent = 'অন্তত একটি ইউটিউব লিংক দিন।';
      const bad = rows.filter(r => !r.id); if (bad.length) return err.textContent = `${bn(bad.length)}টি লিংক ইউটিউবের নয়: ${bad[0].url.slice(0, 40)}`;
      btn.disabled = true; btn.textContent = 'যোগ হচ্ছে…';
      try {
        let sid = sl.find(s => s.name === V.subj)?.id;
        if (!sid) sid = (await ins('subjects', { coaching_id: S.me.coaching_id, class_level: V.cls, name: V.subj }, 'select=id'))?.[0]?.id;
        const have = new Set(vids.map(m => m.yt + '|' + norm(m.chapter)));
        const fresh = rows.filter((r, k) => !have.has(r.id + '|' + norm(topic)) && rows.findIndex(x => x.id === r.id) === k);
        if (!fresh.length) { btn.disabled = false; btn.textContent = 'ভিডিও যোগ করুন'; return err.textContent = 'এই ভিডিওগুলো এই টপিকে আগেই আছে।'; }
        await ins('materials', fresh.map((r, k) => ({ coaching_id: S.me.coaching_id, class_level: V.cls, subject_id: sid || null, chapter: topic, title: r.t || `${topic} — ভিডিও ${bn(mine.filter(m => norm(m.chapter) === norm(topic)).length + k + 1)}`, kind: 'video', url: 'https://youtu.be/' + r.id })), 'select=id');
        toast(`${bn(fresh.length)}টি ভিডিও যোগ হয়েছে`); V.ch = ''; render();
      } catch { err.textContent = 'যোগ করা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন (শিক্ষক/অ্যাডমিন অ্যাকাউন্ট লাগবে)।'; btn.disabled = false; btn.textContent = 'ভিডিও যোগ করুন'; }
    };
  } };
})();

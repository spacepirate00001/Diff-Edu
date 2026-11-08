'use strict';
// Teacher & admin screens (PWA). Mirrors the APK: TeacherHomeScreen, TakeAttendanceScreen, RateClassScreen,
// ShiftStudentsScreen. Writes go through writeOrQueue so they survive a lost connection.
(function () {
  const RATING_DEFAULT = { behavior: 3, homework: 3, performance: 2 }; // 8/10, same as RatingScale.default
  const rosterOf = s => cached('roster.' + s, async () => {
    const b = await sel('batches', `select=id&shift=eq.${s}`);
    if (!b.length) return [];
    return sel('students', `select=id,class_level,roll,profile:profiles!students_profile_id_fkey(full_name)&batch_id=${inList(b.map(x => x.id))}&active=is.true&order=roll`);
  });
  const nameOf = st => st.profile?.full_name || 'শিক্ষার্থী';
  const rollNum = st => parseInt(ascii(st.roll), 10) || 999;
  const sortRoster = l => l.slice().sort((a, b) => a.class_level - b.class_level || rollNum(a) - rollNum(b));
  const fmtScore = v => bn(Number.isInteger(+v) ? +v : (+v).toFixed(1));
  const total = r => +r.behavior + +r.homework + +r.performance;
  const hwLabel = v => +v === 0 ? 'করেনি' : +v === 3 ? 'করেছে' : 'আধা';
  const contactsP = () => cached('contacts', async () => {
    const rows = await sel('guardian_students', 'select=student_id,relation,guardian:profiles!guardian_students_guardian_id_fkey(full_name,phone)&limit=5000');
    const m = {};
    rows.forEach(o => { if (o.guardian?.phone) (m[o.student_id] ||= []).push({ name: o.guardian.full_name, relation: o.relation || '', phone: o.guardian.phone }); });
    return m;
  });
  const telHref = p => 'tel:' + ascii(p).replace(/[^\d+]/g, '');
  const callRow = g => `<div class="call"><span>${esc(g.relation ? g.relation + ' ' : '')}${esc(bn(g.phone))}</span><a class="pill coral" href="${telHref(g.phone)}">অভিভাবককে কল</a></div>`;

  // writes run one at a time, in tap order
  let chain = Promise.resolve();
  const serial = fn => (chain = chain.then(fn, fn));

  function pendingCard() {
    const n = outbox.mine().length;
    if (!n) return '';
    return `<div class="card warn"><h2>${bn(n)}টি তথ্য ফোনে জমা আছে</h2><div class="mute">ইন্টারনেট ছিল না, তাই হাজিরা/রেটিং ফোনে রাখা হয়েছে। নেট এলে নিজে থেকেই চলে যাবে।</div>
      <button class="primary" id="sync" style="margin-top:10px">এখন পাঠান</button></div>`;
  }
  function bindSync(el) {
    const b = el.querySelector('#sync');
    if (b) b.onclick = async () => {
      b.disabled = true; b.textContent = 'পাঠানো হচ্ছে…';
      const n = await flushOutbox(); const left = outbox.mine().length;
      toast(left === 0 ? 'সব তথ্য পাঠানো হয়েছে ✓' : n ? `${bn(n)}টি পাঠানো হয়েছে, বাকি ${bn(left)}টি।` : 'এখনো ইন্টারনেট পাওয়া যাচ্ছে না।');
      render();
    };
  }
  const shiftChips = (cur, extra = '') => `<div class="seg">${SHIFTS.map(s => `<button data-shift="${s.id}" class="${s.id === cur ? 'on' : ''}"><b>${s.bn}</b><span>${s.time}</span></button>`).join('')}</div>${extra}`;

  // ---------- home ----------
  async function home(el) {
    flushOutbox().catch(() => {});
    const counts = await Promise.all(SHIFTS.map(s => rosterOf(s.id).then(l => l.length).catch(() => null)));
    const isAdmin = S.me.role === 'admin';
    el.innerHTML = `${pendingCard()}
      <div class="card"><h2>আজকের শিক্ষার্থী</h2><div class="mute">শিফটে চাপলে তালিকা ও অভিভাবকের নম্বর দেখবেন</div>
        <div class="seg" style="margin-top:10px">${SHIFTS.map((s, i) => `<button data-go="shift:${s.id}"><span>${s.bn}</span><b>${counts[i] == null ? '…' : bn(counts[i]) + ' জন'}</b></button>`).join('')}</div></div>
      <div class="quick"><button data-go="att"><b>উপস্থিতি</b><span>ক্লাস বা পরীক্ষা</span></button><button data-go="rate"><b>ক্লাস রেটিং</b><span>আজকের স্কোর</span></button></div>
      <div class="card"><h2>${isAdmin ? 'অ্যাডমিন' : 'শিক্ষক'} · ${esc(S.me.full_name)}</h2>
        <div class="mute">নম্বর এন্ট্রি, ক্লাস লগ, ফি, নোটিশসহ বাকি অংশ ধাপে ধাপে ওয়েবে আসছে। ততদিন ${isAndroid ? 'অ্যান্ড্রয়েড অ্যাপে' : 'অফিসের কম্পিউটার বা অ্যান্ড্রয়েড অ্যাপে'} করুন।</div></div>
      ${apkBanner()}`;
    bindSync(el);
    setTimeout(apkPopup, 1200);
  }

  // ---------- shift list ----------
  async function shiftList(el, shift) {
    const s = SHIFTS.find(x => x.id === shift) || SHIFTS[1];
    const [list, contacts] = await Promise.all([rosterOf(s.id), contactsP().catch(() => ({}))]);
    const byClass = {};
    sortRoster(list).forEach(st => (byClass[st.class_level] ||= []).push(st));
    el.innerHTML = Object.keys(byClass).map(c => `<div class="card"><h2>ক্লাস ${bn(c)} <span class="mute">(${bn(byClass[c].length)} জন)</span></h2>${byClass[c].map(st => `
        <div class="row col"><div><b>${esc(nameOf(st))}</b> <span class="mute">রোল ${esc(bn(st.roll || '—'))}</span></div>
        ${(contacts[st.id] || []).map(callRow).join('') || '<div class="mute small">অভিভাবকের নম্বর যোগ করা নেই</div>'}</div>`).join('')}</div>`).join('')
      || '<div class="card mute">এই শিফটে কোনো শিক্ষার্থী নেই।</div>';
  }

  // ---------- take attendance ----------
  const A = { session: null, examTitle: '', shift: 'afternoon', cls: null, present: {}, ratings: {}, marked: false, error: null, savedFor: null };
  async function attendance(el) {
    const today = dhakaToday();
    if (A.day !== today) Object.assign(A, { day: today, session: null, examTitle: '', present: {}, ratings: {}, marked: false, savedFor: null });
    let list = null, loadFailed = false, savedRatings = null;
    const contacts = contactsP().catch(() => null);

    async function load() {
      try {
        list = sortRoster(await rosterOf(A.shift));
        const ids = list.map(s => s.id);
        if (ids.length) {
          const [att, rts] = await Promise.all([
            sel('attendance', `select=student_id,check_in&date=eq.${today}&student_id=${inList(ids)}`).catch(() => []),
            sel('class_ratings', `select=student_id,behavior,homework,performance&day=eq.${today}&student_id=${inList(ids)}`).catch(() => null),
          ]);
          att.forEach(a => { if (a.check_in && !(a.student_id in A.present)) A.present[a.student_id] = true; });
          savedRatings = rts;
          (rts || []).forEach(r => { if (!A.ratings[r.student_id]) A.ratings[r.student_id] = r; });
        }
      } catch (e) { loadFailed = true; list = []; }
    }

    function saveRating(id, r) {
      A.ratings[id] = r;
      const row = { coaching_id: S.me.coaching_id, student_id: id, day: today, behavior: r.behavior, homework: r.homework, performance: r.performance, rated_by: S.uid };
      serial(() => writeOrQueue('POST', '/rest/v1/class_ratings?on_conflict=student_id,day', [row], 'return=minimal,resolution=merge-duplicates')
        .catch(() => { A.error = 'রেটিং সংরক্ষণ হয়নি। আবার চাপুন।'; draw(); }));
    }
    function mark(id, value) {
      A.present[id] = value; A.marked = true;
      const session = A.session || 'class';
      // present in a class: start at 8/10, but only once today's saved ratings are known (never overwrite one)
      if (value && session === 'class' && savedRatings !== null && !A.ratings[id]) saveRating(id, { ...RATING_DEFAULT });
      if (!value && A.ratings[id]) {
        delete A.ratings[id];
        serial(() => writeOrQueue('DELETE', `/rest/v1/class_ratings?student_id=eq.${id}&day=eq.${today}`, null).catch(() => {}));
      }
      const row = { coaching_id: S.me.coaching_id, student_id: id, date: today, check_in: value ? new Date().toISOString() : null, source: 'manual', session, exam_title: A.examTitle.trim() || null };
      serial(() => writeOrQueue('POST', '/rest/v1/attendance?on_conflict=student_id,date', row, 'return=minimal,resolution=merge-duplicates')
        .catch(() => { A.error = 'হাজিরা সংরক্ষণ হয়নি। আবার চাপুন।'; draw(); }));
    }

    const ratingBox = (id, r) => `<div class="rating" data-id="${id}"><div class="rhead"><span>আজকের রেটিং</span><b>${fmtScore(total(r))}/১০</b></div>
      ${choice('আচরণ', 'behavior', [0, 1, 2, 3], r.behavior)}
      ${choice('হোমওয়ার্ক', 'homework', [0, 1.5, 3], r.homework, ['করেনি', 'আধা', 'করেছে'])}
      ${choice('পারফরম্যান্স', 'performance', [0, 1, 2, 3, 4], r.performance)}</div>`;

    async function draw() {
      const online = navigator.onLine, pending = outbox.mine().length;
      let h = `<div class="card ${online && !pending ? 'okbg' : 'warn'}"><div>${!online ? `অফলাইন মোড: হাজিরা ফোনে জমা হচ্ছে${pending ? ` (${bn(pending)}টি)` : ''}। নেট এলে নিজে থেকেই চলে যাবে।`
        : pending ? `অনলাইন: জমা থাকা ${bn(pending)}টি তথ্য পাঠানো হচ্ছে…` : 'অনলাইন: প্রতিটি চাপ সাথে সাথে সংরক্ষণ হচ্ছে, অভিভাবক বার্তা পাচ্ছেন।'}</div>
        ${A.error ? `<div class="err">${A.error}</div>` : ''}</div>
        <div class="card"><h2>আজ কী হচ্ছে?</h2><div class="seg">
          <button data-session="class" class="${A.session === 'class' ? 'on' : ''}"><b>নিয়মিত ক্লাস</b><span>হাজিরা + ক্লাস স্কোর</span></button>
          <button data-session="exam" class="${A.session === 'exam' ? 'on' : ''}"><b>পরীক্ষা</b><span>শুধু হাজিরা</span></button></div>
          ${A.session === 'exam' ? (A.marked ? `<p>পরীক্ষা: ${esc(A.examTitle || 'নাম দেওয়া হয়নি')}</p>` : `<input id="examTitle" maxlength="60" placeholder="কোন পরীক্ষা (যেমন: মডেল টেস্ট · ইংরেজি ২য়)" value="${esc(A.examTitle)}">`) : ''}
          ${A.marked ? '<div class="mute small">হাজিরা শুরু হয়ে গেছে, তাই আজকের ধরন আর বদলানো যাবে না।</div>' : ''}</div>`;
      if (A.session) {
        h += shiftChips(A.shift);
        if (list === null) h += '<div class="skel"></div><div class="skel"></div>';
        else if (loadFailed) h += '<div class="card">শিক্ষার্থীর তালিকা আনতে ইন্টারনেট লাগে। একবার তালিকা খোলার পর নেট গেলেও হাজিরা নেওয়া যাবে।<button class="primary" id="reload" style="margin-top:10px">আবার চেষ্টা করুন</button></div>';
        else if (!list.length) h += '<div class="card mute">এই শিফটে কোনো শিক্ষার্থী নেই।</div>';
        else {
          const classes = [...new Set(list.map(s => s.class_level))].sort((a, b) => a - b);
          if (classes.length > 1) h += `<div class="kids"><button data-cls="" class="${A.cls == null ? 'on' : ''}">সব ক্লাস</button>${classes.map(c => `<button data-cls="${c}" class="${A.cls === c ? 'on' : ''}">ক্লাস ${bn(c)}</button>`).join('')}</div>`;
          const shown = list.filter(s => A.cls == null || s.class_level === A.cls);
          const presentN = shown.filter(s => A.present[s.id] === true).length;
          const unmarked = shown.filter(s => !(s.id in A.present));
          h += `<div class="card"><b>উপস্থিত: ${bn(presentN)} / ${bn(shown.length)}</b><div class="bar"><i style="width:${shown.length ? presentN / shown.length * 100 : 0}%"></i></div>
            ${unmarked.length ? `<div class="mute small">${bn(unmarked.length)} জনের হাজিরা এখনো দেওয়া হয়নি</div>` : ''}</div>`;
          const cs = await contacts;
          h += shown.map(st => {
            const p = A.present[st.id];
            let x = `<div class="att ${p === true ? 'p' : p === false ? 'a' : ''}" data-toggle="${st.id}"><div><b>${esc(nameOf(st))}</b><div class="mute small">ক্লাস ${bn(st.class_level)} · রোল ${esc(bn(st.roll || '—'))}</div></div>
              <span class="chip ${p === true ? 'ok' : p === false ? 'bad' : ''}">${p === true ? 'উপস্থিত' : p === false ? 'অনুপস্থিত' : 'চাপ দিন'}</span></div>`;
            if (p === true && A.session === 'class' && A.ratings[st.id]) x += ratingBox(st.id, A.ratings[st.id]);
            if (p === false) x += `<div class="absent">${cs == null ? '<span class="mute small">অভিভাবকের নম্বর আনা হচ্ছে…</span>' : (cs[st.id] || []).map(callRow).join('') || '<span class="mute small">অভিভাবকের নম্বর যোগ করা নেই</span>'}</div>`;
            return x;
          }).join('');
          h += `<button class="primary" id="allP" style="margin-top:12px">সবাইকে উপস্থিত চিহ্নিত করুন</button>
            ${unmarked.length ? `<button class="primary coral" id="restA" style="margin-top:8px">বাকি ${bn(unmarked.length)} জনকে অনুপস্থিত হিসেবে সংরক্ষণ করুন</button>` : ''}
            <p class="mute small">${A.session === 'class' ? 'উপস্থিত শিক্ষার্থীর নিচেই রেটিং দিন (শুরুতে ৮/১০ বসানো থাকে)। অভিভাবক হাজিরার সাথে আজকের স্কোরও পান।' : 'পরীক্ষার দিনে শুধু হাজিরা যায়; কোনো ক্লাস স্কোর পাঠানো হয় না।'}</p>`;
          el._shown = shown; el._unmarked = unmarked;
        }
      }
      el.innerHTML = h;
      bind();
    }

    function bind() {
      el.querySelectorAll('[data-session]').forEach(b => b.onclick = async () => {
        if (A.marked) return;
        A.session = b.dataset.session; await draw();
        if (list === null) { await load(); draw(); }
      });
      const t = el.querySelector('#examTitle'); if (t) t.oninput = () => { A.examTitle = t.value.slice(0, 60); };
      el.querySelectorAll('[data-shift]').forEach(b => b.onclick = async () => { A.shift = b.dataset.shift; A.cls = null; list = null; loadFailed = false; draw(); await load(); draw(); });
      el.querySelectorAll('[data-cls]').forEach(b => b.onclick = () => { A.cls = b.dataset.cls === '' ? null : +b.dataset.cls; draw(); });
      el.querySelectorAll('[data-toggle]').forEach(b => b.onclick = () => { const id = b.dataset.toggle; mark(id, A.present[id] !== true); draw(); });
      el.querySelectorAll('.rating [data-k]').forEach(b => b.onclick = () => {
        const id = b.closest('.rating').dataset.id;
        saveRating(id, { ...A.ratings[id], [b.dataset.k]: +b.dataset.v }); draw();
      });
      const r = el.querySelector('#reload'); if (r) r.onclick = async () => { list = null; loadFailed = false; draw(); await load(); draw(); };
      const all = el.querySelector('#allP'); if (all) all.onclick = () => { el._shown.forEach(s => mark(s.id, true)); draw(); };
      const rest = el.querySelector('#restA'); if (rest) rest.onclick = () => { el._unmarked.forEach(s => mark(s.id, false)); toast('অনুপস্থিতদের অভিভাবকও বার্তা পাবেন।'); draw(); };
    }

    if (A.session) await load();
    await draw();
    // keep the online/offline badge fresh (re-draw only when something changed)
    let last = `${navigator.onLine}|${outbox.mine().length}`;
    const tick = setInterval(() => {
      if (route !== 'att') return clearInterval(tick);
      const now = `${navigator.onLine}|${outbox.mine().length}`;
      if (now !== last && route === 'att') { last = now; draw(); }
    }, 4000);
  }
  function choice(label, key, values, selected, labels) {
    return `<div class="choice"><span>${label}</span><div>${values.map((v, i) => `<button data-k="${key}" data-v="${v}" class="${+selected === v ? 'on' : ''}">${labels ? labels[i] : fmtScore(v)}</button>`).join('')}</div></div>`;
  }

  // ---------- rate class ----------
  const R = { shift: 'afternoon', open: null, ratings: {}, dirty: false, day: null };
  async function rate(el) {
    const today = dhakaToday();
    if (R.day !== today) Object.assign(R, { day: today, ratings: {}, dirty: false, open: null });
    let list = null, saved = null, busy = false, msg = '';
    async function load() {
      list = sortRoster(await rosterOf(R.shift));
      saved = list.length ? await sel('class_ratings', `select=student_id,behavior,homework,performance&day=eq.${today}&student_id=${inList(list.map(s => s.id))}`) : [];
      const m = Object.fromEntries(saved.map(r => [r.student_id, r]));
      list.forEach(s => { if (!R.ratings[s.id]) R.ratings[s.id] = m[s.id] ? { behavior: +m[s.id].behavior, homework: +m[s.id].homework, performance: +m[s.id].performance } : { ...RATING_DEFAULT }; });
    }
    function draw() {
      let h = shiftChips(R.shift) + `<div class="card cream mute">সবার জন্য ৮ বসানো আছে (আচরণ ৩ + হোমওয়ার্ক ৩ + পারফরম্যান্স ২)। যাদের আলাদা, শুধু তাদের নামে চাপ দিয়ে বদলান, তারপর সংরক্ষণ করুন।</div>`;
      if (list === null) h += '<div class="skel"></div><div class="skel"></div>';
      else if (!list.length) h += '<div class="card mute">এই ব্যাচে কোনো শিক্ষার্থী নেই।</div>';
      else {
        if (saved.length && !R.dirty) h += '<div class="chip ok" style="margin-bottom:10px">আজকের রেটিং আগেই সংরক্ষিত হয়েছে, চাইলে বদলাতে পারেন</div>';
        h += list.map(st => {
          const r = R.ratings[st.id], t = total(r), open = R.open === st.id;
          return `<div class="card rrow ${open ? 'open' : ''}"><div class="rtop" data-open="${st.id}"><div><b>${esc(nameOf(st))}</b>
            <div class="mute small">রোল ${esc(bn(st.roll || '—'))} · আচরণ ${fmtScore(r.behavior)} · কাজ ${hwLabel(r.homework)} · পারফ. ${fmtScore(r.performance)}</div></div>
            <span class="score ${t >= 8 ? 'ok' : t >= 5 ? '' : 'bad'}">${fmtScore(t)}</span></div>
            ${open ? `<div class="rating" data-id="${st.id}">${choice('আচরণ', 'behavior', [0, 1, 2, 3], r.behavior)}${choice('হোমওয়ার্ক', 'homework', [0, 1.5, 3], r.homework, ['করেনি', 'আধা', 'করেছে'])}${choice('পারফরম্যান্স', 'performance', [0, 1, 2, 3, 4], r.performance)}</div>` : ''}</div>`;
        }).join('');
        h += `<button class="primary" id="saveR" ${busy ? 'disabled' : ''}>${busy ? 'সংরক্ষণ হচ্ছে…' : `সংরক্ষণ করুন (${bn(list.length)} জন)`}</button>${msg ? `<p class="center">${msg}</p>` : ''}`;
      }
      el.innerHTML = h;
      el.querySelectorAll('[data-shift]').forEach(b => b.onclick = async () => { if (b.dataset.shift === R.shift) return; R.shift = b.dataset.shift; R.open = null; R.dirty = false; msg = ''; list = null; draw(); await load(); draw(); });
      el.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { R.open = R.open === b.dataset.open ? null : b.dataset.open; draw(); });
      el.querySelectorAll('.rating [data-k]').forEach(b => b.onclick = () => { const id = b.closest('.rating').dataset.id; R.ratings[id] = { ...R.ratings[id], [b.dataset.k]: +b.dataset.v }; R.dirty = true; msg = ''; draw(); });
      const sv = el.querySelector('#saveR');
      if (sv) sv.onclick = async () => {
        busy = true; draw();
        const rows = list.map(s => ({ coaching_id: S.me.coaching_id, student_id: s.id, day: today, ...R.ratings[s.id], rated_by: S.uid }));
        try {
          const sent = await serial(() => writeOrQueue('POST', '/rest/v1/class_ratings?on_conflict=student_id,day', rows, 'return=minimal,resolution=merge-duplicates'));
          R.dirty = false; msg = sent ? 'রেটিং সংরক্ষিত হয়েছে। শিক্ষার্থী ও অভিভাবক নিজেরটা দেখতে পাবেন।' : 'ইন্টারনেট নেই, তাই ফোনে রাখা হয়েছে। নেট এলে নিজে থেকেই চলে যাবে।';
        } catch { msg = 'সংরক্ষণ করা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।'; }
        busy = false; draw();
      };
    }
    await load(); draw();
  }

  // ---------- more ----------
  async function more(el) {
    el.innerHTML = `${pendingCard()}
      <div class="card" data-go="notices"><h2>সকল নোটিশ</h2><div class="mute">কোচিংয়ের নোটিশ ›</div></div>
      <div class="card" data-go="pin"><h2>পিন বদলান</h2><div class="mute">নিজের পিন ঠিক করুন ›</div></div>
      <div class="card"><h2>${esc(S.me.full_name)}</h2><div class="mute">${S.me.role === 'admin' ? 'অ্যাডমিন' : 'শিক্ষক'} · লগইন আইডি: ${esc(bn(S.me.login_id))}</div></div>`;
    bindSync(el);
  }
  async function notices(el) {
    const ns = await cached('notices', () => sel('notices', 'select=id,title,body,audience,created_at&order=created_at.desc&limit=50'));
    el.innerHTML = ns.map(n => `<div class="card"><h2>${esc(n.title)}</h2><div class="mute">${fmtDate(n.created_at)}</div><p style="white-space:pre-wrap">${esc(n.body)}</p></div>`).join('') || '<div class="card mute">কোনো নোটিশ নেই</div>';
  }

  Object.assign(SCREENS, {
    home: { title: () => 'স্বাগতম, ' + (S.me?.full_name || ''), render: home },
    att: { title: 'উপস্থিতি গ্রহণ', render: attendance },
    rate: { title: 'ক্লাস রেটিং', render: rate },
    shift: { title: p => (SHIFTS.find(s => s.id === p)?.bn || '') + ' শিফট', tab: 'home', back: 'home', render: shiftList },
    more: { title: 'আরও', render: more },
    notices: { title: 'সকল নোটিশ', tab: 'more', back: 'more', render: notices },
  });
  setTabs([{ id: 'home', label: 'হোম' }, { id: 'att', label: 'উপস্থিতি' }, { id: 'rate', label: 'রেটিং' }, { id: 'more', label: 'আরও' }]);
})();

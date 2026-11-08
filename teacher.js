'use strict';
// Teacher & admin screens — mirror TeacherScreens.kt, ClassroomScreens.kt (RateClass), StudentListScreens.kt.
// Class writes go through writeOrQueue so they survive a lost connection (same as the APK's Outbox).
(function () {
  const RATING_DEFAULT = { behavior: 3, homework: 3, performance: 2 }; // 8/10, same as RatingScale.default
  const T = window.T = {}; // shared helpers for the other teacher modules
  const ST_COLS = 'id,class_level,roll,batch_id,profile:profiles!students_profile_id_fkey(full_name)';
  T.rosterOf = s => cached('roster.' + s, async () => {
    const b = await sel('batches', `select=id&shift=eq.${s}`);
    if (!b.length) return [];
    const ids = inList(b.map(x => x.id));
    const main = await sel('students', `select=${ST_COLS}&batch_id=${ids}&active=is.true&order=roll`);
    // Students whose main shift is another one but who also come to this one (student_batches, periods.sql).
    const extra = (await sel('student_batches', `select=student_id&batch_id=${ids}`).catch(() => []))
      .map(r => r.student_id).filter((id, i, a) => a.indexOf(id) === i && !main.some(m => m.id === id));
    return extra.length ? main.concat(await sel('students', `select=${ST_COLS}&id=${inList(extra)}&active=is.true&order=roll`)) : main;
  });
  // The daily routine: (shift, slot 1..3, class) -> teacher. class_level null = everyone in the shift.
  T.periods = () => cached('periods', () => sel('class_periods', 'select=shift,slot,class_level,teacher_id,teacher:teacher_id(full_name)&order=shift,slot,class_level')).catch(() => []);
  const slotBn = T.slotBn = n => ({ 1: '১ম', 2: '২য়', 3: '৩য়' })[n] || bn(n);
  T.slotsOf = (routine, shift) => [...new Set(routine.filter(p => p.shift === shift).map(p => +p.slot))].sort((a, b) => a - b);
  T.slotSeg = (slots, cur) => slots.length > 1 ? `<div class="seg">${slots.map(n => `<button data-slot="${n}" class="${n === cur ? 'on' : ''}"><b>${slotBn(n)} ক্লাস</b></button>`).join('')}</div>` : '';
  // Teacher groups of one period (TeacherScreens.periodGroups). No routine for the shift = everyone.
  T.periodGroups = (routine, students, shift, slot) => {
    const rows = routine.filter(p => p.shift === shift && +p.slot === slot);
    if (!rows.length) return [{ key: 'all', title: 'সব ক্লাস', sub: null, levels: null }];
    const everyone = rows.find(p => p.class_level == null);
    if (everyone) return [{ key: 'all', title: everyone.teacher?.full_name || 'সব ক্লাস', sub: 'সব ক্লাস', levels: null }];
    const by = {};
    rows.forEach(p => (by[p.teacher_id || 'none'] ||= []).push(p));
    const groups = Object.entries(by).map(([tid, l]) => {
      const levels = [...new Set(l.map(p => +p.class_level))].sort((a, b) => a - b);
      return { key: 't:' + tid, title: l[0].teacher?.full_name || 'শিক্ষক ঠিক করা হয়নি', sub: 'ক্লাস ' + levels.map(bn).join(', '), levels };
    }).sort((a, b) => Math.max(...b.levels) - Math.max(...a.levels));
    // "রুটিনে নেই" only for classes missing from the whole shift's routine (a class with fewer periods just has none here).
    const shiftRows = routine.filter(p => p.shift === shift);
    if (shiftRows.some(p => p.class_level == null)) return groups;
    const covered = new Set(shiftRows.map(p => +p.class_level));
    const missing = [...new Set(students.map(s => s.class_level))].filter(c => !covered.has(c)).sort((a, b) => a - b);
    return missing.length ? groups.concat([{ key: 'rest', title: 'রুটিনে নেই', sub: 'ক্লাস ' + missing.map(bn).join(', '), levels: missing }]) : groups;
  };
  T.allStudents = () => cached('allstudents', () => sel('students', 'select=id,class_level,roll,batch:batches(shift),profile:profiles!students_profile_id_fkey(full_name)&active=is.true&limit=3000'));
  const nameOf = T.nameOf = st => st?.profile?.full_name || 'শিক্ষার্থী';
  const rollNum = st => parseInt(ascii(st.roll), 10) || 999;
  const sortRoster = T.sortRoster = l => l.slice().sort((a, b) => a.class_level - b.class_level || rollNum(a) - rollNum(b));
  const total = r => +r.behavior + +r.homework + +r.performance;
  const hwLabel = v => +v === 0 ? 'করেনি' : +v === 3 ? 'করেছে' : 'আধা';
  T.contacts = () => cached('contacts', async () => {
    const rows = await sel('guardian_students', 'select=student_id,guardian_id,relation,guardian:profiles!guardian_students_guardian_id_fkey(full_name,phone)&limit=5000');
    const m = {};
    rows.forEach(o => { if (o.guardian?.phone) (m[o.student_id] ||= []).push({ id: o.guardian_id, name: o.guardian.full_name, relation: o.relation || '', phone: o.guardian.phone }); });
    return m;
  });
  const telHref = T.telHref = p => 'tel:' + ascii(p).replace(/[^\d+]/g, '');
  const callRow = g => `<div class="call"><span>অনুপস্থিত · ${esc(g.relation ? g.relation + ' ' : '')}${esc(bn(g.phone))}</span><a class="pill coral" href="${telHref(g.phone)}">অভিভাবককে কল</a></div>`;
  let chain = Promise.resolve();
  const serial = T.serial = job => (chain = chain.then(job, job));

  function pendingCard() {
    const n = outbox.mine().length;
    if (!n) return '';
    return `<div class="card sun"><h3>${bn(n)}টি তথ্য ফোনে জমা আছে</h3><div class="mute">ইন্টারনেট ছিল না, তাই হাজিরা/রেটিং/নম্বর ফোনে রাখা হয়েছে। নেট এলে নিজে থেকেই চলে যাবে।</div>
      <button class="btn" id="sync" style="margin-top:8px">এখন পাঠান</button></div>`;
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
  T.shiftSeg = (curShift, attr = 'data-shift') => `<div class="seg">${SHIFTS.map(s => `<button ${attr}="${s.id}" class="${s.id === curShift ? 'on' : ''}"><b>${s.bn}</b><span>${s.time}</span></button>`).join('')}</div>`;
  T.soon = t => 'soon:' + t;
  // A screen registered later (by a later module) replaces the "soon" link automatically.
  const link = (route, fallback) => SCREENS[route.split(':')[0]] ? route : T.soon(fallback);

  // ---------- home ----------
  SCREENS['t.home'] = { home: true, title: () => 'স্বাগতম, ' + S.me.full_name, sub: () => isAdmin() ? 'অ্যাডমিন' : 'শিক্ষক', hdr: 'var(--teal-dark)',
    trail: () => '<button class="pill white" data-logout>লগআউট</button>', render: async (el) => {
    flushOutbox().catch(() => {});
    const counts = await Promise.all(SHIFTS.map(s => T.rosterOf(s.id).then(l => l.length).catch(() => null)));
    const admin = isAdmin();
    // Same sections, tiles and order as StaffHome.kt.
    const sections = [
      ...(admin ? [['ব্যবস্থাপনা', [['users', 'অ্যাকাউন্ট ব্যবস্থাপনা', 'a.users'], ['note_edit', 'প্রোফাইল সম্পাদনা', 'a.people'], ['calendar', 'ক্লাস রুটিন', 'a.routine'], ['question', 'পরিবর্তনের অনুরোধ', 't.requests'],
        ['phone', 'নম্বর সংশোধন', 'a.phones'], ['card', 'ফি ব্যবস্থাপনা', 'a.fees'], ['money', 'শিক্ষকদের সম্মানী', 't.honorarium']]]] : []),
      ['প্রতিদিনের ক্লাস', [['attendance', 'উপস্থিতি গ্রহণ', 't.att'], ['star', 'ক্লাস রেটিং', 't.rate'], ['signal', 'শিক্ষার্থীদের সংকেত', 't.signals'], ['question', 'প্রশ্ন বক্স', 't.doubts'], ['mic', 'ভয়েস ও মুখস্থ পড়া', 't.voice'], ['camera', 'CCTV যাচাই', 't.gate']]],
      ['পরীক্ষা ও ফলাফল', [['numbers', 'নম্বর এন্ট্রি', 't.marks'], ['document', 'রিপোর্ট কার্ড ও টপার', 'a.reports'], ['calendar', 'পরীক্ষার পরিকল্পনা', 't.exams'], ['archive', 'প্রশ্ন ব্যাংক', 't.qbank'], ['ai_spark', 'AI প্রশ্নপত্র তৈরি', 't.aipaper'],
        ['note_edit', 'AI খাতা মূল্যায়ন', 't.grading'], ['seat', 'সিট প্ল্যান', 't.seat']]],
      ['শিক্ষার্থী ও অগ্রগতি', [['alert', 'ঝুঁকিতে থাকা শিক্ষার্থী', 't.risk'], ['chart', 'ব্যাচ তুলনা', 't.compare'], ['target', 'সাপ্তাহিক চ্যালেঞ্জ', 't.challenges'], ['book', 'সিলেবাস ট্র্যাকার', 'syllabus:6'], ['flashcards', 'ফ্ল্যাশকার্ড', 'flash:6'], ['book', 'শিক্ষা উপকরণ', 'materials:5']]],
      ['যোগাযোগ ও নোটিশ', [['megaphone', 'নোটিশ পাঠান', 't.notice'], ['bell', 'সকল নোটিশ', 'notices'], ['chat', 'অভিভাবকদের বার্তা', 'chats'], ['handshake', 'অভিভাবক মিটিং', 'meetings'], ['mic', 'পরিচালকের বার্তা', 'director']]],
      [admin ? 'আমার অফিস' : 'অফিস', [['palm', 'ছুটি ও বদলি', 't.leave'], ...(admin ? [] : [['money', 'আমার সম্মানী', 't.honorarium'], ['question', 'আমার অনুরোধ', 't.requests']]), ['lock', 'পিন বদলান', 'pin']]],
    ];
    const todo = admin ? await Promise.all([
      sel('student_change_requests', 'select=id&status=eq.pending&limit=200').then(r => r.length).catch(() => 0),
      sel('phone_change_requests', 'select=id&status=eq.pending&limit=200').then(r => r.length).catch(() => 0),
      sel('leave_requests', 'select=id&status=eq.pending&limit=200').then(r => r.length).catch(() => 0),
    ]) : null;
    const todoRows = todo ? [['শিক্ষকের পরিবর্তনের অনুরোধ', todo[0], 't.requests'], ['অভিভাবকের নম্বর সংশোধন', todo[1], 'a.phones'], ['ছুটির আবেদন', todo[2], 't.leave']].filter(r => r[1] > 0) : [];
    el.innerHTML = `${pendingCard()}<div id="snotes"></div>
      <div class="card"><h2>আজকের শিক্ষার্থী</h2><div class="mute small">শিফটে চাপলে তালিকা ও অভিভাবকের নম্বর দেখবেন</div>
        <div class="seg soft" style="margin-top:10px">${SHIFTS.map((s, i) => `<button data-go="t.shift:${s.id}"><span class="lic">${I(s.icon)}</span><span>${s.bn}</span><b>${counts[i] == null ? '…' : bn(counts[i]) + ' জন'}</b></button>`).join('')}</div></div>
      ${todo ? `<div class="card"><h3>আপনার জন্য কাজ</h3>${todoRows.map(([t, n, r]) => `<div class="row tap" data-go="${r}"><span>${t}</span><b>${bn(n)} ›</b></div>`).join('') || '<div class="mute">এই মুহূর্তে কোনো কাজ বাকি নেই ✓</div>'}</div>` : ''}
      <div class="grid2">${action('attendance', 'উপস্থিতি', 'ক্লাস বা পরীক্ষা', 't.att')}${action('star', 'ক্লাস রেটিং', 'আজকের স্কোর', 't.rate')}${action('numbers', 'নম্বর এন্ট্রি', 'মডেল টেস্ট', 't.marks')}${action('megaphone', 'নোটিশ', 'সবাইকে জানান', 't.notice')}</div>
      ${sections.map(([h, tiles]) => section(h) + grid3(tiles.map(([ic, t, r]) => compact(ic, t, link(r, t))))).join('')}
      <div class="card cream"><h3>CCTV-ভিত্তিক উপস্থিতি</h3><div class="mute">কোচিং-এর কম্পিউটারে Diff Gate চালু হলে গেটের ক্যামেরা স্বয়ংক্রিয়ভাবে উপস্থিতি গ্রহণ করবে। অনিশ্চিত শনাক্তকরণ "CCTV যাচাই" অংশে দেখা যাবে।</div></div>
      ${apkBanner()}`;
    if (T.staffNotesCard) T.staffNotesCard(el.querySelector('#snotes')).catch(() => {});
    bindSync(el);
    setTimeout(apkPopup, 1500);
  } };

  // ---------- shift list (ShiftStudentsScreen) ----------
  SCREENS['t.shift'] = { title: p => shiftBn(p) + ' শিফট', sub: 'শিক্ষার্থী ও অভিভাবকের নম্বর', render: async (el, shift) => {
    const [list, contacts] = await Promise.all([T.rosterOf(shift), T.contacts().catch(() => ({}))]);
    if (!list.length) { el.innerHTML = empty('school', 'এই শিফটে কোনো শিক্ষার্থী নেই।'); return; }
    let cls = null;
    const draw = () => {
      const classes = [...new Set(list.map(s => s.class_level))].sort((a, b) => a - b);
      const shown = sortRoster(list).filter(s => cls == null || s.class_level === cls);
      el.innerHTML = `${classes.length > 1 ? chipRow([['', 'সব ক্লাস'], ...classes.map(c => [c, 'ক্লাস ' + bn(c)])], cls ?? '') : ''}
        ${shown.map(st => `<div class="card"><div style="display:flex;gap:12px;align-items:center">${avatar(nameOf(st))}<div style="flex:1"><h3>${esc(nameOf(st))}</h3><div class="mute small">ক্লাস ${bn(st.class_level)} · রোল ${esc(bn(st.roll || '—'))}</div></div><button class="pill" data-go="t.reqchange:${st.id}">ব্যাচ / ক্লাস বদলের অনুরোধ</button></div>
          <div class="stack" style="margin-top:8px">${(contacts[st.id] || []).map(g => `<div class="call"><span>${esc(g.relation || 'অভিভাবক')} · ${esc(bn(g.phone))}</span><span class="chips"><a class="pill coral" href="${telHref(g.phone)}">কল</a><button class="pill" data-report="${st.id}|${g.id}|${esc(g.phone)}">ভুল নম্বর</button></span></div>`).join('') || '<div class="mute small">অভিভাবকের নম্বর যোগ করা নেই</div>'}</div></div>`).join('')}`;
      el.querySelectorAll('[data-chip]').forEach(b => b.onclick = () => { cls = b.dataset.chip === '' ? null : +b.dataset.chip; draw(); });
      el.querySelectorAll('[data-report]').forEach(b => b.onclick = () => reportPhone(...b.dataset.report.split('|')));
      if (drawn) el.querySelectorAll('[data-go]').forEach(bindGo); // the first draw is bound by render()
      drawn = true;
    };
    let drawn = false;
    draw();
  } };
  function reportPhone(studentId, guardianId, oldPhone) {
    sheet(`<h2>ভুল নম্বর জানান</h2><div class="mute">${esc(bn(oldPhone))} — এই নম্বরে সমস্যা কী?</div>
      <div class="seg"><button data-owner="wrong" class="on"><b>অন্য কারো নম্বর</b></button><button data-owner="off"><b>বন্ধ/চলে না</b></button></div>
      <label>সঠিক নম্বর (জানা থাকলে)</label><input id="np" inputmode="tel" maxlength="14" placeholder="01XXXXXXXXX">
      <label>মন্তব্য</label><input id="nn" maxlength="200">
      <button class="btn" id="rs">অ্যাডমিনকে পাঠান</button><button class="link" data-close>বাতিল</button>`, (s, close) => {
      let owner = 'wrong';
      s.querySelectorAll('[data-owner]').forEach(b => b.onclick = () => { owner = b.dataset.owner; s.querySelectorAll('[data-owner]').forEach(x => x.classList.toggle('on', x === b)); });
      s.querySelector('#rs').onclick = async () => {
        const np = ascii(s.querySelector('#np').value).replace(/\D/g, '');
        if (np && !/^01\d{9}$/.test(np)) return toast('সঠিক নম্বর দিন (০১ দিয়ে শুরু, ১১ সংখ্যা)');
        try {
          await ins('phone_change_requests', { coaching_id: S.me.coaching_id, student_id: studentId, guardian_id: guardianId, old_phone: oldPhone, new_phone: np || null, owner, note: s.querySelector('#nn').value.trim(), reported_by: S.uid }, 'select=id');
          toast('অ্যাডমিনকে জানানো হয়েছে'); close();
        } catch (e) { if (/23505|duplicate/.test(e.body || '')) { toast('আগেই জানানো হয়েছে'); close(); } else toast('পাঠানো যায়নি'); }
      };
    });
  }

  // ---------- take attendance (TakeAttendanceScreen) ----------
  // One row per student per (day, shift, period) in period_attendance; slot 0 = exam through the whole shift.
  // A trigger rolls it up into the daily attendance row the guardian sees (periods.sql, exam-slot.sql).
  const A = { session: null, examTitle: '', examScope: null, shift: 'afternoon', slot: 1, group: null, cls: null, present: {}, ratings: {}, marked: false, error: null, day: null, key: '' };
  const choice = (label, key, values, selected, labels) =>
    `<div class="choice"><span>${label}</span><div>${values.map((v, i) => `<button data-k="${key}" data-v="${v}" class="${+selected === v ? 'on' : ''}">${labels ? labels[i] : num(v)}</button>`).join('')}</div></div>`;
  const ratingChoices = r => choice('আচরণ', 'behavior', [0, 1, 2, 3], r.behavior) + choice('হোমওয়ার্ক', 'homework', [0, 1.5, 3], r.homework, ['করেনি', 'আধা', 'করেছে']) + choice('পারফরম্যান্স', 'performance', [0, 1, 2, 3, 4], r.performance);
  const ratingRow = (id, day, shift, slot, r) => ({ coaching_id: S.me.coaching_id, student_id: id, day, behavior: r.behavior, homework: r.homework, performance: r.performance, comment: null, shift, slot: Math.min(3, Math.max(1, slot)), rated_by: S.uid });

  SCREENS['t.att'] = { title: 'উপস্থিতি গ্রহণ', sub: () => A.session === 'exam' ? 'পরীক্ষা' + (A.examTitle.trim() ? ': ' + A.examTitle.trim() : '') + (A.examScope === 'all' ? ' · সব স্লটে' : A.examScope === 'slot' ? ' · নির্দিষ্ট স্লটে' : '') : A.session === 'class' ? 'নিয়মিত ক্লাস' : 'আজ ক্লাস না পরীক্ষা, আগে বেছে নিন', render: async (el) => {
    const today = dhakaToday();
    if (A.day !== today) Object.assign(A, { day: today, session: null, examTitle: '', examScope: null, slot: 1, group: null, present: {}, ratings: {}, marked: false, key: '' });
    let list = null, loadFailed = false, savedRatings = null, contacts = null, routine = [], saved = '';
    T.contacts().then(c => { contacts = c; }).catch(() => { contacts = {}; });
    const subNow = () => setSub(SCREENS['t.att'].sub());
    // present/ratings belong to one (shift, slot): a new period starts from what the server has.
    const keyNow = () => A.shift + '|' + A.slot;

    async function load() {
      try {
        [routine, list] = await Promise.all([T.periods(), T.rosterOf(A.shift).then(sortRoster)]);
        await loadPeriod();
      } catch { loadFailed = true; list = []; }
    }
    async function loadPeriod() {
      if (A.key !== keyNow()) { A.present = {}; A.ratings = {}; A.key = keyNow(); }
      savedRatings = null;
      const ids = (list || []).map(s => s.id);
      if (!ids.length) return;
      const [att, rts] = await Promise.all([
        sel('period_attendance', `select=student_id,present&day=eq.${today}&shift=eq.${A.shift}&slot=eq.${A.slot}&student_id=${inList(ids)}`).catch(() => []),
        A.slot ? sel('class_ratings', `select=student_id,behavior,homework,performance&day=eq.${today}&shift=eq.${A.shift}&slot=eq.${A.slot}&student_id=${inList(ids)}`).catch(() => null) : Promise.resolve([]),
      ]);
      att.forEach(a => { if (!(a.student_id in A.present)) A.present[a.student_id] = !!a.present; });
      savedRatings = rts;
      (rts || []).forEach(r => { if (!A.ratings[r.student_id]) A.ratings[r.student_id] = { behavior: +r.behavior, homework: +r.homework, performance: +r.performance }; });
    }
    function saveRating(id, r) {
      A.ratings[id] = r;
      const row = ratingRow(id, today, A.shift, A.slot, r);
      serial(() => writeOrQueue('POST', '/rest/v1/class_ratings?on_conflict=student_id,day,shift,slot', [row], 'return=minimal,resolution=merge-duplicates')
        .catch(() => { A.error = 'রেটিং সংরক্ষণ হয়নি। আবার চাপুন।'; draw(); }));
    }
    function mark(id, value) {
      A.present[id] = value; A.marked = true;
      const session = A.session || 'class', sh = A.shift, sl = A.slot;
      if (value && session === 'class' && savedRatings !== null && !A.ratings[id]) saveRating(id, { ...RATING_DEFAULT });
      if (!value && A.ratings[id]) {
        delete A.ratings[id];
        serial(() => writeOrQueue('DELETE', `/rest/v1/class_ratings?student_id=eq.${id}&day=eq.${today}&shift=eq.${sh}&slot=eq.${sl}`, null).catch(() => {}));
      }
      const row = { coaching_id: S.me.coaching_id, student_id: id, day: today, shift: sh, slot: Math.min(3, Math.max(0, sl)), present: value,
        session, exam_title: session === 'exam' ? (A.examTitle.trim() || null) : null, teacher_id: S.uid, marked_at: new Date().toISOString() };
      serial(() => writeOrQueue('POST', '/rest/v1/period_attendance?on_conflict=student_id,day,shift,slot', row, 'return=minimal,resolution=merge-duplicates')
        .catch(() => { A.error = 'হাজিরা সংরক্ষণ হয়নি। আবার চাপুন।'; draw(); }));
    }

    function draw() {
      const online = navigator.onLine, pending = outbox.mine().length;
      let h = `<div class="card ${online && !pending ? 'teal' : 'sun'}"><div>${!online ? `অফলাইন মোড: হাজিরা ফোনে জমা হচ্ছে${pending ? ` (${bn(pending)}টি)` : ''}। নেট এলে নিজে থেকেই চলে যাবে।`
          : pending ? `অনলাইন: জমা থাকা ${bn(pending)}টি তথ্য পাঠানো হচ্ছে…` : 'অনলাইন: প্রতিটি চাপ সাথে সাথে সংরক্ষণ হচ্ছে, অভিভাবক বার্তা পাচ্ছেন।'}</div>
          ${A.error ? `<div class="err">${A.error}</div>` : ''}</div>
        <div class="card"><h3>আজ কী হচ্ছে?</h3><div class="seg" style="margin-top:8px">
          <button data-session="class" class="${A.session === 'class' ? 'on' : ''}"><b>নিয়মিত ক্লাস</b><span>হাজিরা + ক্লাস স্কোর</span></button>
          <button data-session="exam" class="${A.session === 'exam' ? 'on' : ''}"><b>পরীক্ষা</b><span>শুধু হাজিরা</span></button></div>
          ${A.session === 'exam' ? `<h4 style="margin-top:10px">আজ পরীক্ষা কখন?</h4><div class="seg" style="margin-top:6px">
            <button data-scope="all" class="${A.examScope === 'all' ? 'on' : ''}"><b>১ম, ২য়, ৩য় সব স্লটে</b><span>একবার হাজিরা</span></button>
            <button data-scope="slot" class="${A.examScope === 'slot' ? 'on' : ''}"><b>শুধু আমার স্লটে</b><span>নির্দিষ্ট সময়ে</span></button></div>
            ${A.marked ? `<div style="margin-top:8px">পরীক্ষা: ${esc(A.examTitle || 'নাম দেওয়া হয়নি')}</div>` : `<input id="examTitle" maxlength="60" placeholder="কোন পরীক্ষা (যেমন: মডেল টেস্ট · ইংরেজি ২য়)" value="${esc(A.examTitle)}" style="margin-top:8px">`}` : ''}
          ${A.marked ? '<div class="mute small">হাজিরা শুরু হয়ে গেছে, তাই আজকের ধরন আর বদলানো যাবে না।</div>' : ''}</div>`;
      if (A.session === 'exam' && !A.examScope) h += empty('note_edit', 'উপরে বেছে নিন: পরীক্ষা সব স্লটে, নাকি শুধু আপনার স্লটে।');
      else if (A.session) {
        h += T.shiftSeg(A.shift);
        const slots = T.slotsOf(routine, A.shift);
        if (A.slot !== 0) h += T.slotSeg(slots, A.slot);
        const groups = T.periodGroups(routine, list || [], A.shift, A.slot);
        const group = groups.find(g => g.key === A.group) || (groups.length === 1 ? groups[0] : null);
        if (groups.length > 1) h += `<div class="card"><h4>কোন ক্লাসের হাজিরা নিচ্ছেন?</h4><div class="stack" style="margin-top:8px">${groups.map(g => `<button class="pickrow ${g.key === group?.key ? 'on' : ''}" data-group="${g.key}"><b>${esc(g.title)}</b>${g.sub ? `<span class="mute small">${esc(g.sub)}</span>` : ''}</button>`).join('')}</div></div>`;
        if (list === null) h += skel(3);
        else if (loadFailed) h += `${empty('wifi_off', 'শিক্ষার্থীর তালিকা আনতে ইন্টারনেট লাগে। একবার তালিকা খোলার পর নেট গেলেও হাজিরা নেওয়া যাবে।')}<button class="btn" id="reload">আবার চেষ্টা করুন</button>`;
        else if (!list.length) h += empty('school', 'এই শিফটে কোনো শিক্ষার্থী নেই।');
        else if (groups.length > 1 && !group) h += empty('users', 'উপরে থেকে আপনার ক্লাসটি বেছে নিন।');
        else {
          const inGroup = list.filter(s => !group?.levels || group.levels.includes(s.class_level));
          const classes = [...new Set(inGroup.map(s => s.class_level))].sort((a, b) => a - b);
          if (!inGroup.length) h += empty('school', 'এই ক্লাসে কোনো শিক্ষার্থী নেই।');
          else {
            if (classes.length > 1) h += chipRow([['', 'সব ক্লাস'], ...classes.map(c => [c, 'ক্লাস ' + bn(c)])], A.cls ?? '');
            const shown = inGroup.filter(s => A.cls == null || s.class_level === A.cls);
            const presentN = shown.filter(s => A.present[s.id] === true).length;
            const unmarked = shown.filter(s => !(s.id in A.present));
            h += `<div class="card"><h3>উপস্থিত: ${bn(presentN)} / ${bn(shown.length)}</h3><div style="margin:8px 0">${bar(shown.length ? presentN / shown.length : 0)}</div>
              ${unmarked.length ? `<div class="mute small">${bn(unmarked.length)} জনের হাজিরা এখনো দেওয়া হয়নি</div>` : ''}</div>`;
            h += shown.map(st => {
              const p = A.present[st.id];
              let x = `<div class="stack"><div class="att ${p === true ? 'p' : p === false ? 'a' : ''}" data-toggle="${st.id}">${avatar(nameOf(st))}<div class="nm"><h3>${esc(nameOf(st))}</h3><div class="mute small">রোল ${esc(bn(st.roll || '—'))} · ক্লাস ${bn(st.class_level)}</div></div><span class="mark">${p === true ? '✓' : p === false ? '✕' : ''}</span></div>`;
              if (p === true && A.session === 'class' && A.ratings[st.id]) x += `<div class="rating" data-id="${st.id}"><div class="rhead"><span>আজকের রেটিং</span><b>${num(total(A.ratings[st.id]))}/১০</b></div>${ratingChoices(A.ratings[st.id])}</div>`;
              if (p === false) x += `<div class="absent">${contacts == null ? '<span class="mute small">অভিভাবকের নম্বর আনা হচ্ছে…</span>' : (contacts[st.id] || []).map(callRow).join('') || '<span class="mute small">অভিভাবকের নম্বর যোগ করা নেই</span>'}</div>`;
              return x + '</div>';
            }).join('');
            h += `<button class="btn" id="allP">সবাইকে উপস্থিত চিহ্নিত করুন</button>
              ${unmarked.length ? `<button class="btn coral" id="restA">বাকি ${bn(unmarked.length)} জনকে অনুপস্থিত হিসেবে সংরক্ষণ করুন</button>` : ''}
              ${saved ? `<div class="mute small">${saved}</div>` : ''}
              <div class="mute small">${A.session === 'class' ? 'উপস্থিত শিক্ষার্থীর নিচেই রেটিং দিন (শুরুতে ৮/১০ বসানো থাকে)। অভিভাবক হাজিরার সাথে আজকের স্কোরও পান।' : 'পরীক্ষার দিনে শুধু হাজিরা যায়; কোনো ক্লাস স্কোর পাঠানো হয় না।'}</div>`;
            el._shown = shown; el._unmarked = unmarked;
          }
        }
      }
      const y = window.scrollY;
      el.innerHTML = h;
      window.scrollTo(0, y);
      bind();
    }
    const reloadPeriod = async () => { A.group = null; A.cls = null; draw(); try { await loadPeriod(); } catch { /* keep what we have */ } draw(); };
    function bind() {
      el.querySelectorAll('[data-session]').forEach(b => b.onclick = async () => {
        if (A.marked) return;
        A.session = b.dataset.session;
        if (A.session === 'class') { A.examScope = null; if (A.slot === 0) { A.slot = 1; subNow(); return reloadPeriod(); } }
        subNow(); draw();
        if (list === null) { await load(); draw(); }
      });
      el.querySelectorAll('[data-scope]').forEach(b => b.onclick = async () => {
        if (A.marked) return;
        A.examScope = b.dataset.scope; subNow();
        const want = A.examScope === 'all' ? 0 : (A.slot || 1);
        if (list === null) { A.slot = want; A.group = null; A.cls = null; draw(); await load(); return draw(); }
        if (want !== A.slot) { A.slot = want; return reloadPeriod(); }
        A.group = null; A.cls = null; draw();
      });
      const t = el.querySelector('#examTitle'); if (t) t.oninput = () => { A.examTitle = t.value.slice(0, 60); subNow(); };
      el.querySelectorAll('[data-shift]').forEach(b => b.onclick = async () => {
        if (b.dataset.shift === A.shift) return;
        A.shift = b.dataset.shift; A.cls = null; A.group = null; A.slot = A.examScope === 'all' ? 0 : 1; list = null; loadFailed = false; draw(); await load(); draw();
      });
      el.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => { const n = +b.dataset.slot; if (n !== A.slot) { A.slot = n; reloadPeriod(); } });
      el.querySelectorAll('[data-group]').forEach(b => b.onclick = () => { if (b.dataset.group !== A.group) { A.group = b.dataset.group; A.cls = null; draw(); } });
      el.querySelectorAll('[data-chip]').forEach(b => b.onclick = () => { A.cls = b.dataset.chip === '' ? null : +b.dataset.chip; draw(); });
      el.querySelectorAll('[data-toggle]').forEach(b => b.onclick = () => { const id = b.dataset.toggle; mark(id, A.present[id] !== true); draw(); });
      el.querySelectorAll('.rating [data-k]').forEach(b => b.onclick = () => { const id = b.closest('.rating').dataset.id; saveRating(id, { ...A.ratings[id], [b.dataset.k]: +b.dataset.v }); draw(); });
      const r = el.querySelector('#reload'); if (r) r.onclick = async () => { list = null; loadFailed = false; draw(); await load(); draw(); };
      const all = el.querySelector('#allP'); if (all) all.onclick = () => { el._shown.forEach(s => mark(s.id, true)); draw(); };
      const rest = el.querySelector('#restA'); if (rest) rest.onclick = () => { el._unmarked.forEach(s => mark(s.id, false)); saved = 'অনুপস্থিতদের অভিভাবকও বার্তা পাবেন।'; draw(); };
    }
    if (A.session && !(A.session === 'exam' && !A.examScope)) await load();
    draw();
    let last = `${navigator.onLine}|${outbox.mine().length}|${contacts != null}`;
    const tick = setInterval(() => {
      if (cur().r !== 't.att') return clearInterval(tick);
      const now = `${navigator.onLine}|${outbox.mine().length}|${contacts != null}`;
      if (now !== last) { last = now; draw(); }
    }, 2000);
  } };

  // ---------- rate class (RateClassScreen) ----------
  const R = { shift: 'afternoon', slot: 1, open: null, ratings: {}, dirty: false, day: null, key: '' };
  SCREENS['t.rate'] = { title: 'ক্লাস রেটিং', sub: () => fmtDateY(dhakaToday()) + ' · ১০-এর মধ্যে', render: async (el) => {
    const today = dhakaToday();
    if (R.day !== today) Object.assign(R, { day: today, ratings: {}, dirty: false, open: null, key: '' });
    let list = null, saved = null, busy = false, msg = '', routine = [];
    async function load() {
      [routine, list] = await Promise.all([T.periods(), T.rosterOf(R.shift).then(sortRoster)]);
      const k = R.shift + '|' + R.slot;
      if (R.key !== k) { R.ratings = {}; R.dirty = false; R.open = null; R.key = k; }
      saved = list.length ? await sel('class_ratings', `select=student_id,behavior,homework,performance&day=eq.${today}&shift=eq.${R.shift}&slot=eq.${R.slot}&student_id=${inList(list.map(s => s.id))}`) : [];
      const m = Object.fromEntries(saved.map(r => [r.student_id, r]));
      list.forEach(s => { if (!R.ratings[s.id]) R.ratings[s.id] = m[s.id] ? { behavior: +m[s.id].behavior, homework: +m[s.id].homework, performance: +m[s.id].performance } : { ...RATING_DEFAULT }; });
    }
    function draw() {
      let h = T.shiftSeg(R.shift) + T.slotSeg(T.slotsOf(routine, R.shift), R.slot) + '<div class="card cream mute">সবার জন্য ৮ বসানো আছে (আচরণ ৩ + হোমওয়ার্ক ৩ + পারফরম্যান্স ২)। যাদের আলাদা, শুধু তাদের নামে চাপ দিয়ে বদলান, তারপর সংরক্ষণ করুন।</div>';
      if (list === null || saved === null) h += skel(3);
      else if (!list.length) h += empty('school', 'এই ব্যাচে কোনো শিক্ষার্থী নেই।');
      else {
        if (saved.length && !R.dirty) h += '<div>' + pill('আজকের রেটিং আগেই সংরক্ষিত হয়েছে, চাইলে বদলাতে পারেন', 'teal') + '</div>';
        h += list.map(st => {
          const r = R.ratings[st.id], t = total(r), open = R.open === st.id;
          return `<div class="card rrow ${open ? 'open' : ''}"><div class="rtop" data-open="${st.id}">${avatar(nameOf(st))}<div class="nm"><h3>${esc(nameOf(st))}</h3>
            <div class="mute small">রোল ${esc(bn(st.roll || '—'))} · আচরণ ${num(r.behavior)} · কাজ ${hwLabel(r.homework)} · পারফ. ${num(r.performance)}</div></div><span class="score ${scoreClass(t)}">${num(t)}</span></div>
            ${open ? `<div class="rating" data-id="${st.id}">${ratingChoices(r)}</div>` : ''}</div>`;
        }).join('');
        h += `<button class="btn" id="saveR" ${busy ? 'disabled' : ''}>${busy ? 'সংরক্ষণ হচ্ছে…' : `সংরক্ষণ করুন (${bn(list.length)} জন)`}</button>${msg ? `<div class="center" style="color:var(--teal-dark)">${msg}</div>` : ''}`;
      }
      const y = window.scrollY; el.innerHTML = h; window.scrollTo(0, y);
      el.querySelectorAll('[data-shift]').forEach(b => b.onclick = async () => { if (b.dataset.shift === R.shift) return; R.shift = b.dataset.shift; R.slot = 1; msg = ''; list = null; saved = null; draw(); await load(); draw(); });
      el.querySelectorAll('[data-slot]').forEach(b => b.onclick = async () => { const n = +b.dataset.slot; if (n === R.slot) return; R.slot = n; msg = ''; saved = null; draw(); await load(); draw(); });
      el.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { R.open = R.open === b.dataset.open ? null : b.dataset.open; draw(); });
      el.querySelectorAll('.rating [data-k]').forEach(b => b.onclick = () => { const id = b.closest('.rating').dataset.id; R.ratings[id] = { ...R.ratings[id], [b.dataset.k]: +b.dataset.v }; R.dirty = true; msg = ''; draw(); });
      const sv = el.querySelector('#saveR');
      if (sv) sv.onclick = async () => {
        busy = true; draw();
        const rows = list.map(s => ratingRow(s.id, today, R.shift, R.slot, R.ratings[s.id]));
        try {
          const sent = await serial(() => writeOrQueue('POST', '/rest/v1/class_ratings?on_conflict=student_id,day,shift,slot', rows, 'return=minimal,resolution=merge-duplicates'));
          R.dirty = false; msg = sent ? 'রেটিং সংরক্ষিত হয়েছে। শিক্ষার্থী ও অভিভাবক নিজেরটা দেখতে পাবেন।' : 'ইন্টারনেট নেই, তাই ফোনে রাখা হয়েছে। নেট এলে নিজে থেকেই চলে যাবে।';
        } catch { msg = 'সংরক্ষণ করা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।'; }
        busy = false; draw();
      };
    }
    await load(); draw();
  } };

  // ---------- shared read screens (same as family) ----------
  SCREENS.notices = { title: 'সকল নোটিশ', render: async (el) => {
    const ns = await cached('notices', () => sel('notices', 'select=id,title,body,audience,class_level,created_at&order=created_at.desc&limit=60'));
    const AUD = { all: 'সবাই', guardians: 'অভিভাবক', students: 'শিক্ষার্থী', teachers: 'শিক্ষক' };
    el.innerHTML = ns.map(n => `<div class="card"><div class="mute small">${fmtDateY(n.created_at)} · ${AUD[n.audience] || ''}${n.class_level ? ' · ক্লাস ' + bn(n.class_level) : ''}</div><h3>${esc(n.title)}</h3><div style="white-space:pre-wrap;margin-top:4px">${esc(n.body)}</div></div>`).join('') || empty('bell', 'এখনো কোনো নোটিশ নেই।');
  } };
  SCREENS.director = { title: 'পরিচালকের বার্তা', render: async (el) => {
    const ms = await cached('director', () => sel('director_messages', 'select=id,title,body,video_url,published_on&order=published_on.desc'));
    el.innerHTML = ms.map(m => `<div class="card"><div class="mute small">${fmtDateY(m.published_on)}</div><h3>${esc(m.title)}</h3><div style="white-space:pre-wrap;margin-top:4px">${esc(m.body)}</div>${m.video_url ? `<a class="pill sun" style="margin-top:8px" href="${esc(m.video_url)}" target="_blank" rel="noopener">ভিডিও দেখুন</a>` : ''}</div>`).join('') || empty('mic', 'এখনো কোনো বার্তা নেই।');
  } };
  SCREENS.materials = { title: 'শিক্ষা উপকরণ', sub: c => 'ক্লাস ' + bn(c), render: async (el, cls) => {
    cls = +cls || 5;
    const ms = await cached('mat' + cls, () => sel('materials', `select=id,chapter,title,kind,url,storage_path,subject:subjects(name)&class_level=eq.${cls}&order=created_at.desc`));
    el.innerHTML = chipRow(CLASSES.map(c => [c, 'ক্লাস ' + bn(c)]), cls) +
      (ms.map(m => `<div class="card tap" data-url="${esc(m.url || '')}" style="display:flex;gap:12px;align-items:center">${chip(m.kind === 'pdf' ? 'document' : 'book', 40)}<div><h3>${esc(m.title)}</h3><div class="mute small">${esc(m.subject?.name || '')}${m.chapter ? ' · ' + esc(m.chapter) : ''}</div></div></div>`).join('') || empty('book', 'এই ক্লাসের জন্য এখনো কোনো উপকরণ নেই।'));
    el.querySelectorAll('[data-chip]').forEach(b => b.onclick = () => nav.replace('materials', b.dataset.chip));
    el.querySelectorAll('[data-url]').forEach(b => b.onclick = () => b.dataset.url ? window.open(b.dataset.url, '_blank', 'noopener') : toast('লিংক নেই'));
  } };
  SCREENS.soon = { title: p => p || 'শীঘ্রই', render: async (el) => {
    el.innerHTML = `<div class="card">${empty('ai_spark', 'এই অংশটি শীঘ্রই ওয়েবে আসছে।' + (isAndroid ? ' ততদিন অ্যান্ড্রয়েড অ্যাপে ব্যবহার করুন।' : ''))}</div>${apkBanner()}`;
  } };
})();

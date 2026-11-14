'use strict';
// Teacher & admin screens — mirror TeacherScreens.kt, ClassroomScreens.kt (RateClass), StudentListScreens.kt.
// Class writes go through writeOrQueue so they survive a lost connection (same as the APK's Outbox).
(function () {
  const RATING_DEFAULT = { behavior: 3, homework: 3, performance: 2 }; // 8/10, same as RatingScale.default
  const T = window.T = {}; // shared helpers for the other teacher modules
  const ST_COLS = 'id,class_level,roll,batch_id,profile:profiles!students_profile_id_fkey(full_name,login_id)';
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
  SCREENS['t.home'] = { home: true, title: () => 'স্বাগতম, ' + S.me.full_name,
    sub: () => (isAdmin() ? 'অ্যাডমিন' : 'শিক্ষক') + ' · ' + todayBnLong() + (shiftNow() ? ` · এখন ${shiftBn(shiftNow())} শিফট` : ''), hdr: 'var(--teal-dark)',
    trail: () => '<button class="pill white" data-logout>লগআউট</button>', render: async (el) => {
    flushOutbox().catch(() => {});
    const admin = isAdmin(), today = dhakaToday(), now = shiftNow();
    // Same order as StaffHome.kt: notices, staff notes, offline, today per shift, work waiting, 4 big jobs, folding categories.
    const [nh, perShift, todo] = await Promise.all([
      noticeHighlight(null),
      Promise.all(SHIFTS.map(async s => {
        try {
          const l = await T.rosterOf(s.id);
          if (!l.length) return [0, 0];
          const a = await sel('attendance', `select=student_id,check_in&date=eq.${today}&student_id=${inList(l.map(x => x.id))}`);
          return [l.length, new Set(a.filter(x => x.check_in).map(x => x.student_id)).size];
        } catch { return null; }
      })),
      Promise.all([
        sel('student_change_requests', `select=id&status=eq.pending${admin ? '' : '&requested_by=eq.' + S.uid}&limit=200`).then(r => r.length).catch(() => 0),
        admin ? sel('phone_change_requests', 'select=id&status=eq.pending&limit=200').then(r => r.length).catch(() => 0) : 0,
        admin ? sel('leave_requests', 'select=id&status=eq.pending&limit=200').then(r => r.length).catch(() => 0) : 0,
      ]),
    ]);
    const badge = n => n > 0 ? bn(n) : null;
    const manage = admin ? [['users', 'অ্যাকাউন্ট ব্যবস্থাপনা', 'a.users'], ['note_edit', 'প্রোফাইল সম্পাদনা', 'a.people'], ['calendar', 'ক্লাস রুটিন', 'a.routine'],
      ['question', 'পরিবর্তনের অনুরোধ', 't.requests', badge(todo[0])], ['phone', 'নম্বর সংশোধন', 'a.phones', badge(todo[1])], ['card', 'ফি ব্যবস্থাপনা', 'a.fees'], ['money', 'শিক্ষকদের সম্মানী', 't.honorarium']] : [];
    const daily = [['attendance', 'উপস্থিতি গ্রহণ', 't.att'], ['star', 'ক্লাস রেটিং', 't.rate'], ['signal', 'শিক্ষার্থীদের সংকেত', 't.signals'], ['question', 'প্রশ্ন বক্স', 't.doubts'], ['mic', 'ভয়েস ও মুখস্থ পড়া', 't.voice'], ['camera', 'CCTV যাচাই', 't.gate']];
    const exams = [['numbers', 'নম্বর এন্ট্রি', 't.marks'], ['document', 'রিপোর্ট কার্ড ও টপার', 'a.reports'], ['calendar', 'পরীক্ষার রুটিন', 't.routine'], ['calendar', 'পরীক্ষার পরিকল্পনা', 't.exams'],
      ['archive', 'প্রশ্ন ব্যাংক', 't.qbank'], ['ai_spark', 'AI প্রশ্নপত্র তৈরি', 't.aipaper'], ['note_edit', 'AI খাতা মূল্যায়ন', 't.grading'], ['seat', 'সিট প্ল্যান', 't.seat']];
    const progress = [['alert', 'ঝুঁকিতে থাকা শিক্ষার্থী', 't.risk'], ['chart', 'ব্যাচ তুলনা', 't.compare'], ['target', 'সাপ্তাহিক চ্যালেঞ্জ', 't.challenges'], ['book', 'সিলেবাস ট্র্যাকার', 'syllabus:6'], ['flashcards', 'ফ্ল্যাশকার্ড', 'flash:6'], ['book', 'শিক্ষা উপকরণ', 'materials:5']];
    const talk = [['megaphone', 'নোটিশ পাঠান', 't.notice'], ['bell', 'সকল নোটিশ', 'notices'], ['chat', 'অভিভাবকদের বার্তা', 'chats'], ['handshake', 'অভিভাবক মিটিং', 'meetings'], ['mic', 'পরিচালকের বার্তা', 'director']];
    const office = [['palm', 'ছুটি ও বদলি', 't.leave', admin ? badge(todo[2]) : null], ...(admin ? [] : [['money', 'আমার সম্মানী', 't.honorarium'], ['question', 'আমার অনুরোধ', 't.requests', badge(todo[0])]]), ['lock', 'পিন বদলান', 'pin']];
    const fix = l => l.map(([ic, t, r, b]) => [ic, t, link(r, t), b]);
    const scr = admin ? 'admin' : 'teacher';
    el.innerHTML = `${nh}<div id="snotes"></div>${pendingCard()}
      <div class="card"><div style="display:flex;align-items:center"><h3 style="flex:1">আজকের উপস্থিতি</h3><b class="tap" id="hreload" style="color:var(--teal-dark);font-size:14px">হালনাগাদ</b></div>
        <div class="mute small">শিফটে চাপলে তালিকা ও অভিভাবকের নম্বর</div>
        <div class="shifts3">${SHIFTS.map((s, i) => { const live = s.id === now, v = perShift[i]; return `<button class="${live ? 'live' : ''}" data-go="t.shift:${s.id}"><span class="lic">${I(s.icon)}</span><small>${s.bn}${live ? ' · এখন' : ''}</small><b>${v ? `${bn(v[1])}/${bn(v[0])}` : '…'}</b><small>উপস্থিত</small></button>`; }).join('')}</div></div>
      ${admin ? todoCard([['শিক্ষকের পরিবর্তনের অনুরোধ', todo[0], 't.requests'], ['অভিভাবকের নম্বর সংশোধন', todo[1], 'a.phones'], ['ছুটির আবেদন', todo[2], 't.leave']], false) : ''}
      <div class="grid2">${action('attendance', 'উপস্থিতি', 'ক্লাস বা পরীক্ষা', 't.att')}${action('star', 'ক্লাস রেটিং', 'আজকের স্কোর', 't.rate')}${action('numbers', 'নম্বর এন্ট্রি', 'মডেল টেস্ট', 't.marks')}${action('megaphone', 'নোটিশ', 'সবাইকে জানান', 't.notice')}</div>
      ${dashSection(scr, 'manage', 'users', 'ব্যবস্থাপনা', fix(manage), true)}
      ${dashSection(scr, 'daily', 'attendance', 'প্রতিদিনের ক্লাস', fix(daily), !admin)}
      ${dashSection(scr, 'exams', 'note_edit', 'পরীক্ষা ও ফলাফল', fix(exams), true)}
      ${dashSection(scr, 'progress', 'chart', 'শিক্ষার্থী ও অগ্রগতি', fix(progress), false)}
      ${dashSection(scr, 'talk', 'chat', 'যোগাযোগ ও নোটিশ', fix(talk), false)}
      ${dashSection(scr, 'office', 'palm', admin ? 'আমার অফিস' : 'অফিস', fix(office), false)}
      <div class="mute small" style="padding:0 4px">কোনো বিভাগে চাপ দিলে খোলে বা বন্ধ হয়; ফোন মনে রাখে কোনগুলো খোলা।</div>
      ${apkBanner()}`;
    bindDash(el);
    el.querySelector('#hreload').onclick = () => render();
    if (T.staffNotesCard) T.staffNotesCard(el.querySelector('#snotes')).catch(() => {});
    bindSync(el);
    setTimeout(apkPopup, 1500);
  } };

  // ---------- shift list (ShiftStudentsScreen, N12) ----------
  // Today's state per student: RPC attendance_today; same rules computed by hand while the RPC is not live yet.
  T.todayStates = async (shift, ids) => {
    try {
      const m = {};
      (await rpc('attendance_today', { p_shift: shift }) || []).forEach(r => { m[r.student_id] = r.state; });
      return m;
    } catch (e) { if (!(e.status === 404 || /PGRST202/.test(e.body || ''))) throw e; }
    if (!ids.length) return {};
    const today = dhakaToday();
    const [pa, at] = await Promise.all([
      sel('period_attendance', `select=student_id,present&day=eq.${today}&shift=eq.${shift}&student_id=${inList(ids)}`),
      sel('attendance', `select=student_id,check_in&date=eq.${today}&student_id=${inList(ids)}`).catch(() => []),
    ]);
    const m = {};
    pa.forEach(r => { if (r.present) m[r.student_id] = 'present'; else if (!m[r.student_id]) m[r.student_id] = 'absent'; });
    at.forEach(r => { if (r.check_in) m[r.student_id] = 'present'; });
    return m;
  };
  const stuFields = s => ({ name: nameOf(s), login: s.profile?.login_id, roll: s.roll });
  const LIGHT = { present: 'g', absent: 'r' };
  SCREENS['t.shift'] = { title: p => shiftBn(p) + ' শিফট', sub: () => 'আজকের উপস্থিতি', render: async (el, shift) => {
    const [list, contacts] = await Promise.all([T.rosterOf(shift), T.contacts().catch(() => ({}))]);
    if (!list.length) { el.innerHTML = empty('school', 'এই শিফটে কোনো শিক্ষার্থী নেই।'); return; }
    let states = null; // null = could not be loaded (offline): lights stay grey, no summary
    try { states = await T.todayStates(shift, list.map(s => s.id)); } catch { /* keep null */ }
    let cls = null, q = '', byRoll = false;
    const rank = s => states?.[s.id] === 'absent' ? 0 : states?.[s.id] === 'present' ? 2 : 1;
    const callBtn = st => {
      const gs = contacts[st.id] || [];
      if (!gs.length) return '<span class="nonum"><span class="callb off">' + I('phone') + '</span><small>নম্বর নেই</small></span>';
      if (gs.length === 1) return `<a class="callb" href="${esc(telHref(gs[0].phone))}" aria-label="কল করুন">${I('phone')}</a>`;
      return `<button class="callb" data-call="${esc(st.id)}" aria-label="কল করুন">${I('phone')}</button>`;
    };
    const route = id => isAdmin() ? 'a.editstudent' : 't.reqchange';
    function callSheet(st) {
      const gs = contacts[st.id] || [];
      sheet(`<h2>${esc(nameOf(st))}</h2><div class="stack">${gs.map((g, i) => `<div class="card"><div class="call"><b>${esc(g.relation || 'অভিভাবক')} · ${esc(bn(g.phone))}</b><a class="callb" href="${esc(telHref(g.phone))}" aria-label="কল করুন">${I('phone')}</a></div>
        ${g.name ? `<div class="mute small">${esc(g.name)}</div>` : ''}<button class="link" data-report="${i}">নম্বর ভুল? জানান</button></div>`).join('')}</div><button class="link" data-close>বন্ধ করুন</button>`, (s, close) => {
        s.querySelectorAll('[data-report]').forEach(b => b.addEventListener('click', () => { const g = gs[+b.dataset.report]; close(); reportPhone(st.id, g.id, g.phone); }));
      });
    }
    function drawRows() {
      const base = list.filter(s => cls == null || s.class_level === cls);
      const cnt = k => base.filter(s => states?.[s.id] === k).length;
      let ordered = sortRoster(base);
      if (!byRoll) ordered = ordered.map((s, i) => [rank(s), i, s]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]);
      const shown = Search.filter(ordered, q, stuFields);
      el.querySelector('#rows').innerHTML = `${states ? `<div class="chips sums"><span class="pill good">উপস্থিত ${bn(cnt('present'))}</span><span class="pill bad">অনুপস্থিত ${bn(cnt('absent'))}</span><span class="pill">বাকি ${bn(base.length - cnt('present') - cnt('absent'))}</span><button class="pill teal" id="ord">${byRoll ? 'আগে অনুপস্থিত' : 'রোল অনুযায়ী'}</button></div>` : '<div class="mute small">আজকের অবস্থা আনা যায়নি, নেট এলে আবার খুলুন।</div>'}
        ${shown.map(st => `<div class="srow" data-st="${esc(st.id)}"><span class="lt ${LIGHT[states?.[st.id]] || 'n'}"></span><div class="nm"><h3>${esc(nameOf(st))}</h3><div class="mute small">ক্লাস ${bn(st.class_level)} · রোল ${esc(bn(st.roll || '—'))}</div></div>${callBtn(st)}</div>`).join('') || empty('search', 'কাউকে পাওয়া যায়নি।')}`;
      el.querySelectorAll('.srow').forEach(r => r.addEventListener('click', e => {
        if (e.target.closest('.callb')) return;
        go(route(), r.dataset.st);
      }));
      el.querySelectorAll('.srow a.callb').forEach(a => a.addEventListener('click', e => e.stopPropagation()));
      el.querySelectorAll('button[data-call]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); callSheet(list.find(s => s.id === b.dataset.call)); }));
      const o = el.querySelector('#ord'); if (o) o.addEventListener('click', () => { byRoll = !byRoll; drawRows(); });
    }
    function draw() {
      const classes = [...new Set(list.map(s => s.class_level))].sort((a, b) => a - b);
      el.innerHTML = `${classes.length > 1 ? chipRow([['', 'সব ক্লাস'], ...classes.map(c => [c, 'ক্লাস ' + bn(c)])], cls ?? '') : ''}
        <input id="sq" maxlength="40" placeholder="নাম, রোল বা আইডি দিয়ে খুঁজুন" value="${esc(q)}" autocomplete="off"><div id="rows" class="stack"></div>`;
      el.querySelectorAll('[data-chip]').forEach(b => b.addEventListener('click', () => { cls = b.dataset.chip === '' ? null : +b.dataset.chip; draw(); }));
      const qi = el.querySelector('#sq'); qi.addEventListener('input', () => { q = qi.value.slice(0, 40); drawRows(); });
      drawRows();
    }
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

  // ---------- take attendance (TakeAttendanceScreen, N6) ----------
  // One row per student per (day, shift, period) in period_attendance; slot 0 = exam through the whole shift.
  // A trigger rolls it up into the daily attendance row the guardian sees (periods.sql, exam-slot.sql).
  // Marking is local until "সংরক্ষণ"; then a 5-second undo window; then ONE batch write. Saved rows are locked:
  // changing them needs a reason and goes through the RPCs change_attendance / change_rating.
  const A = { session: null, examTitle: '', examScope: null, shift: 'afternoon', slot: 1, group: null, cls: null, q: '', bk: {}, marked: false, error: null, day: null, key: '', redraw: null };
  const bucket = (key = A.key) => (A.bk[key] ||= { local: {}, lr: {}, saved: {}, savedR: null });
  const choice = (label, key, values, selected, labels) =>
    `<div class="choice"><span>${label}</span><div>${values.map((v, i) => `<button data-k="${key}" data-v="${v}" class="${+selected === v ? 'on' : ''}">${labels ? labels[i] : num(v)}</button>`).join('')}</div></div>`;
  const ratingChoices = r => choice('আচরণ', 'behavior', [0, 1, 2, 3], r.behavior) + choice('হোমওয়ার্ক', 'homework', [0, 1.5, 3], r.homework, ['করেনি', 'আধা', 'করেছে']) + choice('পারফরম্যান্স', 'performance', [0, 1, 2, 3, 4], r.performance);
  const ratingRow = (id, day, shift, slot, r) => ({ coaching_id: S.me.coaching_id, student_id: id, day, behavior: r.behavior, homework: r.homework, performance: r.performance, comment: null, shift, slot: Math.min(3, Math.max(1, slot)), rated_by: S.uid });
  const ratingText = r => `আচরণ ${num(r.behavior)} · হোমওয়ার্ক ${hwLabel(r.homework)} · পারফরম্যান্স ${num(r.performance)}`;
  const WHY = ['ভুল চাপ পড়েছিল', 'দেরিতে এসেছে', 'আগে ভুল শুনেছিলাম', 'অন্য কারণ'];

  // --- save popup with undo (lives on <body>, so it survives leaving the screen) ---
  let PEND = null, popT = null;
  const popEl = () => document.getElementById('attpop') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'attpop', className: 'attpop' }));
  const popHide = () => { const p = document.getElementById('attpop'); if (p) p.remove(); clearTimeout(popT); };
  const popText = (t, ms) => { clearTimeout(popT); popEl().innerHTML = `<span>${esc(t)}</span>`; if (ms) popT = setTimeout(popHide, ms); };
  const redrawNow = () => { if (A.redraw && cur().r === 't.att') A.redraw(); };
  function popCount() {
    const left = Math.max(0, PEND.deadline - Date.now());
    const p = popEl();
    p.innerHTML = `<span>সংরক্ষণ হচ্ছে… <b>${bn(Math.ceil(left / 1000))}</b></span><button class="pill sun" id="undo">ফিরিয়ে নিন</button><div class="pbar"><i style="width:${(left / 50).toFixed(1)}%"></i></div>`;
    p.querySelector('#undo').addEventListener('click', undoPend);
  }
  function tickPend() {
    if (!PEND) return;
    if (cur().r !== 't.att' || Date.now() >= PEND.deadline) return commitPend();
    popCount();
  }
  function undoPend() {
    if (!PEND || PEND.busy) return;
    clearInterval(PEND.timer); PEND = null; popHide(); redrawNow();
  }
  function startSave(ctx) {
    if (PEND) return;
    PEND = { ...ctx, deadline: Date.now() + 5000, busy: false };
    popCount();
    PEND.timer = setInterval(tickPend, 250);
    redrawNow();
  }
  function commitPend() {
    const p = PEND;
    if (!p || p.busy) return;
    p.busy = true; clearInterval(p.timer);
    popText('সংরক্ষণ হচ্ছে…');
    serial(async () => {
      let queued = false, attOk = false;
      try {
        const r1 = await writeOrQueue('POST', '/rest/v1/period_attendance?on_conflict=student_id,day,shift,slot', p.rows, 'return=minimal,resolution=merge-duplicates');
        attOk = true; queued = !r1;
        const b = bucket(p.key);
        p.rows.forEach(r => { b.saved[r.student_id] = { present: r.present, session: r.session, exam_title: r.exam_title }; delete b.local[r.student_id]; });
        A.marked = true;
        if (p.rrows.length) {
          const r2 = await writeOrQueue('POST', '/rest/v1/class_ratings?on_conflict=student_id,day,shift,slot', p.rrows, 'return=minimal,resolution=merge-duplicates');
          queued = queued || !r2;
          b.savedR ||= {};
          p.rrows.forEach(r => { b.savedR[r.student_id] = { behavior: +r.behavior, homework: +r.homework, performance: +r.performance }; delete b.lr[r.student_id]; });
        }
        A.error = null;
        popText(queued ? 'ফোনে জমা আছে, নেট এলে যাবে' : 'সংরক্ষিত', 3000);
      } catch (e) {
        A.error = attOk ? 'উপস্থিতি সংরক্ষণ হয়েছে, কিন্তু রেটিং যায়নি। রেটিং বদলে আবার দিন।' : 'সংরক্ষণ হয়নি। আবার চেষ্টা করুন।';
        popText(attOk ? 'রেটিং সংরক্ষণ হয়নি' : 'সংরক্ষণ হয়নি, আবার চেষ্টা করুন', 4000);
      }
      PEND = null;
      redrawNow();
    });
  }
  // Never lose a save: leaving the tab/app during the 5 seconds sends it at once.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') commitPend(); });
  window.addEventListener('pagehide', commitPend);

  // --- reason bottom sheet for locked rows ---
  async function callRpc(name, args) {
    try { await rpc(name, args); return true; }
    catch (e) {
      if (isOfflineErr(e)) toast('নেট নেই, পরে চেষ্টা করুন');
      else if (e.status === 404 || /PGRST202/.test(e.body || '')) toast('এই সুবিধা এখনো চালু হয়নি।');
      else if (/reason_required/.test(e.body || '')) toast('কারণ লিখুন, কমপক্ষে ৩ অক্ষর।');
      else toast('বদলানো যায়নি। আবার চেষ্টা করুন।');
      return false;
    }
  }
  // body: html shown under the title; needReason: false when the value is new (no change to log)
  function reasonSheet({ lead, body, needReason = true, ok = () => true, label = 'বদলে দিন', onOpen, run }) {
    sheet(`<h2>${needReason ? 'পরিবর্তনের কারণ' : 'রেটিং দিন'}</h2>${lead ? `<div class="mute">${lead}</div>` : ''}${body || ''}
      ${needReason ? `<div class="chips">${WHY.map(w => `<button class="chip-btn" data-why="${esc(w)}">${esc(w)}</button>`).join('')}</div>
      <textarea id="rsn" maxlength="200" rows="2" placeholder="কারণ লিখুন"></textarea>` : ''}
      <button class="btn" id="rgo" disabled>${esc(label)}</button><button class="link" data-close>বাতিল</button>`, (s, close) => {
      const ta = s.querySelector('#rsn'), go_ = s.querySelector('#rgo');
      const reason = () => (ta ? ta.value.trim() : '');
      const upd_ = () => { go_.disabled = !(ok() && (!needReason || (reason().length >= 3 && reason().length <= 200))); };
      s.querySelectorAll('[data-why]').forEach(b => b.addEventListener('click', () => {
        const w = b.dataset.why; ta.value = w === 'অন্য কারণ' ? '' : w; if (w === 'অন্য কারণ') ta.focus(); upd_();
      }));
      if (ta) ta.addEventListener('input', upd_);
      onOpen?.(s, upd_);
      go_.addEventListener('click', async () => {
        go_.disabled = true;
        if (await run(reason())) close(); else upd_();
      });
      upd_();
    });
  }

  SCREENS['t.att'] = { title: 'উপস্থিতি গ্রহণ', sub: () => A.session === 'exam' ? 'পরীক্ষা' + (A.examTitle.trim() ? ': ' + A.examTitle.trim() : '') + (A.examScope === 'all' ? ' · সব স্লটে' : A.examScope === 'slot' ? ' · নির্দিষ্ট স্লটে' : '') : A.session === 'class' ? 'নিয়মিত ক্লাস' : 'আজ ক্লাস না পরীক্ষা, আগে বেছে নিন', render: async (el) => {
    const today = dhakaToday();
    if (A.day !== today) { if (PEND) commitPend(); Object.assign(A, { day: today, session: null, examTitle: '', examScope: null, slot: 1, group: null, q: '', bk: {}, marked: false, key: '', error: null }); }
    let list = null, loadFailed = false, contacts = null, routine = [];
    T.contacts().then(c => { contacts = c; }).catch(() => { contacts = {}; });
    const subNow = () => setSub(SCREENS['t.att'].sub());
    const keyNow = () => A.shift + '|' + A.slot;
    const sessionNow = () => A.session || 'class';

    async function load() {
      try {
        [routine, list] = await Promise.all([T.periods(), T.rosterOf(A.shift).then(sortRoster)]);
        await loadPeriod();
      } catch { loadFailed = true; list = []; }
    }
    // What the server already has for this (shift, slot): those rows are locked.
    async function loadPeriod() {
      A.key = keyNow();
      const b = bucket();
      const ids = (list || []).map(s => s.id);
      if (!ids.length) return;
      const [att, rts] = await Promise.all([
        sel('period_attendance', `select=student_id,present,session,exam_title&day=eq.${today}&shift=eq.${A.shift}&slot=eq.${A.slot}&student_id=${inList(ids)}`).catch(() => []),
        A.slot ? sel('class_ratings', `select=student_id,behavior,homework,performance&day=eq.${today}&shift=eq.${A.shift}&slot=eq.${A.slot}&student_id=${inList(ids)}`).catch(() => null) : Promise.resolve({}),
      ]);
      att.forEach(a => { b.saved[a.student_id] = { present: !!a.present, session: a.session || 'class', exam_title: a.exam_title || null }; delete b.local[a.student_id]; });
      if (rts === null) b.savedR = null;
      else if (Array.isArray(rts)) { b.savedR = {}; rts.forEach(r => { b.savedR[r.student_id] = { behavior: +r.behavior, homework: +r.homework, performance: +r.performance }; }); }
      else b.savedR = {};
      if (att.length) A.marked = true;
    }
    const statusOf = (b, id) => id in b.local ? b.local[id] : b.saved[id]?.present;
    const wantRating = () => sessionNow() === 'class' && A.slot >= 1;
    function ensureLr(b) {
      Object.keys(b.local).forEach(id => {
        if (b.local[id] && wantRating() && b.savedR !== null && !b.lr[id]) b.lr[id] = b.savedR[id] ? { ...b.savedR[id], touched: true } : { ...RATING_DEFAULT };
      });
    }
    function cycle(id) {
      const b = bucket();
      const cur_ = b.local[id];
      if (cur_ === undefined) b.local[id] = true;
      else if (cur_ === true) { b.local[id] = false; delete b.lr[id]; }
      else { delete b.local[id]; }
      A.error = null;
    }
    function save() {
      const b = bucket(); ensureLr(b);
      const ids = Object.keys(b.local);
      if (!ids.length || PEND) return;
      const session = sessionNow(), now = new Date().toISOString();
      const rows = ids.map(id => ({ coaching_id: S.me.coaching_id, student_id: id, day: today, shift: A.shift, slot: Math.min(3, Math.max(0, A.slot)), present: b.local[id],
        session, exam_title: session === 'exam' ? (A.examTitle.trim() || null) : null, teacher_id: S.uid, marked_at: now }));
      const rrows = wantRating() && b.savedR !== null
        ? ids.filter(id => b.local[id]).map(id => ratingRow(id, today, A.shift, A.slot, b.lr[id] || RATING_DEFAULT)) : [];
      startSave({ rows, rrows, key: A.key });
    }

    // locked status: change with a reason
    function changeStatus(st) {
      const b = bucket(), sv = b.saved[st.id], to = !sv.present;
      reasonSheet({
        lead: `${esc(nameOf(st))}: ${sv.present ? 'উপস্থিত' : 'অনুপস্থিত'} থেকে ${to ? 'উপস্থিত' : 'অনুপস্থিত'}`,
        run: async reason => {
          const ok = await callRpc('change_attendance', { p_student: st.id, p_day: today, p_shift: A.shift, p_slot: Math.min(3, Math.max(0, A.slot)), p_present: to, p_session: sv.session || 'class', p_exam_title: sv.exam_title, p_reason: reason });
          if (!ok) return false;
          sv.present = to;
          if (!to) { if (b.savedR) delete b.savedR[st.id]; }
          else if (sv.session !== 'exam' && A.slot >= 1 && b.savedR && !b.savedR[st.id]) {
            const d = RATING_DEFAULT;
            if (await callRpc('change_rating', { p_student: st.id, p_day: today, p_shift: A.shift, p_slot: A.slot, p_behavior: d.behavior, p_homework: d.homework, p_performance: d.performance, p_reason: null })) b.savedR[st.id] = { ...d };
          }
          toast('বদলে দেওয়া হয়েছে'); draw(); return true;
        },
      });
    }
    // locked rating: change with a reason (or give the first rating, no reason needed)
    function changeRating(st) {
      const b = bucket(), old = b.savedR[st.id];
      let d = old ? { ...old } : { ...RATING_DEFAULT };
      reasonSheet({
        needReason: !!old,
        label: old ? 'বদলে দিন' : 'সংরক্ষণ',
        lead: esc(nameOf(st)),
        body: '<div class="rating"><div id="rc"></div></div>',
        ok: () => !old || d.behavior !== old.behavior || d.homework !== old.homework || d.performance !== old.performance,
        onOpen: (s, upd_) => {
          const rc = s.querySelector('#rc');
          const paint = () => { rc.innerHTML = `<div class="rhead"><span>রেটিং</span><b>${num(total(d))}/১০</b></div>${ratingChoices(d)}`; rc.querySelectorAll('[data-k]').forEach(x => x.addEventListener('click', () => { d = { ...d, [x.dataset.k]: +x.dataset.v }; paint(); upd_(); })); };
          paint();
        },
        run: async reason => {
          const ok = await callRpc('change_rating', { p_student: st.id, p_day: today, p_shift: A.shift, p_slot: A.slot, p_behavior: d.behavior, p_homework: d.homework, p_performance: d.performance, p_reason: old ? reason : null });
          if (!ok) return false;
          b.savedR[st.id] = { behavior: d.behavior, homework: d.homework, performance: d.performance };
          toast('বদলে দেওয়া হয়েছে'); draw(); return true;
        },
      });
    }

    function banner() {
      const online = navigator.onLine, pending = outbox.mine().length;
      if (online && !pending && !A.error) return '';
      return `<div class="card ${online ? 'sun' : 'sun'}"><div>${!online ? `নেট নেই। সংরক্ষণ করলে ফোনে জমা থাকবে${pending ? ` (${bn(pending)}টি জমা আছে)` : ''}, নেট এলে নিজে থেকেই যাবে।`
        : pending ? `জমা থাকা ${bn(pending)}টি তথ্য পাঠানো হচ্ছে…` : ''}</div>${A.error ? `<div class="err">${esc(A.error)}</div>` : ''}</div>`;
    }
    function rowsHtml() {
      const b = bucket(); ensureLr(b);
      const frozen = !!PEND && PEND.key === A.key;
      const groups = T.periodGroups(routine, list || [], A.shift, A.slot);
      const group = groups.find(g => g.key === A.group) || (groups.length === 1 ? groups[0] : null);
      const inGroup = list.filter(s => !group?.levels || group.levels.includes(s.class_level));
      const inClass = inGroup.filter(s => A.cls == null || s.class_level === A.cls);
      const shown = Search.filter(inClass, A.q, stuFields);
      const marked = inClass.filter(s => statusOf(b, s.id) !== undefined).length, left = inClass.length - marked;
      const free = inClass.filter(s => !(s.id in b.saved));
      const canSave = !frozen && Object.keys(b.local).length > 0 && !(A.session === 'exam' && !A.examScope);
      let h = `<div class="card"><h3>${left ? `${bn(marked)} জন চিহ্নিত, ${bn(left)} জন বাকি` : `সবাই চিহ্নিত, ${bn(marked)} জন`}</h3><div style="margin-top:8px">${bar(inClass.length ? marked / inClass.length : 0)}</div></div>`;
      h += shown.map(st => {
        const p = statusOf(b, st.id), locked = st.id in b.saved && !(st.id in b.local);
        let x = `<div class="stack"><div class="att ${p === true ? 'p' : p === false ? 'a' : ''} ${locked ? 'lock' : ''}" data-row="${esc(st.id)}">${avatar(nameOf(st))}<div class="nm"><h3>${esc(nameOf(st))}</h3><div class="mute small">রোল ${esc(bn(st.roll || '—'))} · ক্লাস ${bn(st.class_level)}${locked ? ' · সংরক্ষিত' : ''}</div></div><span class="stt">${p === true ? 'উপস্থিত' : p === false ? 'অনুপস্থিত' : 'বাকি'}</span><span class="mark">${p === true ? '✓' : p === false ? '✕' : ''}</span></div>`;
        if (p === true && wantRating()) {
          if (locked && b.savedR !== null) x += b.savedR[st.id]
            ? `<div class="rating locked" data-rate="${esc(st.id)}"><div class="rhead"><span>আজকের রেটিং</span><b>${num(total(b.savedR[st.id]))}/১০</b></div><div class="mute small">${ratingText(b.savedR[st.id])}</div></div>`
            : `<div class="rating locked" data-rate="${esc(st.id)}"><div class="rhead"><span>রেটিং দেওয়া হয়নি</span><b>দিন</b></div></div>`;
          else if (!locked && b.lr[st.id]) x += `<div class="rating" data-id="${esc(st.id)}"><div class="rhead"><span>আজকের রেটিং</span><b>${num(total(b.lr[st.id]))}/১০${b.lr[st.id].touched ? '' : ' <span class="pill">ডিফল্ট ৮</span>'}</b></div>${ratingChoices(b.lr[st.id])}</div>`;
        }
        if (p === false) x += `<div class="absent">${contacts == null ? '<span class="mute small">অভিভাবকের নম্বর আনা হচ্ছে…</span>' : (contacts[st.id] || []).map(callRow).join('') || '<span class="mute small">অভিভাবকের নম্বর যোগ করা নেই</span>'}</div>`;
        return x + '</div>';
      }).join('') || empty('search', 'কাউকে পাওয়া যায়নি।');
      h += `<div class="row2"><button class="btn" id="allP" ${frozen || !free.some(s => !(s.id in b.local)) ? 'disabled' : ''}>সবাই উপস্থিত</button>
        ${free.some(s => !(s.id in b.local)) ? `<button class="btn coral" id="restA" ${frozen ? 'disabled' : ''}>বাকিদের অনুপস্থিত</button>` : ''}</div>
        <div class="mute small">${A.session === 'class' ? 'উপস্থিত শিক্ষার্থীর নিচে রেটিং থাকে, শুরুতে ডিফল্ট ৮। সংরক্ষণের পর কিছু বদলাতে কারণ লিখতে হবে।' : 'পরীক্ষার দিনে শুধু উপস্থিতি যায়। সংরক্ষণের পর কিছু বদলাতে কারণ লিখতে হবে।'}</div>
        <div class="savebar"><button class="btn" id="save" ${canSave ? '' : 'disabled'}>${frozen ? 'সংরক্ষণ হচ্ছে…' : 'সংরক্ষণ'}</button><div class="mute small">ভুল হলে ৫ সেকেন্ডের মধ্যে ফিরিয়ে নিন।</div></div>`;
      el._free = free;
      return h;
    }
    function bindRows() {
      const b = bucket(), frozen = !!PEND && PEND.key === A.key;
      const stOf = id => list.find(s => s.id === id);
      el.querySelectorAll('[data-row]').forEach(r => r.addEventListener('click', () => {
        if (frozen) return;
        const id = r.dataset.row;
        if (id in b.saved && !(id in b.local)) return changeStatus(stOf(id));
        cycle(id); drawRows();
      }));
      el.querySelectorAll('.rating[data-id] [data-k]').forEach(x => x.addEventListener('click', () => {
        if (frozen) return;
        const id = x.closest('.rating').dataset.id;
        b.lr[id] = { ...b.lr[id], [x.dataset.k]: +x.dataset.v, touched: true }; drawRows();
      }));
      el.querySelectorAll('[data-rate]').forEach(r => r.addEventListener('click', () => { if (!frozen) changeRating(stOf(r.dataset.rate)); }));
      const all = el.querySelector('#allP'); if (all) all.addEventListener('click', () => { el._free.forEach(s => { if (!(s.id in b.local)) b.local[s.id] = true; }); A.error = null; drawRows(); });
      const rest = el.querySelector('#restA'); if (rest) rest.addEventListener('click', () => { el._free.forEach(s => { if (!(s.id in b.local)) b.local[s.id] = false; }); A.error = null; drawRows(); });
      const sv = el.querySelector('#save'); if (sv) sv.addEventListener('click', save);
    }
    function drawRows() {
      const box = el.querySelector('#rows'); if (!box) return draw();
      const y = window.scrollY;
      box.innerHTML = rowsHtml();
      window.scrollTo(0, y);
      bindRows();
    }

    function draw() {
      let h = banner() + `<div class="card"><h3>আজ কী হচ্ছে?</h3><div class="seg" style="margin-top:8px">
          <button data-session="class" class="${A.session === 'class' ? 'on' : ''}"><b>নিয়মিত ক্লাস</b><span>উপস্থিতি + ক্লাস স্কোর</span></button>
          <button data-session="exam" class="${A.session === 'exam' ? 'on' : ''}"><b>পরীক্ষা</b><span>শুধু উপস্থিতি</span></button></div>
          ${A.session === 'exam' ? `<h4 style="margin-top:10px">আজ পরীক্ষা কখন?</h4><div class="seg" style="margin-top:6px">
            <button data-scope="all" class="${A.examScope === 'all' ? 'on' : ''}"><b>১ম, ২য়, ৩য় সব স্লটে</b><span>একবার উপস্থিতি</span></button>
            <button data-scope="slot" class="${A.examScope === 'slot' ? 'on' : ''}"><b>শুধু আমার স্লটে</b><span>নির্দিষ্ট সময়ে</span></button></div>
            ${A.marked ? `<div style="margin-top:8px">পরীক্ষা: ${esc(A.examTitle || 'নাম দেওয়া হয়নি')}</div>` : `<input id="examTitle" maxlength="60" placeholder="কোন পরীক্ষা (যেমন: মডেল টেস্ট · ইংরেজি ২য়)" value="${esc(A.examTitle)}" style="margin-top:8px">`}` : ''}
          ${A.marked ? '<div class="mute small">উপস্থিতি সংরক্ষণ শুরু হয়ে গেছে, তাই আজকের ধরন আর বদলানো যাবে না।</div>' : ''}</div>`;
      let showRows = false;
      if (A.session === 'exam' && !A.examScope) h += empty('note_edit', 'উপরে বেছে নিন: পরীক্ষা সব স্লটে, নাকি শুধু আপনার স্লটে।');
      else if (A.session) {
        h += T.shiftSeg(A.shift);
        const slots = T.slotsOf(routine, A.shift);
        if (A.slot !== 0) h += T.slotSeg(slots, A.slot);
        const groups = T.periodGroups(routine, list || [], A.shift, A.slot);
        const group = groups.find(g => g.key === A.group) || (groups.length === 1 ? groups[0] : null);
        if (groups.length > 1) h += `<div class="card"><h4>কোন ক্লাসের উপস্থিতি নিচ্ছেন?</h4><div class="stack" style="margin-top:8px">${groups.map(g => `<button class="pickrow ${g.key === group?.key ? 'on' : ''}" data-group="${g.key}"><b>${esc(g.title)}</b>${g.sub ? `<span class="mute small">${esc(g.sub)}</span>` : ''}</button>`).join('')}</div></div>`;
        if (list === null) h += skel(3);
        else if (loadFailed) h += `${empty('wifi_off', 'শিক্ষার্থীর তালিকা আনতে ইন্টারনেট লাগে। একবার তালিকা খোলার পর নেট গেলেও উপস্থিতি নেওয়া যাবে।')}<button class="btn" id="reload">আবার চেষ্টা করুন</button>`;
        else if (!list.length) h += empty('school', 'এই শিফটে কোনো শিক্ষার্থী নেই।');
        else if (groups.length > 1 && !group) h += empty('users', 'উপরে থেকে আপনার ক্লাসটি বেছে নিন।');
        else {
          const inGroup = list.filter(s => !group?.levels || group.levels.includes(s.class_level));
          const classes = [...new Set(inGroup.map(s => s.class_level))].sort((a, b) => a - b);
          if (!inGroup.length) h += empty('school', 'এই ক্লাসে কোনো শিক্ষার্থী নেই।');
          else {
            if (classes.length > 1) h += chipRow([['', 'সব ক্লাস'], ...classes.map(c => [c, 'ক্লাস ' + bn(c)])], A.cls ?? '');
            h += `<input id="aq" maxlength="40" placeholder="নাম, রোল বা আইডি দিয়ে খুঁজুন" value="${esc(A.q)}" autocomplete="off"><div id="rows" class="stack"></div>`;
            showRows = true;
          }
        }
      }
      const y = window.scrollY;
      el.innerHTML = h;
      window.scrollTo(0, y);
      if (showRows) { el.querySelector('#rows').innerHTML = rowsHtml(); bindRows(); }
      bind();
    }
    A.redraw = () => { if (el.isConnected) { if (document.activeElement?.id === 'aq') drawRows(); else draw(); } };
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
      const r = el.querySelector('#reload'); if (r) r.onclick = async () => { list = null; loadFailed = false; draw(); await load(); draw(); };
      const qi = el.querySelector('#aq'); if (qi) qi.addEventListener('input', () => { A.q = qi.value.slice(0, 40); drawRows(); });
    }
    if (A.session && !(A.session === 'exam' && !A.examScope)) await load();
    draw();
    let last = `${navigator.onLine}|${outbox.mine().length}|${contacts != null}`;
    const tick = setInterval(() => {
      if (cur().r !== 't.att') return clearInterval(tick);
      const now = `${navigator.onLine}|${outbox.mine().length}|${contacts != null}`;
      if (now !== last) { last = now; A.redraw(); }
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
  // Notice board; the admin can archive a notice (hidden from families, restorable) and delete it for good
  // from the archive (VisitorScreens.NoticesScreen, notices-archive.sql).
  const NB = { archive: false, confirm: null, msg: null };
  SCREENS.notices = { title: () => NB.archive ? 'নোটিশ আর্কাইভ' : 'সকল নোটিশ', sub: () => NB.archive ? 'সরিয়ে রাখা নোটিশ; চাইলে ফিরিয়ে আনুন' : '', render: async (el) => {
    const admin = isAdmin();
    if (!admin) NB.archive = false;
    const AUD = { all: 'সবাই', guardians: 'অভিভাবক', students: 'শিক্ষার্থী', teachers: 'শিক্ষক' };
    const COLS = 'select=id,title,body,audience,class_level,created_at';
    const ns = NB.archive ? await sel('notices', `${COLS}&archived_at=not.is.null&order=archived_at.desc&limit=100`)
      : await cached('notices', () => sel('notices', `${COLS}&archived_at=is.null&order=created_at.desc&limit=60`));
    const act = async (done, job) => {
      try { await job(); NB.msg = done; } catch { NB.msg = 'করা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।'; }
      NB.confirm = null; render();
    };
    el.innerHTML = (admin ? `<div class="chips"><button class="chip-btn ${NB.archive ? '' : 'on'}" data-nb="0">বোর্ড</button><button class="chip-btn ${NB.archive ? 'on' : ''}" data-nb="1">আর্কাইভ</button></div>` : '')
      + (NB.msg ? `<div class="mute">${esc(NB.msg)}</div>` : '')
      + (ns.map(n => `<div class="card"><div class="mute small">${fmtDateY(n.created_at)} · ${AUD[n.audience] || ''}${n.class_level ? ' · ক্লাস ' + bn(n.class_level) : ''}</div><h3>${esc(n.title)}</h3><div style="white-space:pre-wrap;margin-top:4px">${esc(n.body)}</div>
        ${!admin ? '' : NB.archive ? `<div class="chips" style="margin-top:8px"><button class="pill teal" data-restore="${n.id}">ফিরিয়ে আনুন</button><button class="pill${NB.confirm === n.id ? ' coral' : ''}" data-purge="${n.id}">${NB.confirm === n.id ? 'নিশ্চিত, চিরতরে মুছুন' : 'চিরতরে মুছুন'}</button></div>`
          : `<div class="chips" style="margin-top:8px"><button class="pill" data-arch="${n.id}">আর্কাইভে রাখুন</button></div>`}</div>`).join('')
        || empty('inbox', NB.archive ? 'আর্কাইভে কোনো নোটিশ নেই' : 'এখনো কোনো নোটিশ নেই।'));
    el.querySelectorAll('[data-nb]').forEach(b => b.onclick = () => { NB.archive = b.dataset.nb === '1'; NB.msg = null; NB.confirm = null; setTitle(SCREENS.notices.title()); setSub(SCREENS.notices.sub()); render(); });
    el.querySelectorAll('[data-arch]').forEach(b => b.onclick = () => act('নোটিশটি আর্কাইভে রাখা হয়েছে। অভিভাবকরা আর দেখবেন না; আর্কাইভ থেকে ফিরিয়ে আনা যাবে।', () => rpc('set_notice_archived', { p_id: b.dataset.arch, p_archived: true })));
    el.querySelectorAll('[data-restore]').forEach(b => b.onclick = () => act('নোটিশটি আবার বোর্ডে দেখা যাবে।', () => rpc('set_notice_archived', { p_id: b.dataset.restore, p_archived: false })));
    el.querySelectorAll('[data-purge]').forEach(b => b.onclick = () => {
      if (NB.confirm !== b.dataset.purge) { NB.confirm = b.dataset.purge; return render(); }
      act('নোটিশটি চিরতরে মুছে ফেলা হয়েছে।', () => rpc('delete_archived_notice', { p_id: b.dataset.purge }));
    });
  } };
  SCREENS.director = { title: 'পরিচালকের বার্তা', render: async (el) => {
    const ms = await cached('director', () => sel('director_messages', 'select=id,title,body,video_url,published_on&order=published_on.desc'));
    el.innerHTML = ms.map(m => `<div class="card"><div class="mute small">${fmtDateY(m.published_on)}</div><h3>${esc(m.title)}</h3><div style="white-space:pre-wrap;margin-top:4px">${esc(m.body)}</div>${safeUrl(m.video_url) ? `<a class="pill sun" style="margin-top:8px" href="${esc(safeUrl(m.video_url))}" target="_blank" rel="noopener">ভিডিও দেখুন</a>` : ''}</div>`).join('') || empty('mic', 'এখনো কোনো বার্তা নেই।');
  } };
  SCREENS.materials = { title: 'শিক্ষা উপকরণ', sub: c => 'ক্লাস ' + bn(c), render: async (el, cls) => {
    cls = +cls || 5;
    const ms = await cached('mat' + cls, () => sel('materials', `select=id,chapter,title,kind,url,storage_path,subject:subjects(name)&class_level=eq.${cls}&order=created_at.desc`));
    el.innerHTML = chipRow(CLASSES.map(c => [c, 'ক্লাস ' + bn(c)]), cls) +
      (ms.map(m => `<div class="card tap" data-url="${esc(safeUrl(m.url))}" style="display:flex;gap:12px;align-items:center">${chip(m.kind === 'pdf' ? 'document' : 'book', 40)}<div><h3>${esc(m.title)}</h3><div class="mute small">${esc(m.subject?.name || '')}${m.chapter ? ' · ' + esc(m.chapter) : ''}</div></div></div>`).join('') || empty('book', 'এই ক্লাসের জন্য এখনো কোনো উপকরণ নেই।'));
    el.querySelectorAll('[data-chip]').forEach(b => b.onclick = () => nav.replace('materials', b.dataset.chip));
    el.querySelectorAll('[data-url]').forEach(b => b.onclick = () => b.dataset.url ? window.open(b.dataset.url, '_blank', 'noopener') : toast('লিংক নেই'));
  } };
  SCREENS.soon = { title: p => p || 'শীঘ্রই', render: async (el) => {
    el.innerHTML = `<div class="card">${empty('ai_spark', 'এই অংশটি শীঘ্রই ওয়েবে আসছে।' + (isAndroid ? ' ততদিন অ্যান্ড্রয়েড অ্যাপে ব্যবহার করুন।' : ''))}</div>${apkBanner()}`;
  } };
})();

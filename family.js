'use strict';
// Guardian & student screens — mirror GuardianScreens.kt / StudentScreens.kt (same tiles, order and copy).
(function () {
  const STU = 'id,class_level,roll,batch:batches(shift),profile:profiles!students_profile_id_fkey(full_name),rewards:student_rewards(stars,streak_days,avatar)';
  let kids = null;
  const loadKids = async () => kids = await cached('kids', async () => {
    if (S.me.role === 'student') return sel('students', `select=${STU}&profile_id=eq.${S.uid}&limit=1`);
    const l = await sel('guardian_students', `select=student_id&guardian_id=eq.${S.uid}`);
    return l.length ? sel('students', `select=${STU}&id=${inList(l.map(x => x.student_id))}`) : [];
  });
  const kidOf = async id => { await (kids || loadKids()); return kids.find(k => k.id === id) || kids[0]; };
  const nm = k => k?.profile?.full_name || 'শিক্ষার্থী';
  const rw = k => (Array.isArray(k?.rewards) ? k.rewards[0] : k?.rewards) || {};
  const shiftOf = k => SHIFTS.find(s => s.id === k?.batch?.shift) || SHIFTS[1];
  let selIdx = store.get('kid') || 0;
  const logoutPill = (cls = 'sun') => `<button class="pill ${cls}" data-logout>লগআউট</button>`;
  const SOON = 'এই অংশটি শীঘ্রই ওয়েবে আসছে।';

  // ---------- guardian home ----------
  // NotesScreens.NoteCard: icon chip, title with an unread dot, "আজ" or the date, body.
  const noteCard = (n, go) => `<div class="card${go ? ' tap" data-go="' + go : ''}" style="display:flex;gap:12px;align-items:flex-start">${chip(/অনুপস্থিত/.test(n.title) ? 'alert' : 'attendance', 40)}
    <div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:8px"><h3 style="flex:1">${esc(n.title)}</h3>${n.read_at ? '' : '<span style="width:9px;height:9px;border-radius:50%;background:var(--coral);flex:none"></span>'}</div>
    <div class="mute small">${n.day === dhakaToday() ? 'আজ' : fmtDateY(n.day)}</div><div style="margin-top:4px">${esc(bn(n.body))}</div></div></div>`;
  // "আজ" card for the selected child (TodayCard in GuardianScreens.kt): shift status + one line per marked slot.
  const SLOT_BN = n => ({ 1: '১ম', 2: '২য়', 3: '৩য়' })[n] || bn(n);
  const todayShell = c => `<div class="card tap today-card" data-go="att:${esc(c.id)}"><h3>${esc(nm(c))}</h3>
    <div class="mute small">ক্লাস ${bn(c.class_level)} · রোল ${bn(c.roll)}</div><div class="today-body"><div class="mute" style="margin-top:10px">একটু অপেক্ষা…</div></div></div>`;
  async function fillToday(el, c) {
    const box = el.querySelector('.today-body');
    if (!box) return;
    const q = `day=eq.${dhakaToday()}&shift=eq.${shiftOf(c).id}&student_id=eq.${c.id}`;
    const [pa, cr] = await Promise.allSettled([sel('period_attendance', `select=slot,present&${q}`), sel('class_ratings', `select=slot,total&${q}`)]);
    if (!el.isConnected) return;
    if (pa.status === 'rejected' && cr.status === 'rejected') { box.innerHTML = '<div class="mute" style="margin-top:10px">আজকের খবর আনা যায়নি। নিচে টেনে রিফ্রেশ করুন।</div>'; return; }
    const marks = {}, scores = {};
    if (pa.status === 'fulfilled') (pa.value || []).forEach(r => { marks[+r.slot] = !!r.present; });
    if (cr.status === 'fulfilled') (cr.value || []).forEach(r => { scores[+r.slot] = +r.total; });
    const vals = Object.values(marks);
    let h = '<div style="margin-top:10px">';
    if (vals.some(v => v)) h += '<span class="pill" style="background:#137442;color:#fff">● আজ উপস্থিত</span>';
    else if (vals.some(v => !v)) h += '<span class="pill" style="background:var(--coral-soft);color:#A8381A">● আজ উপস্থিত নয়</span>';
    else h += '<span class="pill" style="background:var(--line);color:var(--ink-soft)">আজ এখনো উপস্থিতি নেওয়া হয়নি</span>';
    h += '</div>';
    // Slot 0 = the whole-shift exam, 1..3 = class periods. Only slots with a mark or a score get a line.
    for (let slot = 0; slot <= 3; slot++) {
      const m = marks[slot], s = scores[slot];
      if (m === undefined && s === undefined) continue;
      const parts = [slot === 0 ? 'পরীক্ষা' : SLOT_BN(slot) + ' ক্লাস'];
      if (m !== undefined) parts.push(m ? 'উপস্থিত' : 'অনুপস্থিত');
      if (s !== undefined) parts.push('স্কোর ' + bn(String(s)) + '/১০');
      h += `<div class="mute" style="margin-top:6px">${esc(parts.join(' · '))}</div>`;
    }
    box.innerHTML = h;
  }
  SCREENS['g.home'] = { home: true, title: () => 'স্বাগতম, ' + S.me.full_name, sub: () => 'অভিভাবক · ' + todayBnLong(), trail: () => avatarBtn() + logoutPill('sun'), render: async (el) => {
    const nh = noticeHighlight('guardians'); // notices first: guardians must not miss holidays, exam dates and fee news
    const hcP = loadHomeConfig('guardian');  // server control (app.js): tiles, names, banner
    await loadKids();
    HOME_CFG = await hcP;
    if (!kids.length) { el.innerHTML = homeBanner(HOME_CFG) + (await nh) + empty('child', 'কোনো শিক্ষার্থী যুক্ত হয়নি। কোচিং অফিসে যোগাযোগ করুন।'); return; }
    selIdx = Math.min(selIdx, kids.length - 1);
    const c = kids[selIdx];
    const [att, fees, notes] = await Promise.all([
      cached('att' + c.id, () => sel('attendance', `select=date,check_in,check_out&student_id=eq.${c.id}&order=date.desc&limit=30`)).catch(() => []),
      cached('due' + c.id, () => sel('fees', `select=month,amount,paid_amount,status&student_id=eq.${c.id}&status=neq.paid&order=month`)).catch(() => []),
      cached('notes', () => sel('guardian_notes', 'select=id,student_id,day,title,body,read_at&order=updated_at.desc&limit=40')).catch(() => []),
    ]);
    const today = att.find(a => a.date === dhakaToday() && a.check_in);
    const due = fees.reduce((s, f) => s + (+f.amount - +f.paid_amount), 0);
    const note = notes.find(n => n.student_id === c.id);
    el.innerHTML = `${homeBanner(HOME_CFG)}${todayShell(c)}${await nh}
      ${kids.length > 1 ? chipRow(kids.map((k, i) => [i, nm(k)]), selIdx, 'data-kid') : ''}
      ${note ? `<div class="stack"><div style="color:var(--teal-dark);font-weight:600;font-size:14px">সর্বশেষ বার্তা</div>${noteCard(note, 'notes')}</div>` : ''}
      <div class="card"><h2>আজকের তথ্য</h2>${today ? `<div class="ok" style="font-weight:700;font-size:16px">${esc(nm(c))} আজ ${fmtTime(today.check_in)}-এ উপস্থিত হয়েছে।</div>` : '<div class="mute">আজকের উপস্থিতির খবর এখনো আসেনি।</div>'}</div>
      ${due > 0 ? `<div class="card sun tap" data-go="fees:${c.id}"><h3>বকেয়া ফি: ${taka(due)}</h3><div class="mute">${fees.filter(f => +f.amount > +f.paid_amount).map(f => MONTHS[+f.month.slice(5, 7) - 1] + ' ' + bn(f.month.slice(0, 4))).join(', ')}</div><div class="small" style="color:var(--teal-dark);font-weight:600">বিস্তারিত দেখুন ›</div></div>` : ''}
      <div class="card"><div class="stats"><div><b>${bn(rw(c).stars || 0)}</b><span class="mute small">স্টার</span></div><div><b>${bn(rw(c).streak_days || 0)} দিন</b><span class="mute small">টানা উপস্থিতি</span></div></div></div>
      ${grid2([fun('document', 'রিপোর্ট কার্ড', 'myreports:' + c.id, { tint: 'sun', sub: 'সাপ্তাহিক ফল' }), fun('calendar', 'উপস্থিতি', 'att:' + c.id, { tint: 'sky', sub: 'মাসের হিসাব' })])}
      ${dashSection('guardian', 'study', 'chart', 'পড়ালেখা ও অগ্রগতি', [['chart', 'পরীক্ষার ফল', 'results:' + c.id], ['star', 'রেটিং ও প্রশংসা', 'progress:' + c.id],
        ['book', 'শিক্ষা উপকরণ', 'materials:' + c.class_level], ['headphones', 'ভয়েস মেসেজ', 'voicebox:' + c.id], ['target', 'লক্ষ্য', 'g.goals:' + c.id], ['trophy', 'সার্টিফিকেট', 'certs:' + c.id]], true)}
      ${dashSection('guardian', 'talk', 'chat', 'যোগাযোগ ও নোটিশ', [['chat', 'শিক্ষকের সাথে যোগাযোগ', 'chat:' + c.id], ['handshake', 'শিক্ষকের সাথে মিটিং', 'meetings'],
        ['bell', 'সব নোটিশ', 'notices:guardians'], ['notebook', 'দৈনিক বার্তা', 'notes'], ['mic', 'পরিচালকের বার্তা', 'director']], true)}
      ${dashSection('guardian', 'account', 'card', 'ফি ও অ্যাকাউন্ট', [['card', 'ফি ও পরিশোধ', 'fees:' + c.id], ['lock', 'পিন বদলান', 'pin'], ['lock', 'আমার তথ্য ও গোপনীয়তা', 'mydata']], false)}
      ${apkBanner()}`;
    bindDash(el);
    fillToday(el, c);
    el.querySelectorAll('[data-kid]').forEach(b => b.onclick = () => { selIdx = +b.dataset.kid; store.set('kid', selIdx); render(); });
    el.querySelectorAll('[data-logout]').forEach(b => b.onclick = confirmLogout);
    setTimeout(apkPopup, 1500);
  } };

  // ---------- student home ----------
  const MOOD_E = ['😢', '😟', '😐', '🙂', '😄'], MOOD_BN = ['খুব খারাপ', 'মন খারাপ', 'মোটামুটি', 'ভালো', 'দারুণ'];
  const dayDiff = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5);
  const addDay = (d, n) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return x.toLocaleDateString('en-CA'); };
  // Content.revisionPlan: chapters spread over the days left, unfinished-in-class first, last day = full revision.
  const revisionPlan = (examDate, chapters, today) => {
    const days = dayDiff(today, examDate);
    if (days <= 0 || !chapters.length) return [];
    const ordered = chapters.slice().sort((a, b) => (a.status === 'done') - (b.status === 'done') || a.number - b.number);
    if (days === 1) return [{ date: today, chapters: ordered, full: true }];
    const studyDays = Math.max(1, days - 1), per = Math.max(1, Math.ceil(ordered.length / studyDays)), chunks = [];
    for (let i = 0; i < ordered.length; i += per) chunks.push(ordered.slice(i, i + per));
    const plan = [];
    for (let i = 0; i < studyDays; i++) plan.push({ date: addDay(today, i), chapters: chunks[i] || chunks[i % chunks.length], full: false });
    plan.push({ date: addDay(today, days - 1), chapters: ordered, full: true });
    return plan;
  };
  const upcomingExams = cls => cached('upx' + cls, () => sel('exams', `select=id,title,exam_date,class_level,chapter_ids,subject:subjects(name)&exam_date=gte.${dhakaToday()}&class_level=eq.${cls}&order=exam_date`));
  const chaptersOf = (cls, subject) => cached(`ch${cls}.${subject || ''}`, () => sel('chapters', `select=id,class_level,subject,number,title,pages,status,done_on&class_level=eq.${cls}${subject ? '&subject=eq.' + encodeURIComponent(subject) : ''}&order=subject,number`));
  const moodDone = m => `<div style="display:flex;align-items:center;gap:10px"><span style="font-size:30px">${MOOD_E[m - 1]}</span><span>${m <= 2 ? 'মন খারাপ লাগছে? শিক্ষকরা তোমার পাশে আছেন।' : 'জানানোর জন্য ধন্যবাদ!'}</span></div>`;

  // ---------- student home (StudentScreens.StudentHomeScreen) ----------
  SCREENS['s.home'] = { home: true, title: () => 'স্বাগতম, ' + S.me.full_name, sub: 'আজকের পড়া এক নজরে', hdr: 'var(--plum400)', trail: () => avatarBtn() + logoutPill('white'),
    extra: () => '<span class="hx-mascot" id="hxm"><img src="logo.svg" alt=""></span><span class="pill white" id="hxs">স্টার …</span><span class="pill white" id="hxd">টানা উপস্থিতি … দিন</span>',
    render: async (el) => {
    const nh = noticeHighlight('students'); // notices first, so nobody misses holidays or exam dates
    const hcP = loadHomeConfig('student');  // server control (app.js): tiles, names, banner
    await loadKids();
    HOME_CFG = await hcP;
    const st = kids[0];
    if (!st) { el.innerHTML = homeBanner(HOME_CFG) + (await nh) +'<div class="card sun mute">একটু অপেক্ষা করো…</div>'; return; }
    const r = rw(st), av = r.avatar && window.SHOP_EMOJI ? SHOP_EMOJI(r.avatar) : null;
    const hs = $('#hxs'), hd = $('#hxd'), hm = $('#hxm');
    if (hs) hs.textContent = 'স্টার ' + bn(r.stars || 0);
    if (hd) hd.textContent = `টানা উপস্থিতি ${bn(r.streak_days || 0)} দিন`;
    if (hm && av) hm.textContent = av;
    const sh = shiftOf(st);
    const [hw, done, mood, exams] = await Promise.all([
      cached('hw' + st.class_level, () => sel('homework', `select=id,title,due_date,subject:subjects(name)&class_level=eq.${st.class_level}&order=due_date.asc`)).catch(() => []),
      sel('homework_done', `select=homework_id&student_id=eq.${st.id}`).then(r => new Set(r.map(x => x.homework_id))).catch(() => new Set()),
      sel('mood_checkins', `select=mood&student_id=eq.${st.id}&day=eq.${dhakaToday()}`).then(r => r[0]?.mood ?? null).catch(() => null),
      upcomingExams(st.class_level).catch(() => []),
    ]);
    // Exam countdown (ContentScreens.ExamCountdownCard): next exam, days left, today's revision.
    let countdown = '';
    const next = exams[0];
    if (next) {
      const left = dayDiff(dhakaToday(), next.exam_date);
      const chs = (await chaptersOf(st.class_level).catch(() => [])).filter(c => (next.chapter_ids || []).includes(c.id));
      const t = revisionPlan(next.exam_date, chs, dhakaToday())[0];
      countdown = `<div class="card tap ${left <= 3 ? 'warn' : 'grape'}" data-go="s.revision:${next.id}" style="display:flex;align-items:center;gap:10px">
        <div style="width:72px;text-align:center;flex:none"><div style="font-size:34px;font-weight:700;line-height:40px;color:${left <= 3 ? 'var(--coral)' : 'var(--plum400)'}">${left === 0 ? 'আজ' : bn(left)}</div>${left > 0 ? '<div class="mute small">দিন বাকি</div>' : ''}</div>
        <div style="flex:1"><h3>${esc(next.subject?.name || '')} · ${esc(next.title)}</h3><div>${t ? (t.full ? 'আজ: পুরো সিলেবাস একবার রিভিশন দাও' : 'আজ পড়ো: ' + t.chapters.map(c => esc(c.title)).join(', ')) : 'রিভিশন প্ল্যান দেখো'}</div></div></div>`;
    }
    const big = document.body.classList.contains('big');
    const fin = hw.filter(h => done.has(h.id)).length;
    const W = window.WORDS_EN ? WORDS_EN(st.class_level) : null;
    el.innerHTML = `${homeBanner(HOME_CFG)}${await nh}
      <div class="card sun" style="display:flex;gap:12px;align-items:center">${chip(sh.icon, 48)}<div><div class="mute small">আজকের ক্লাস</div><div class="h2">${sh.bn} ব্যাচ</div><div class="mute">${sh.time}</div></div></div>
      ${countdown}
      <div class="card sky" id="mood">${mood == null ? `<h3>আজ তোমার মন কেমন?</h3><div class="moods">${MOOD_E.map((e, i) => `<button data-mood="${i + 1}"><span>${e}</span><small>${MOOD_BN[i]}</small></button>`).join('')}</div>` : moodDone(mood)}</div>
      ${section('আজকের কাজ')}
      ${!hw.length ? empty('inbox', 'বাড়ির কাজ নেই। আজ ছুটি!') : `<div class="card ${fin === hw.length ? 'teal' : ''}"><h3>${fin === hw.length ? 'সব কাজ শেষ!' : `${bn(fin)} / ${bn(hw.length)} কাজ শেষ`}</h3><div style="margin-top:8px">${bar(fin / hw.length)}</div></div>
        ${hw.map(h => `<div class="card"><div style="display:flex;gap:12px;align-items:center"><button class="mark-btn ${done.has(h.id) ? 'on' : ''}" data-hw="${h.id}" aria-label="শেষ">${done.has(h.id) ? '✓' : ''}</button>
          <div style="flex:1">${pill(h.subject?.name || 'বিষয়', 'sky')}<h3 style="margin-top:4px;${done.has(h.id) ? 'color:var(--ink-soft)' : ''}">${esc(h.title)}</h3><div class="mute small">জমা দেওয়ার শেষ দিন: ${h.due_date ? fmtDateY(h.due_date) : ''}</div></div></div>
          <button class="pill warn" style="margin-top:8px;border:0;cursor:pointer" data-confused="${esc((h.subject?.name || '') + ': ' + h.title)}">বুঝিনি</button></div>`).join('')}`}
      ${W ? `<div class="card sky tap" data-go="s.spelling"><div class="mute small">আজকের ইংরেজি শব্দ</div><div style="display:flex;align-items:baseline;gap:10px"><span style="font-size:24px;font-weight:600">${esc(W[0])}</span><b style="color:var(--teal)">${esc(W[1])}</b></div><div class="mute">${esc(W[2])}</div></div>` : ''}
      ${dashSection('student', 'study', 'book', 'পড়া ও ফলাফল', [['document', 'রিপোর্ট কার্ড', 'myreports:' + st.id], ['star', 'আমার রেটিং ও কার্ড', 'progress:' + st.id], ['trophy', 'কুইজ ও লিডারবোর্ড', 's.quiz'],
        ['book', 'সিলেবাস ও বইয়ের পৃষ্ঠা', 'syllabus:' + st.class_level], ['book', 'শিক্ষা উপকরণ', 'materials:' + st.class_level], ['ai_spark', 'AI পড়ার সহায়ক', 's.tutor'],
        ['question', 'প্রশ্ন বক্স', 's.doubts'], ['notebook', 'ভুলের খাতা', 's.mistakes'], ['flashcards', 'ফ্ল্যাশকার্ড', 'flash:' + st.class_level]], true)}
      ${dashSection('student', 'play', 'gamepad', 'খেলা ও অভ্যাস', [['timer', 'ফোকাস টাইমার', 'focus'], ['swords', 'কুইজ ডুয়েল', 's.duel'], ['target', 'সাপ্তাহিক চ্যালেঞ্জ', 's.challenges'],
        ['letters', 'শব্দ ও বানান', 's.spelling'], ['gamepad', 'শিক্ষামূলক খেলা', 's.games'], ['puzzle', 'দৈনিক ধাঁধা', 's.puzzle'], ['shop_bag', 'পয়েন্টের দোকান', 's.shop']], true)}
      ${dashSection('student', 'me', 'target', 'আমার জিনিস', [['target', 'আমার লক্ষ্য', 's.goals'], ['trophy', 'সার্টিফিকেট', 'certs'], ['mic', 'মুখস্থ পড়া ও ভয়েস', 'voicebox'],
        ['bell', 'সব নোটিশ', 'notices:students'], ['search', big ? 'বড় লেখা: চালু' : 'বড় লেখা: বন্ধ', null], ['lock', 'পিন বদলাও', 'pin']], false)}
      ${apkBanner()}`;
    bindDash(el);
    // The big-text tile has no route: it toggles in place (Appearance.setBigText).
    [...el.querySelectorAll('.compact')].filter(b => /বড় লেখা/.test(b.textContent)).forEach(b => b.onclick = () => { const on = !document.body.classList.contains('big'); document.body.classList.toggle('big', on); store.set('big', on); render(); });
    el.querySelectorAll('[data-mood]').forEach(b => b.onclick = async () => {
      const m = +b.dataset.mood;
      try { await upsert('mood_checkins', { coaching_id: S.me.coaching_id, student_id: st.id, day: dhakaToday(), mood: m, note: null }, 'student_id,day'); } catch { return toast('সংরক্ষণ হয়নি'); }
      const box = el.querySelector('#mood');
      box.innerHTML = moodDone(m) + (m <= 2 ? '<input id="mnote" maxlength="200" placeholder="চাইলে লিখো কী হয়েছে (শুধু শিক্ষক দেখবেন)" style="margin-top:8px"><button class="btn" id="msend" style="margin-top:8px;background:var(--plum400)" disabled>পাঠাও</button>' : '');
      const n = box.querySelector('#mnote'), sb = box.querySelector('#msend');
      if (n) {
        n.oninput = () => { sb.disabled = !n.value.trim(); };
        sb.onclick = () => { upsert('mood_checkins', { coaching_id: S.me.coaching_id, student_id: st.id, day: dhakaToday(), mood: m, note: n.value.trim() }, 'student_id,day').catch(() => {}); n.remove(); sb.remove(); };
      }
    });
    el.querySelectorAll('[data-confused]').forEach(b => b.onclick = () => {
      if (b.dataset.sent) return;
      b.dataset.sent = 1; b.textContent = 'শিক্ষককে জানানো হয়েছে ✓'; b.className = 'pill teal';
      ins('confusions', { coaching_id: S.me.coaching_id, student_id: st.id, topic: b.dataset.confused.slice(0, 200) }, 'select=id').catch(() => {});
    });
    el.querySelectorAll('[data-hw]').forEach(b => b.onclick = async () => {
      const id = b.dataset.hw, now = !done.has(id);
      try {
        if (now) await upsert('homework_done', { coaching_id: S.me.coaching_id, student_id: st.id, homework_id: id }, 'student_id,homework_id');
        else await del('homework_done', `student_id=eq.${st.id}&homework_id=eq.${id}`);
        render();
      } catch { toast('সংরক্ষণ হয়নি। আবার চাপো।'); }
    });
    setTimeout(apkPopup, 1500);
  } };

  // ---------- revision plan (ContentScreens.RevisionPlanScreen); ticks stay on this phone ----------
  SCREENS['s.revision'] = { title: 'রিভিশন প্ল্যান', hdr: 'var(--plum400)', render: async (el, examId) => {
    await loadKids();
    const st = kids[0];
    const ex = st && (await upcomingExams(st.class_level).catch(() => [])).find(e => e.id === examId);
    if (!ex) { el.innerHTML = empty('book', 'এই পরীক্ষার সিলেবাস এখনো দেওয়া হয়নি।'); return; }
    const subject = ex.subject?.name || '';
    setSub(`${subject} · ${ex.title}`);
    const today = dhakaToday(), left = dayDiff(today, ex.exam_date);
    const all = await chaptersOf(st.class_level, subject).catch(() => []);
    const syl = all.filter(c => (ex.chapter_ids || []).includes(c.id));
    const plan = revisionPlan(ex.exam_date, syl.length ? syl : all, today);
    const key = 'rev.' + ex.id, doneDays = new Set(store.get(key) || []);
    const draw = () => {
      el.innerHTML = `<div class="card sun"><h3>${left === 0 ? 'পরীক্ষা আজ! শুভকামনা' : `পরীক্ষা ${fmtDateY(ex.exam_date)} · আর ${bn(left)} দিন`}</h3><div class="mute">পড়া শেষ হলে দিনটিতে টিক দাও। অধ্যায়ের পাশে বইয়ের পৃষ্ঠা লেখা আছে।</div></div>`
        + (plan.length ? plan.map(d => {
          const dn = doneDays.has(d.date), isT = d.date === today;
          return `<div class="card ${dn ? 'teal' : isT ? 'grape' : ''}" style="display:flex;align-items:center;gap:8px"><div style="flex:1"><div class="small" style="font-weight:600;color:${isT ? 'var(--plum400)' : 'var(--ink-soft)'}">${isT ? 'আজ · ' : ''}${fmtDateY(d.date)}</div>
            ${d.full ? '<h3>পুরো সিলেবাস রিভিশন + আগের ভুলগুলো দেখো</h3>' : d.chapters.map(c => `<h3>${bn(c.number)}. ${esc(c.title)}${c.pages ? ' · পৃষ্ঠা ' + esc(bn(c.pages)) : ''}${c.status !== 'done' ? ' (ক্লাসে এখনো শেষ হয়নি)' : ''}</h3>`).join('')}</div>
            <input type="checkbox" data-day="${d.date}" ${dn ? 'checked' : ''} style="width:22px;height:22px;accent-color:var(--plum500)"></div>`;
        }).join('') : empty('book', 'এই পরীক্ষার সিলেবাস এখনো দেওয়া হয়নি।'));
      el.querySelectorAll('[data-day]').forEach(c => c.onchange = () => { c.checked ? doneDays.add(c.dataset.day) : doneDays.delete(c.dataset.day); store.set(key, [...doneDays]); draw(); });
    };
    draw();
  } };

  // ---------- guardian: the child's goals (read-only; the student sets them) ----------
  SCREENS['g.goals'] = { title: 'লক্ষ্য', render: async (el, id) => {
    const k = await kidOf(id); setSub(nm(k));
    const goals = await sel('student_goals', `select=id,subject,target_percent,achieved_at&student_id=eq.${k.id}&order=created_at`);
    el.innerHTML = goals.map(g => `<div class="card" style="display:flex;justify-content:space-between;align-items:center"><h3>${esc(g.subject)}</h3>${g.achieved_at ? pill('অর্জিত!', 'good') : pill('লক্ষ্য ' + bn(g.target_percent) + '%', 'teal')}</div>`).join('') || empty('target', 'এখনো কোনো লক্ষ্য ঠিক করা হয়নি।');
  } };

  // ---------- attendance history ----------
  SCREENS.att = { title: 'উপস্থিতি', sub: '', render: async (el, id) => {
    const k = await kidOf(id); setSub(nm(k));
    const att = await cached('att60' + k.id, () => sel('attendance', `select=date,check_in,check_out,source&student_id=eq.${k.id}&order=date.desc&limit=60`));
    const by = Object.fromEntries(att.map(a => [a.date, a]));
    const td = dhakaToday(); const y = +td.slice(0, 4), m = +td.slice(5, 7) - 1;
    const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
    let cells = ['র', 'সো', 'ম', 'বু', 'বৃ', 'শু', 'শ'].map(d => `<div class="mute small">${d}</div>`).join('') + '<div></div>'.repeat(first);
    let pres = 0, abs = 0;
    for (let d = 1; d <= days; d++) {
      const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const a = by[ds]; if (a?.check_in) pres++; else if (a) abs++;
      cells += `<div class="${a?.check_in ? 'p' : a ? 'a' : 'h'}">${bn(d)}</div>`;
    }
    el.innerHTML = `<div class="card"><div class="stats"><div><b class="ok">${bn(pres)}</b><span class="mute small">উপস্থিত</span></div><div><b class="bad">${bn(abs)}</b><span class="mute small">অনুপস্থিত</span></div></div></div>
      <div class="card"><h2>${MONTHS[m]} ${bn(y)}</h2><div class="cal">${cells}</div></div>
      ${section('সাম্প্রতিক দিন')}
      <div class="card">${att.slice(0, 20).map(a => `<div class="row"><span>${fmtDate(a.date)} · ${DAYS[new Date(a.date + 'T00:00:00').getDay()]}</span>${a.check_in ? `<span class="pill good">উপস্থিত ${fmtTime(a.check_in)}${a.source === 'cctv' ? ' · CCTV' : ''}</span>` : '<span class="pill bad">অনুপস্থিত</span>'}</div>`).join('') || '<div class="mute">এখনো কোনো তথ্য নেই</div>'}</div>`;
  } };

  // ---------- results ----------
  SCREENS.results = { title: 'ফলাফল', render: async (el, id) => {
    const k = await kidOf(id); setSub(nm(k));
    const ms = (await cached('marks' + k.id, () => sel('marks', `select=obtained,exam:exams(id,title,exam_date,full_marks,subject:subjects(name))&student_id=eq.${k.id}`))).filter(m => m.exam && m.obtained != null);
    ms.sort((a, b) => (b.exam.exam_date || '').localeCompare(a.exam.exam_date || ''));
    if (!ms.length) { el.innerHTML = empty('chart', 'এখনো কোনো ফলাফল প্রকাশিত হয়নি।'); return; }
    const avg = Math.round(ms.reduce((s, m) => s + m.obtained / m.exam.full_marks, 0) / ms.length * 100);
    el.innerHTML = `<div class="card teal"><div class="mute small">গড় নম্বর</div><div class="big">${bn(avg)}%</div>${bar(avg / 100, 'var(--teal)')}</div>
      ${ms.map(m => { const p = m.obtained / m.exam.full_marks; return `<div class="card"><div class="row" style="border:0;padding:0"><div>${pill(m.exam.subject?.name || '', 'teal')}<h3 style="margin-top:4px">${esc(m.exam.title)}</h3><div class="mute small">${fmtDate(m.exam.exam_date)}</div></div><div class="center"><b style="font-size:20px">${num(m.obtained)}/${num(m.exam.full_marks)}</b></div></div><div style="margin-top:8px">${bar(p, p >= .8 ? 'var(--good)' : p >= .5 ? '#E39A12' : 'var(--bad)')}</div></div>`; }).join('')}`;
  } };

  // ---------- fees ----------
  SCREENS.fees = { title: 'ফি', render: async (el, id) => {
    const k = await kidOf(id); setSub(nm(k));
    const fs = await cached('fees' + k.id, () => sel('fees', `select=month,amount,paid_amount,status,method,paid_at&student_id=eq.${k.id}&order=month.desc`));
    const due = fs.filter(f => f.status !== 'paid').reduce((s, f) => s + (+f.amount - +f.paid_amount), 0);
    const M = { cash: 'নগদ', bkash: 'bKash', nagad: 'Nagad' };
    el.innerHTML = `<div class="card ${due > 0 ? 'coral' : 'good'}"><div class="mute small">মোট বকেয়া</div><div class="big ${due > 0 ? 'bad' : 'ok'}">${taka(due)}</div><div class="mute">${due > 0 ? 'ফি কোচিং অফিসে নগদ, bKash বা Nagad-এ জমা দিন।' : 'কোনো বকেয়া নেই। ধন্যবাদ!'}</div></div>
      ${fs.map(f => { const d = new Date(f.month + 'T00:00:00'); return `<div class="card"><div class="row" style="border:0;padding:0"><div><h3>${MONTHS[d.getMonth()]} ${bn(d.getFullYear())}</h3><div class="mute small">${taka(f.amount)}${f.status === 'paid' && f.method ? ' · ' + M[f.method] : ''}</div></div>${f.status === 'paid' ? pill('পরিশোধিত', 'good') : f.status === 'partial' ? pill('বাকি ' + taka(+f.amount - +f.paid_amount), 'bad') : pill('বাকি', 'bad')}</div></div>`; }).join('') || empty('card', 'এখনো কোনো ফি তৈরি হয়নি।')}`;
  } };

  // ---------- notices ----------
  // Notice board (NoticesScreen): groups আজ / এই সপ্তাহ / আগের নোটিশ; the card is in app.js (noticeCard).
  SCREENS.notices = { title: 'নোটিশ বোর্ড', render: async (el, aud) => {
    const f = aud ? `&audience=in.(all,${aud})` : '';
    const ns = await cached('notices' + (aud || ''), () => sel('notices', `select=id,title,body,audience,created_at,created_by&archived_at=is.null&order=created_at.desc&limit=50${f}`));
    el.innerHTML = ns.length ? noticeGroups(ns).map(([label, g]) => `<div class="nb-group">${esc(label)}</div>${g.map(n => noticeCard(n)).join('')}`).join('') : empty('bell', 'কোনো নোটিশ নেই। আজ সবাই শান্ত।');
    bindNoticeCards(el);
  } };

  // ---------- materials ----------
  SCREENS.materials = { title: 'শিক্ষা উপকরণ', sub: c => 'ক্লাস ' + bn(c), render: async (el, cls) => {
    const ms = await cached('mat' + cls, () => sel('materials', `select=id,chapter,title,kind,url,storage_path,subject:subjects(name)&class_level=eq.${cls}&order=created_at.desc`));
    const K = { pdf: ['document', 'PDF'], note: ['note_edit', 'নোট'], video: ['book', 'ভিডিও'], link: ['document', 'লিংক'] };
    el.innerHTML = ms.map(m => `<div class="card tap" data-mat="${m.id}" style="display:flex;gap:12px;align-items:center">${chip(K[m.kind]?.[0] || 'book', 40)}<div style="flex:1"><h3>${esc(m.title)}</h3><div class="mute small">${esc(m.subject?.name || '')}${m.chapter ? ' · ' + esc(m.chapter) : ''} · ${K[m.kind]?.[1] || ''}</div></div></div>`).join('') || empty('book', 'এই ক্লাসের জন্য এখনো কোনো উপকরণ নেই।');
    el.querySelectorAll('[data-mat]').forEach(b => b.onclick = async () => {
      const m = ms.find(x => x.id === b.dataset.mat);
      try { const u = safeUrl(m.url) || (m.storage_path ? await signedUrl('materials', m.storage_path) : null); if (u) window.open(u, '_blank', 'noopener'); else toast('ফাইল পাওয়া যায়নি'); }
      catch { toast('খোলা যায়নি'); }
    });
  } };

  // ---------- notes ----------
  SCREENS.notes = { title: 'বার্তা', sub: 'প্রতিদিনের উপস্থিতি ও ক্লাস স্কোর', render: async (el) => {
    await loadKids();
    const ns = await cached('notes', () => sel('guardian_notes', 'select=id,student_id,day,title,body,read_at&order=updated_at.desc&limit=60'));
    const unread = ns.filter(n => !n.read_at).map(n => n.id);
    if (unread.length && !offlineFlag) rpc('mark_notes_read', { p_ids: unread }).catch(() => {});
    el.innerHTML = ns.map(n => noteCard(n)).join('') || empty('bell', 'কোনো বার্তা নেই। শিক্ষক উপস্থিতি নিলে বা রেটিং দিলে এখানে আসবে।');
  } };

  // ---------- rating & praise ----------
  SCREENS.progress = { title: () => S.me.role === 'student' ? 'আমার রেটিং ও কার্ড' : 'রেটিং ও প্রশংসা', render: async (el, id) => {
    const k = await kidOf(id); setSub(nm(k));
    const [rs, ps] = await Promise.all([
      cached('rat' + k.id, () => sel('class_ratings', `select=day,behavior,homework,performance,comment&student_id=eq.${k.id}&order=day.desc&limit=30`)).catch(() => []),
      cached('praise' + k.id, () => sel('praise_cards', `select=id,badge,note,created_at,giver:given_by(full_name)&student_id=eq.${k.id}&order=created_at.desc&limit=50`)).catch(() => []),
    ]);
    const tot = r => +r.behavior + +r.homework + +r.performance;
    const avg = rs.length ? rs.reduce((s, r) => s + tot(r), 0) / rs.length : 0;
    const B = { star: 'তারকা', helper: 'সাহায্যকারী', improver: 'উন্নতি', neat: 'পরিপাটি', punctual: 'সময়নিষ্ঠ', curious: 'জিজ্ঞাসু' };
    el.innerHTML = `<div class="card sun"><div class="mute small">গত ${bn(rs.length)} ক্লাসের গড়</div><div class="big">${num(avg.toFixed(1))}/১০</div>${bar(avg / 10, 'var(--teal)')}</div>
      ${section('ক্লাস রেটিং')}
      ${rs.map(r => `<div class="card" style="display:flex;gap:12px;align-items:center"><span class="score ${scoreClass(tot(r))}">${num(tot(r))}</span><div style="flex:1"><h3>${fmtDate(r.day)}</h3><div class="mute small">আচরণ ${num(r.behavior)} · কাজ ${+r.homework === 0 ? 'করেনি' : +r.homework === 3 ? 'করেছে' : 'আধা'} · পারফ. ${num(r.performance)}</div>${r.comment ? `<div class="mute">${esc(r.comment)}</div>` : ''}</div></div>`).join('') || empty('star', 'এখনো কোনো রেটিং নেই।')}
      ${section('প্রশংসা কার্ড')}
      ${ps.map(p => `<div class="card teal" style="display:flex;gap:12px;align-items:center">${chip('trophy', 40)}<div><h3>${esc(B[p.badge] || p.badge)}</h3><div class="mute small">${esc(p.giver?.full_name || '')} · ${fmtDate(p.created_at)}</div>${p.note ? `<div>${esc(p.note)}</div>` : ''}</div></div>`).join('') || empty('trophy', 'এখনো কোনো প্রশংসা কার্ড নেই।')}`;
  } };

  // ---------- director messages ----------
  SCREENS.director = { title: 'পরিচালকের বার্তা', render: async (el) => {
    const ms = await cached('director', () => sel('director_messages', 'select=id,title,body,video_url,published_on&order=published_on.desc'));
    el.innerHTML = ms.map(m => `<div class="card"><div class="mute small">${fmtDateY(m.published_on)}</div><h3>${esc(m.title)}</h3><div style="white-space:pre-wrap;margin-top:4px">${esc(m.body)}</div>
      <div class="chips" style="margin-top:8px"><button class="pill teal" data-speak="${esc(m.title + '। ' + (m.body || ''))}">পড়ে শোনাও</button>${safeUrl(m.video_url) ? `<a class="pill sun" href="${esc(safeUrl(m.video_url))}" target="_blank" rel="noopener">ভিডিও দেখুন</a>` : ''}</div></div>`).join('') || empty('mic', 'এখনো কোনো বার্তা নেই।');
    bindSpeak(el);
  } };

  // ---------- my data & privacy ----------
  SCREENS.mydata = { title: 'আমার তথ্য ও গোপনীয়তা', render: async (el) => {
    const c = (await sel('consents', `select=app_terms,cctv,ai_tutor,ai_grading,photos&profile_id=eq.${S.uid}`).catch(() => []))[0] || {};
    const items = [['cctv', 'CCTV-তে মুখ চিনে হাজিরা', 'মুখের তথ্য শুধু কোচিংয়ের কম্পিউটারে থাকে'], ['ai_tutor', 'AI পড়ার সহায়ক', 'প্রশ্ন Google Gemini-তে যায়'], ['ai_grading', 'AI দিয়ে খাতা মূল্যায়ন', 'খাতার ছবি Google Gemini-তে যায়'], ['photos', 'অনুষ্ঠানের ছবি', 'কোচিংয়ের নোটিশে ছবি ব্যবহার']];
    el.innerHTML = `<div class="card"><h2>${esc(S.me.full_name)}</h2><div class="mute">লগইন আইডি: ${esc(bn(S.me.login_id))}</div></div>
      ${section('সম্মতি')}
      ${items.map(([k, t, d]) => `<div class="card" style="display:flex;gap:12px;align-items:center"><div style="flex:1"><h3>${t}</h3><div class="mute small">${d}</div></div><button class="pill ${c[k] ? 'good' : ''}" data-c="${k}">${c[k] ? 'চালু' : 'বন্ধ'}</button></div>`).join('')}
      <button class="btn ghost" data-go="pin">পিন বদলান</button>
      <div class="card coral"><h3>তথ্য মুছে ফেলার অনুরোধ</h3><div class="mute">অনুরোধ করলে কোচিং অফিস ৩০ দিনের মধ্যে আপনার ও সন্তানের তথ্য মুছে দেবে।</div><button class="btn coral" id="delreq" style="margin-top:10px">অনুরোধ পাঠান</button></div>`;
    el.querySelectorAll('[data-c]').forEach(b => b.onclick = async () => {
      const k = b.dataset.c; c[k] = !c[k];
      try { await upsert('consents', { profile_id: S.uid, coaching_id: S.me.coaching_id, app_terms: true, [k]: c[k], updated_at: new Date().toISOString() }, 'profile_id'); render(); } catch { toast('সংরক্ষণ হয়নি'); }
    });
    el.querySelector('#delreq').onclick = async () => {
      if (!await confirmSheet('তথ্য মুছে ফেলা', 'অনুরোধ পাঠালে অফিস যোগাযোগ করে আপনার সব তথ্য মুছে দেবে। পাঠাবেন?', 'অনুরোধ পাঠান', true)) return;
      try { await ins('deletion_requests', { coaching_id: S.me.coaching_id, profile_id: S.uid }); toast('অনুরোধ পাঠানো হয়েছে'); } catch { toast('পাঠানো যায়নি'); }
    };
  } };

  // ---------- focus timer (FunScreens.FocusTimer: 25/5, end time kept so leaving doesn't reset) ----------
  SCREENS.focus = { title: 'ফোকাস টাইমার', sub: '২৫ মিনিট পড়ো, ৫ মিনিট বিশ্রাম', render: async (el) => {
    await loadKids();
    const draw = () => {
      const end = store.get('focusEnd'), mode = store.get('focusMode') || 'read';
      const left = end ? Math.max(0, end - Date.now()) : (mode === 'read' ? 25 : 5) * 60000;
      const mm = Math.floor(left / 60000), ss = Math.floor(left % 60000 / 1000);
      el.innerHTML = `<div class="card ${mode === 'read' ? 'coral' : 'teal'} center"><div class="mute">${mode === 'read' ? 'পড়ার সময়' : 'বিশ্রাম'}</div><div style="font-size:64px;font-weight:800;font-variant-numeric:tabular-nums">${bn(String(mm).padStart(2, '0'))}:${bn(String(ss).padStart(2, '0'))}</div></div>
        <button class="btn" id="ft">${end ? 'থামাও' : 'শুরু করো'}</button>`;
      el.querySelector('#ft').onclick = () => { if (store.get('focusEnd')) store.del('focusEnd'); else store.set('focusEnd', Date.now() + (mode === 'read' ? 25 : 5) * 60000); draw(); };
      if (end && left === 0) { store.del('focusEnd'); store.set('focusMode', mode === 'read' ? 'rest' : 'read'); toast(mode === 'read' ? 'দারুণ! এবার ৫ মিনিট বিশ্রাম।' : 'বিশ্রাম শেষ, আবার পড়া শুরু করো।'); if (mode === 'read' && kids?.[0]) rpc('log_focus', { p_student_id: kids[0].id, p_minutes: 25 }).then(o => o?.star && toast('একটি স্টার পেয়েছ!')).catch(() => {}); draw(); }
    };
    draw();
    const t = setInterval(() => { if (cur().r !== 'focus') return clearInterval(t); draw(); }, 1000);
  } };

  SCREENS.soon = { title: p => p || 'শীঘ্রই', render: async (el) => {
    el.innerHTML = `<div class="card">${empty('ai_spark', SOON + (isAndroid ? ' ততদিন অ্যান্ড্রয়েড অ্যাপে ব্যবহার করুন।' : ''))}</div>${apkBanner()}`;
  } };

  // Phone text-to-speech, like the APK's "পড়ে শোনাও" (Bangla voice if the phone has one).
  window.bindSpeak = el => el.querySelectorAll('[data-speak]').forEach(b => b.onclick = () => {
    if (!('speechSynthesis' in window)) return toast('এই ব্রাউজারে পড়ে শোনানো যায় না');
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(b.dataset.speak); u.lang = 'bn-BD';
    const v = speechSynthesis.getVoices().find(v => v.lang.startsWith('bn')); if (v) u.voice = v;
    speechSynthesis.speak(u);
  });
})();

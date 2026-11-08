'use strict';
// Guardian & student screens — mirror GuardianScreens.kt / StudentScreens.kt (same tiles, order and copy).
(function () {
  const STU = 'id,class_level,roll,batch:batches(shift),profile:profiles!students_profile_id_fkey(full_name),rewards:student_rewards(stars,streak_days)';
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
  SCREENS['g.home'] = { home: true, title: 'স্বাগতম', sub: () => S.me.full_name, trail: () => logoutPill('sun'), render: async (el) => {
    await loadKids();
    if (!kids.length) { el.innerHTML = empty('child', 'কোনো শিক্ষার্থী যুক্ত করা হয়নি। অনুগ্রহ করে কোচিং অফিসে যোগাযোগ করুন।'); return; }
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
    el.innerHTML = `
      ${kids.length > 1 ? chipRow(kids.map((k, i) => [i, nm(k)]), selIdx, 'data-kid') : ''}
      ${note ? `<div class="card tap ${note.read_at ? '' : 'sun'}" data-go="notes"><div class="mute small">${fmtDate(note.day)} · সর্বশেষ বার্তা${note.read_at ? '' : ' · নতুন'}</div><h3>${esc(note.title)}</h3><div class="mute">${esc(note.body)}</div></div>` : ''}
      <div class="card"><h2>আজকের তথ্য</h2>${today ? `<div class="ok" style="font-weight:700;font-size:16px">${esc(nm(c))} আজ ${fmtTime(today.check_in)}-এ উপস্থিত হয়েছে।</div>` : '<div class="mute">আজকের উপস্থিতির তথ্য এখনো পাওয়া যায়নি।</div>'}</div>
      ${due > 0 ? `<div class="card coral tap" data-go="fees:${c.id}"><h3>বকেয়া ফি ${taka(due)}</h3><div class="mute">${bn(fees.length)} মাসের ফি বাকি · বিস্তারিত দেখুন ›</div></div>` : ''}
      <div class="card"><div class="stats"><div><b>${bn(rw(c).stars || 0)}</b><span class="mute small">স্টার</span></div><div><b>${bn(rw(c).streak_days || 0)} দিন</b><span class="mute small">টানা উপস্থিতি</span></div></div></div>
      ${grid2([
        fun('calendar', 'উপস্থিতি', 'att:' + c.id, { tint: 'sky' }), fun('chart', 'রেজাল্ট', 'results:' + c.id, { tint: 'sun' }),
        fun('card', 'ফি', 'fees:' + c.id, { tint: 'coral' }), fun('bell', 'নোটিশ', 'notices:guardians', { tint: 'grape' }),
        fun('book', 'শিক্ষা উপকরণ', 'materials:' + c.class_level, { tint: 'teal' }), fun('chat', 'শিক্ষকের সাথে যোগাযোগ', 'chat:' + c.id, { tint: 'white' }),
        fun('star', 'রেটিং ও প্রশংসা', 'progress:' + c.id, { tint: 'sun' }), fun('headphones', 'ভয়েস মেসেজ', 'soon:ভয়েস মেসেজ', { tint: 'sky' }),
        fun('mic', 'পরিচালকের বার্তা', 'director', { tint: 'sun' }), fun('lock', 'আমার তথ্য ও গোপনীয়তা', 'mydata', { tint: 'sky' }),
        fun('handshake', 'শিক্ষকের সাথে মিটিং', 'meetings', { tint: 'teal', sub: 'সময় বুক করুন' }),
      ])}
      ${apkBanner()}`;
    el.querySelectorAll('[data-kid]').forEach(b => b.onclick = () => { selIdx = +b.dataset.kid; store.set('kid', selIdx); render(); });
    el.querySelectorAll('[data-logout]').forEach(b => b.onclick = confirmLogout);
    setTimeout(apkPopup, 1500);
  } };

  // ---------- student home ----------
  SCREENS['s.home'] = { home: true, title: () => 'স্বাগতম, ' + S.me.full_name, sub: 'আজকের পড়া এক নজরে', hdr: 'var(--plum400)', trail: () => logoutPill('white'), render: async (el) => {
    await loadKids();
    const st = kids[0];
    if (!st) { el.innerHTML = empty('child', 'ক্লাসের তথ্য পাওয়া যায়নি। কোচিং অফিসে যোগাযোগ করুন।'); return; }
    const sh = shiftOf(st);
    const [hw, done, mood] = await Promise.all([
      cached('hw' + st.class_level, () => sel('homework', `select=id,title,due_date,subject:subjects(name)&class_level=eq.${st.class_level}&order=due_date.asc`)).catch(() => []),
      sel('homework_done', `select=homework_id&student_id=eq.${st.id}`).then(r => new Set(r.map(x => x.homework_id))).catch(() => new Set()),
      sel('mood_checkins', `select=mood&student_id=eq.${st.id}&day=eq.${dhakaToday()}`).then(r => r[0]?.mood ?? null).catch(() => null),
    ]);
    const big = document.body.classList.contains('big');
    const fin = hw.filter(h => done.has(h.id)).length;
    const MOODS = [[1, 'খুব খারাপ'], [2, 'খারাপ'], [3, 'ঠিকঠাক'], [4, 'ভালো'], [5, 'দারুণ']];
    el.innerHTML = `
      <div class="chips"><span class="pill white">স্টার ${bn(rw(st).stars || 0)}</span><span class="pill white">টানা উপস্থিতি ${bn(rw(st).streak_days || 0)} দিন</span></div>
      <div class="card sun" style="display:flex;gap:12px;align-items:center">${chip(sh.icon, 44)}<div><div class="mute small">আজকের ক্লাস</div><div class="h2">${sh.bn} ব্যাচ</div><div class="mute">${sh.time}</div></div></div>
      <div class="card"><h3>আজ মন কেমন?</h3><div class="seg" style="margin-top:8px">${MOODS.map(([v, l]) => `<button data-mood="${v}" class="${mood === v ? 'on' : ''}"><b>${bn(v)}</b><span>${l}</span></button>`).join('')}</div></div>
      ${section('আজকের কাজ')}
      ${!hw.length ? empty('inbox', 'আজ কোনো বাড়ির কাজ নেই।') : `<div class="card ${fin === hw.length ? 'teal' : ''}"><h3>${fin === hw.length ? 'সব কাজ শেষ!' : `${bn(fin)} / ${bn(hw.length)} কাজ শেষ`}</h3><div style="margin-top:8px">${bar(fin / hw.length)}</div></div>
        ${hw.map(h => `<div class="card" style="display:flex;gap:12px;align-items:center"><button class="mark-btn ${done.has(h.id) ? 'on' : ''}" data-hw="${h.id}" aria-label="শেষ">${done.has(h.id) ? '✓' : ''}</button>
          <div style="flex:1">${pill(h.subject?.name || 'বিষয়', 'teal')}<h3 style="margin-top:4px;${done.has(h.id) ? 'color:var(--ink-soft)' : ''}">${esc(h.title)}</h3><div class="mute small">জমা দেওয়ার শেষ দিন: ${h.due_date ? fmtDate(h.due_date) : '—'}</div></div></div>`).join('')}`}
      ${section('খেলা ও অভ্যাস')}
      ${grid2([
        fun('timer', 'ফোকাস টাইমার', 'focus', { tint: 'coral', sub: '২৫ মিনিট পড়ো, স্টার পাও' }), fun('swords', 'কুইজ ডুয়েল', 's.duel', { tint: 'sky', sub: 'বন্ধুকে চ্যালেঞ্জ করো' }),
        fun('target', 'সাপ্তাহিক চ্যালেঞ্জ', 's.challenges', { tint: 'sun' }), fun('shop_bag', 'পয়েন্টের দোকান', 's.shop', { tint: 'grape', sub: 'অবতার ও রং' }),
        fun('letters', 'শব্দ ও বানান', 'soon:শব্দ ও বানান', { tint: 'teal' }), fun('gamepad', 'শিক্ষামূলক খেলা', 's.games', { tint: 'coral', sub: 'দ্রুত গণিত, নামতা' }),
        fun('mic', 'মুখস্থ পড়া ও ভয়েস', 'soon:মুখস্থ পড়া ও ভয়েস', { tint: 'coral', sub: 'রেকর্ড করে স্যারকে শোনাও' }),
        `<button class="fun t-${big ? 'sun' : 'sky'}" id="bigt">${chip('search')}<b>বড় লেখা</b><span class="small">${big ? 'চালু · বন্ধ করতে চাপো' : 'বন্ধ · চালু করতে চাপো'}</span></button>`,
        fun('star', 'আমার রেটিং ও কার্ড', 'progress:' + st.id, { tint: 'sun' }), fun('question', 'প্রশ্ন বক্স', 's.doubts', { tint: 'grape' }),
        fun('target', 'আমার লক্ষ্য', 's.goals', { tint: 'teal' }), fun('trophy', 'সার্টিফিকেট', 'soon:সার্টিফিকেট', { tint: 'sun' }),
        fun('notebook', 'ভুলের খাতা', 's.mistakes', { tint: 'coral' }), fun('flashcards', 'ফ্ল্যাশকার্ড', 'flash:' + st.class_level, { tint: 'grape' }),
        fun('book', 'সিলেবাস ও বইয়ের পৃষ্ঠা', 'syllabus:' + st.class_level, { tint: 'sky' }), fun('bell', 'নোটিশ', 'notices:students', { tint: 'teal' }),
        fun('book', 'শিক্ষা উপকরণ', 'materials:' + st.class_level, { tint: 'sky' }), fun('puzzle', 'দৈনিক ধাঁধা', 's.puzzle', { tint: 'coral' }),
        fun('ai_spark', 'AI পড়ার সহায়ক', 'soon:AI পড়ার সহায়ক', { tint: 'grape' }), fun('trophy', 'কুইজ ও লিডারবোর্ড', 's.quiz', { tint: 'sun' }),
      ])}
      ${apkBanner()}`;
    el.querySelectorAll('[data-logout]').forEach(b => b.onclick = confirmLogout);
    el.querySelector('#bigt').onclick = () => { const on = !document.body.classList.contains('big'); document.body.classList.toggle('big', on); store.set('big', on); render(); };
    el.querySelectorAll('[data-mood]').forEach(b => b.onclick = async () => {
      try { await upsert('mood_checkins', { coaching_id: S.me.coaching_id, student_id: st.id, day: dhakaToday(), mood: +b.dataset.mood }, 'student_id,day'); toast('ধন্যবাদ!'); render(); } catch { toast('সংরক্ষণ হয়নি'); }
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
  SCREENS.notices = { title: 'নোটিশ', render: async (el, aud) => {
    const f = aud ? `&audience=in.(all,${aud})` : '';
    const ns = await cached('notices' + (aud || ''), () => sel('notices', `select=id,title,body,audience,created_at&order=created_at.desc&limit=50${f}`));
    el.innerHTML = ns.map(n => `<div class="card"><div class="mute small">${fmtDateY(n.created_at)}</div><h3>${esc(n.title)}</h3><div style="white-space:pre-wrap;margin-top:4px">${esc(n.body)}</div>
      <button class="pill teal" data-speak="${esc(n.title + '। ' + (n.body || ''))}" style="margin-top:8px">পড়ে শোনাও</button></div>`).join('') || empty('bell', 'এখনো কোনো নোটিশ নেই।');
    bindSpeak(el);
  } };

  // ---------- materials ----------
  SCREENS.materials = { title: 'শিক্ষা উপকরণ', sub: c => 'ক্লাস ' + bn(c), render: async (el, cls) => {
    const ms = await cached('mat' + cls, () => sel('materials', `select=id,chapter,title,kind,url,storage_path,subject:subjects(name)&class_level=eq.${cls}&order=created_at.desc`));
    const K = { pdf: ['document', 'PDF'], note: ['note_edit', 'নোট'], video: ['book', 'ভিডিও'], link: ['document', 'লিংক'] };
    el.innerHTML = ms.map(m => `<div class="card tap" data-mat="${m.id}" style="display:flex;gap:12px;align-items:center">${chip(K[m.kind]?.[0] || 'book', 40)}<div style="flex:1"><h3>${esc(m.title)}</h3><div class="mute small">${esc(m.subject?.name || '')}${m.chapter ? ' · ' + esc(m.chapter) : ''} · ${K[m.kind]?.[1] || ''}</div></div></div>`).join('') || empty('book', 'এই ক্লাসের জন্য এখনো কোনো উপকরণ নেই।');
    el.querySelectorAll('[data-mat]').forEach(b => b.onclick = async () => {
      const m = ms.find(x => x.id === b.dataset.mat);
      try { const u = m.url || (m.storage_path ? await signedUrl('materials', m.storage_path) : null); if (u) window.open(u, '_blank', 'noopener'); else toast('ফাইল পাওয়া যায়নি'); }
      catch { toast('খোলা যায়নি'); }
    });
  } };

  // ---------- notes ----------
  SCREENS.notes = { title: 'বার্তা', sub: 'প্রতিদিনের উপস্থিতি ও ক্লাস স্কোর', render: async (el) => {
    await loadKids();
    const ns = await cached('notes', () => sel('guardian_notes', 'select=id,student_id,day,title,body,read_at&order=updated_at.desc&limit=60'));
    const unread = ns.filter(n => !n.read_at).map(n => n.id);
    if (unread.length && !offlineFlag) rpc('mark_notes_read', { p_ids: unread }).catch(() => {});
    const name = id => nm(kids.find(x => x.id === id));
    el.innerHTML = ns.map(n => `<div class="card ${n.read_at ? '' : 'sun'}"><div class="mute small">${esc(name(n.student_id))} · ${fmtDate(n.day)}${n.read_at ? '' : ' · নতুন'}</div><h3>${esc(n.title)}</h3><div>${esc(n.body)}</div></div>`).join('') || empty('inbox', 'এখনো কোনো বার্তা নেই। হাজিরা বা ক্লাস স্কোর দিলে এখানে দেখা যাবে।');
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
      <div class="chips" style="margin-top:8px"><button class="pill teal" data-speak="${esc(m.title + '। ' + (m.body || ''))}">পড়ে শোনাও</button>${m.video_url ? `<a class="pill sun" href="${esc(m.video_url)}" target="_blank" rel="noopener">ভিডিও দেখুন</a>` : ''}</div></div>`).join('') || empty('mic', 'এখনো কোনো বার্তা নেই।');
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

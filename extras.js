'use strict';
// Phase 6 — voice notes, AI (tutor, question paper, answer grading), spelling & words, certificates.
// Mirrors VoiceScreens.kt, AiScreens.kt, PaperScreens.kt, FunScreens (spelling/word), Reports.kt (certificates).
(function () {
  const STU = 'id,class_level,roll,profile:profiles!students_profile_id_fkey(full_name)';
  const nm = s => s?.profile?.full_name || s?.roll || 'শিক্ষার্থী';
  const staff = () => S.me.role === 'teacher' || S.me.role === 'admin';
  const myStudent = async () => S.me.role === 'student' ? (await sel('students', `select=${STU}&profile_id=eq.${S.uid}&limit=1`))[0] : null;
  const AI_ERR = e => /daily_limit/.test(e.body || '') ? 'আজকের প্রশ্নের সীমা শেষ। কাল আবার জিজ্ঞেস করো।' : /staff only|students only/.test(e.body || '') ? 'এই অংশ তোমার জন্য নয়।' : 'AI এখন উত্তর দিতে পারছে না। একটু পরে চেষ্টা করুন।';

  // ---------- voice recording helper (MediaRecorder; m4a on iPhone, webm elsewhere) ----------
  async function recordSheet(title, onDone) {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return toast('এই ব্রাউজারে রেকর্ড করা যায় না');
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { return toast('মাইক্রোফোনের অনুমতি দিন'); }
    const type = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find(t => MediaRecorder.isTypeSupported(t)) || '';
    const rec = new MediaRecorder(stream, type ? { mimeType: type } : {}); const chunks = []; let start = 0, timer;
    rec.ondataavailable = e => chunks.push(e.data);
    sheet(`<h2>${esc(title)}</h2><div class="center" style="font-size:40px;font-weight:800" id="rt">০:০০</div><div class="mute small center">সর্বোচ্চ ৫ মিনিট</div>
      <button class="btn coral" id="rs">রেকর্ড শুরু</button><button class="btn" id="rsend" disabled>পাঠান</button><button class="link" data-close>বাতিল</button>`, (s, close) => {
      const stopAll = () => { clearInterval(timer); if (rec.state !== 'inactive') rec.stop(); stream.getTracks().forEach(t => t.stop()); };
      s.parentNode.addEventListener('click', e => { if (e.target === s.parentNode || e.target.hasAttribute('data-close')) stopAll(); });
      s.querySelector('#rs').onclick = () => {
        if (rec.state === 'recording') { stopAll(); s.querySelector('#rs').textContent = 'রেকর্ড শেষ'; s.querySelector('#rs').disabled = true; s.querySelector('#rsend').disabled = false; return; }
        rec.start(); start = Date.now(); s.querySelector('#rs').textContent = 'থামান';
        timer = setInterval(() => { const sec = Math.floor((Date.now() - start) / 1000); s.querySelector('#rt').textContent = `${bn(Math.floor(sec / 60))}:${bn(String(sec % 60).padStart(2, '0'))}`; if (sec >= 300) s.querySelector('#rs').click(); }, 250);
      };
      s.querySelector('#rsend').onclick = async () => {
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' }), secs = Math.min(300, Math.round((Date.now() - start) / 1000));
        s.querySelector('#rsend').disabled = true; s.querySelector('#rsend').textContent = 'পাঠানো হচ্ছে…';
        try { await onDone(blob, secs); close(); toast('পাঠানো হয়েছে ✓'); render(); } catch { toast('পাঠানো যায়নি'); s.querySelector('#rsend').disabled = false; s.querySelector('#rsend').textContent = 'পাঠান'; }
      };
    });
  }
  async function sendVoice(studentId, kind, title, blob, seconds) {
    const ext = /mp4/.test(blob.type) ? 'm4a' : 'webm';
    const path = `${S.me.coaching_id}/${studentId}/${crypto.randomUUID()}.${ext}`;
    await upload('voice', path, blob, blob.type.split(';')[0]);
    try { await ins('voice_notes', { coaching_id: S.me.coaching_id, student_id: studentId, kind, title, path, seconds, status: kind === 'recitation' ? 'pending' : null, created_by: S.uid }, 'select=id'); }
    catch (e) { raw('DELETE', `/storage/v1/object/voice/${path}`).catch(() => {}); throw e; }
  }
  const noteCard = n => `<div class="card ${n.status === 'ok' ? 'good' : n.status === 'again' ? 'coral' : ''}"><div class="mute small">${n.kind === 'feedback' ? 'শিক্ষকের ভয়েস' : 'মুখস্থ পড়া'} · ${fmtDate(n.created_at)} · ${bn(n.seconds)} সেকেন্ড</div><h3>${esc(n.title || (n.kind === 'feedback' ? 'শিক্ষকের বার্তা' : 'রেকর্ড'))}</h3>
    ${n.kind === 'recitation' ? `<div>${n.status === 'ok' ? pill('ঠিক আছে ✓', 'good') : n.status === 'again' ? pill('আবার পড়ো', 'bad') : pill('স্যার শুনবেন', 'sun')}${n.teacher_note ? ' <span class="mute small">' + esc(n.teacher_note) + '</span>' : ''}</div>` : ''}
    <button class="pill teal" data-play="${esc(n.path)}" style="margin-top:6px">শুনুন</button></div>`;
  const bindPlay = el => el.querySelectorAll('[data-play]').forEach(b => b.onclick = async () => { try { new Audio(await signedUrl('voice', b.dataset.play)).play(); } catch { toast('চালানো যায়নি'); } });

  // family: voice box (guardian sees teacher feedback; student also records recitations)
  SCREENS.voicebox = { title: () => S.me.role === 'student' ? 'মুখস্থ পড়া ও ভয়েস' : 'ভয়েস মেসেজ', render: async (el, studentId) => {
    const st = await myStudent(); const sid = studentId || st?.id;
    const notes = await sel('voice_notes', `select=id,student_id,kind,title,path,seconds,status,teacher_note,created_at&student_id=eq.${sid}&order=created_at.desc&limit=50`);
    el.innerHTML = (st ? '<button class="btn" id="rec">মুখস্থ পড়া রেকর্ড করো</button><div class="mute small center">রেকর্ড করে স্যারকে শোনাও। স্যার ✓ বা "আবার" দেবেন।</div>' : '') + (notes.map(noteCard).join('') || empty('headphones', 'এখনো কোনো ভয়েস মেসেজ নেই।')) + '<div class="mute small center">ভয়েস ৯০ দিন পর নিজে থেকে মুছে যায়।</div>';
    bindPlay(el);
    const r = el.querySelector('#rec'); if (r) r.onclick = () => sheet(`<h2>কী পড়বে?</h2><input id="vt" maxlength="120" placeholder="যেমন: কবিতা · আমাদের ছোট নদী"><button class="btn" id="vn">পরের ধাপ</button><button class="link" data-close>বাতিল</button>`, (s, close) => {
      s.querySelector('#vn').onclick = () => { const t = s.querySelector('#vt').value.trim(); close(); recordSheet(t || 'মুখস্থ পড়া', (blob, secs) => sendVoice(st.id, 'recitation', t, blob, secs)); };
    });
  } };

  // staff: voice feedback + recitation review
  SCREENS['t.voice'] = { title: 'ভয়েস ও মুখস্থ পড়া', render: async (el) => {
    const [pending, studs] = await Promise.all([
      sel('voice_notes', `select=id,student_id,kind,title,path,seconds,status,teacher_note,created_at,student:students(${STU})&kind=eq.recitation&status=eq.pending&order=created_at&limit=50`),
      T.allStudents(),
    ]);
    el.innerHTML = `<div class="card"><h3>শিক্ষার্থীকে ভয়েস ফিডব্যাক</h3><select id="vs">${T.sortRoster(studs).map(s => `<option value="${s.id}">${esc(nm(s))} · ক্লাস ${bn(s.class_level)} · রোল ${esc(bn(s.roll || ''))}</option>`).join('')}</select><input id="vt" maxlength="120" placeholder="শিরোনাম (যেমন: আজকের হাতের লেখা)"><button class="btn" id="vrec">রেকর্ড করুন</button></div>`
      + section('শোনার অপেক্ষায়') + (pending.map(n => `<div class="card"><h3>${esc(nm(n.student))} · ${esc(n.title || 'মুখস্থ পড়া')}</h3><div class="mute small">${fmtDate(n.created_at)} · ${bn(n.seconds)} সেকেন্ড</div>
        <div class="chips" style="margin-top:8px"><button class="pill teal" data-play="${esc(n.path)}">শুনুন</button><button class="pill good" data-ok="${n.id}">ঠিক আছে ✓</button><button class="pill bad" data-again="${n.id}">আবার</button></div></div>`).join('') || empty('mic', 'শোনার মতো নতুন রেকর্ড নেই।'));
    bindPlay(el);
    el.querySelector('#vrec').onclick = () => { const sid = el.querySelector('#vs').value, t = el.querySelector('#vt').value.trim(); recordSheet('ভয়েস ফিডব্যাক', (blob, secs) => sendVoice(sid, 'feedback', t, blob, secs)); };
    const review = (id, status) => sheet(`<h2>${status === 'ok' ? 'ঠিক আছে' : 'আবার পড়তে বলুন'}</h2><input id="rn" maxlength="300" placeholder="ছোট মন্তব্য (ঐচ্ছিক)"><button class="btn" id="rk">সংরক্ষণ</button><button class="link" data-close>বাতিল</button>`, (s, close) => {
      s.querySelector('#rk').onclick = async () => { try { await upd('voice_notes', `id=eq.${id}&select=id`, { status, teacher_note: s.querySelector('#rn').value.trim() }); close(); render(); } catch { toast('হয়নি'); } };
    });
    el.querySelectorAll('[data-ok]').forEach(b => b.onclick = () => review(b.dataset.ok, 'ok'));
    el.querySelectorAll('[data-again]').forEach(b => b.onclick = () => review(b.dataset.again, 'again'));
    // staff clients purge expired voice files (same as the APK)
    rpc('expired_voice_paths').then(ps => ps?.length && Promise.all(ps.map(p => raw('DELETE', `/storage/v1/object/voice/${p}`).catch(() => {})))).catch(() => {});
  } };

  // ---------- AI tutor (students) ----------
  const tutorHistory = [];
  SCREENS['s.tutor'] = { title: 'AI পড়ার সহায়ক', sub: 'পড়ার প্রশ্ন জিজ্ঞেস করো', render: async (el) => {
    const st = await myStudent();
    const draw = () => {
      el.innerHTML = `<div class="card cream mute small">AI ভুলও করতে পারে। গুরুত্বপূর্ণ বিষয় স্যারের কাছে মিলিয়ে নিও। প্রশ্ন Google Gemini-তে যায়, নিজের নাম-ঠিকানা লিখো না।</div>
        <div style="display:flex;flex-direction:column;gap:8px">${tutorHistory.map(m => `<div class="bubble ${m.from_student ? 'me' : ''}" style="white-space:pre-wrap">${esc(m.text)}</div>`).join('') || empty('ai_spark', 'যেকোনো পড়ার প্রশ্ন লেখো। যেমন: "ভগ্নাংশ যোগ কীভাবে করে?"')}</div>
        <div class="formrow" style="align-items:flex-end"><textarea id="tq" maxlength="800" style="min-height:54px;margin:0" placeholder="প্রশ্ন লেখো"></textarea><button class="btn" id="ts" style="flex:0 0 96px">পাঠাও</button></div>`;
      el.querySelector('#ts').onclick = async () => {
        const q = el.querySelector('#tq').value.trim(); if (!q) return;
        tutorHistory.push({ from_student: true, text: q }); tutorHistory.push({ from_student: false, text: '…' }); draw();
        try { const r = await fn('ai', { mode: 'tutor', class_level: st?.class_level || 5, history: tutorHistory.slice(0, -1) }); tutorHistory[tutorHistory.length - 1].text = r.reply; }
        catch (e) { tutorHistory[tutorHistory.length - 1].text = AI_ERR(e); }
        draw(); window.scrollTo(0, document.body.scrollHeight);
      };
    };
    draw();
  } };

  // ---------- AI question paper (staff) → print or save to question bank ----------
  SCREENS['t.aipaper'] = { title: 'AI প্রশ্নপত্র তৈরি', render: async (el) => {
    el.innerHTML = `<div class="card"><div class="formrow"><div><label>ক্লাস</label><select id="pc">${CLASSES.map(c => `<option value="${c}" ${c === 6 ? 'selected' : ''}>ক্লাস ${bn(c)}</option>`).join('')}</select></div><div><label>বিষয়</label><input id="ps" maxlength="60" placeholder="গণিত"></div></div>
      <label>অধ্যায় / বিষয়বস্তু</label><input id="ph" maxlength="300" placeholder="যেমন: ভগ্নাংশ ও দশমিক">
      <div class="formrow"><div><label>বহুনির্বাচনী</label><input id="pm" inputmode="numeric" value="10"></div><div><label>সংক্ষিপ্ত</label><input id="pq" inputmode="numeric" value="5"></div><div><label>সৃজনশীল</label><input id="pr" inputmode="numeric" value="2"></div></div>
      <button class="btn" id="pgo">প্রশ্নপত্র তৈরি করুন</button><div class="mute small">AI-এর প্রশ্ন ব্যবহারের আগে পড়ে দেখুন।</div></div><div id="pout"></div>`;
    el.querySelector('#pgo').onclick = async () => {
      const v = id => el.querySelector(id).value.trim(), b = el.querySelector('#pgo');
      if (!v('#ps') || !v('#ph')) return toast('বিষয় ও অধ্যায় দিন');
      b.disabled = true; b.textContent = 'তৈরি হচ্ছে… (৩০ সেকেন্ড পর্যন্ত)';
      try {
        const cls = +v('#pc'), p = await fn('ai', { mode: 'paper', class_level: cls, subject: v('#ps'), chapter: v('#ph'), mcq: +ascii(v('#pm')) || 0, short: +ascii(v('#pq')) || 0, creative: +ascii(v('#pr')) || 0 });
        const T2 = { MCQ: 'বহুনির্বাচনী', SHORT: 'সংক্ষিপ্ত', CREATIVE: 'সৃজনশীল' };
        el.querySelector('#pout').innerHTML = `<div class="card" id="paper"><h2 class="center">${esc(p.title)}</h2><div class="mute center">ক্লাস ${bn(cls)} · ${esc(v('#ps'))}</div>${p.questions.map((q, i) => `<div class="row col"><b>${bn(i + 1)}. ${esc(q.text)}</b> <span class="mute small">${T2[q.type] || ''}</span>${q.options?.length ? `<div>${q.options.map((o, j) => `(${'কখগঘঙ'[j] || j + 1}) ${esc(o)}`).join('&nbsp;&nbsp; ')}</div>` : ''}<div class="mute small">উত্তর: ${esc(q.answer)}</div></div>`).join('')}</div>
          <div class="grid2"><button class="btn ghost" onclick="window.print()">প্রিন্ট / PDF</button><button class="btn" id="tobank">প্রশ্ন ব্যাংকে রাখুন</button></div>`;
        el.querySelector('#tobank').onclick = async () => {
          try { await ins('question_bank', p.questions.map(q => ({ coaching_id: S.me.coaching_id, class_level: cls, subject: v('#ps'), chapter_name: v('#ph'), qtype: (q.type || 'SHORT').toLowerCase(), difficulty: 'medium', body: q.text, options: q.options || [], answer: q.answer || '', created_by: S.uid })), 'select=id'); toast('ব্যাংকে রাখা হয়েছে ✓'); }
          catch { toast('রাখা যায়নি'); }
        };
      } catch (e) { toast(AI_ERR(e)); }
      b.disabled = false; b.textContent = 'প্রশ্নপত্র তৈরি করুন';
    };
  } };

  // ---------- AI answer grading (staff) ----------
  SCREENS['t.grading'] = { title: 'AI খাতা মূল্যায়ন', render: async (el) => {
    el.innerHTML = `<div class="card"><label>প্রশ্ন</label><textarea id="gq" maxlength="2000"></textarea><label>শিক্ষার্থীর উত্তর</label><textarea id="ga" maxlength="6000"></textarea><label>পূর্ণমান</label><input id="gf" inputmode="numeric" value="10">
      <button class="btn" id="ggo">মূল্যায়ন করুন</button><div class="mute small">AI শুধু পরামর্শ দেয়; চূড়ান্ত নম্বর আপনি দেবেন। উত্তর Google Gemini-তে যায় (অভিভাবকের সম্মতি থাকলে ব্যবহার করুন)।</div></div><div id="gout"></div>`;
    el.querySelector('#ggo').onclick = async () => {
      const q = el.querySelector('#gq').value.trim(), a = el.querySelector('#ga').value.trim(), f = +ascii(el.querySelector('#gf').value) || 10, b = el.querySelector('#ggo');
      if (!q || !a) return toast('প্রশ্ন ও উত্তর দিন');
      b.disabled = true; b.textContent = 'দেখা হচ্ছে…';
      try { const r = await fn('ai', { mode: 'grade', question: q, answer: a, full_marks: f }); el.querySelector('#gout').innerHTML = `<div class="card teal"><div class="mute small">প্রস্তাবিত নম্বর</div><div class="big">${num(r.suggested_marks)}/${num(r.full_marks)}</div><div style="white-space:pre-wrap">${esc(r.feedback)}</div></div>`; }
      catch (e) { toast(AI_ERR(e)); }
      b.disabled = false; b.textContent = 'মূল্যায়ন করুন';
    };
  } };

  // ---------- spelling & word of the day ----------
  const WORDS = [['apple', 'আপেল', 'I eat an apple.', 1], ['bird', 'পাখি', 'The bird can fly.', 1], ['river', 'নদী', 'The river is long.', 1], ['book', 'বই', 'This is my book.', 1], ['happy', 'খুশি', 'I am happy today.', 1], ['water', 'পানি', 'Drink clean water.', 1], ['school', 'বিদ্যালয়', 'I go to school.', 1], ['friend', 'বন্ধু', 'Rina is my friend.', 1], ['flower', 'ফুল', 'The flower is red.', 1], ['green', 'সবুজ', 'Grass is green.', 1],
    ['honest', 'সৎ', 'An honest boy tells the truth.', 2], ['village', 'গ্রাম', 'My village is beautiful.', 2], ['journey', 'যাত্রা', 'The journey was long.', 2], ['country', 'দেশ', 'Bangladesh is my country.', 2], ['weather', 'আবহাওয়া', 'The weather is cold.', 2], ['science', 'বিজ্ঞান', 'I like science.', 2], ['library', 'পাঠাগার', 'We read in the library.', 2], ['market', 'বাজার', 'Father went to the market.', 2], ['healthy', 'স্বাস্থ্যবান', 'Fruits keep us healthy.', 2], ['festival', 'উৎসব', 'Eid is a big festival.', 2],
    ['knowledge', 'জ্ঞান', 'Knowledge is power.', 3], ['environment', 'পরিবেশ', 'Keep the environment clean.', 3], ['independence', 'স্বাধীনতা', 'We won independence in 1971.', 3], ['responsible', 'দায়িত্বশীল', 'Be a responsible citizen.', 3], ['curious', 'কৌতূহলী', 'A curious mind learns fast.', 3], ['patience', 'ধৈর্য', 'Patience brings success.', 3], ['government', 'সরকার', 'The government built a bridge.', 3], ['discipline', 'শৃঙ্খলা', 'Discipline makes life easy.', 3], ['pollution', 'দূষণ', 'Air pollution is harmful.', 3], ['necessary', 'প্রয়োজনীয়', 'Sleep is necessary.', 3]];
  const BANGLA = [['মুহূর্ত', 'মুহুর্ত', 'মূহুর্ত'], ['পরীক্ষা', 'পরিক্ষা', 'পরীখ্যা'], ['উজ্জ্বল', 'উজ্বল', 'উজ্জল'], ['শ্রদ্ধা', 'স্রদ্ধা', 'শ্রধ্যা'], ['দারিদ্র্য', 'দারিদ্র', 'দারীদ্র্য'], ['সমীচীন', 'সমিচীন', 'সমীচিন'], ['বিদ্যালয়', 'বিদ্যালই', 'বিদ্দালয়'], ['ভৌগোলিক', 'ভৌগলিক', 'ভোগোলিক'], ['স্বাস্থ্য', 'সাস্থ্য', 'স্বাস্থ'], ['প্রতিযোগিতা', 'প্রতিযোগীতা', 'প্রতীযোগিতা'], ['শিক্ষার্থী', 'শিক্ষার্থি', 'শিখ্খার্থী'], ['পুরস্কার', 'পুরষ্কার', 'পুরস্কাড়']];
  const shuffle = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(x => x[1]);
  SCREENS['s.spelling'] = { title: 'শব্দ ও বানান', render: async (el) => {
    const st = await myStudent(); const lvl = (st?.class_level || 3) <= 3 ? 1 : st.class_level <= 5 ? 2 : 3;
    const day = Math.floor((Date.now() + 6 * 3600e3) / 864e5), pool = WORDS.filter(w => w[3] <= lvl), w = pool[day % pool.length];
    el.innerHTML = `<div class="card sun"><div class="mute small">আজকের শব্দ</div><div class="big">${w[0]}</div><h3>${w[1]}</h3><div class="mute">${esc(w[2])}</div><button class="pill teal" data-say="${w[0]}. ${esc(w[2])}" style="margin-top:6px">শুনুন</button></div>`
      + grid2([`<button class="fun t-sky" data-g="en">${chip('letters')}<b>ইংরেজি বানান</b><span class="small">শুনে লেখো</span></button>`, `<button class="fun t-teal" data-g="bn">${chip('letters')}<b>বাংলা বানান</b><span class="small">সঠিকটা বাছো</span></button>`]);
    el.querySelector('[data-say]').onclick = e => { const u = new SpeechSynthesisUtterance(e.target.dataset.say); u.lang = 'en-US'; speechSynthesis.cancel(); speechSynthesis.speak(u); };
    const finish = async (score, n, kind) => {
      let star = false; if (st && score >= Math.ceil(n * .7)) { try { const r = await rpc('claim_daily_star', { p_student_id: st.id, p_kind: kind }); star = r === true || r === 'true'; } catch {} }
      el.innerHTML = `<div class="card teal">${empty('party', `${bn(score)}/${bn(n)} সঠিক!${star ? ' আজকের স্টার পেয়েছ!' : ''}`)}</div><button class="btn" id="bk">আবার</button>`; el.querySelector('#bk').onclick = () => render();
    };
    el.querySelector('[data-g="en"]').onclick = () => {
      const qs = shuffle(pool).slice(0, 8); let i = 0, score = 0;
      const ask = () => { const q = qs[i]; el.innerHTML = `<div class="mute small center">${bn(i + 1)}/${bn(qs.length)}</div><div class="card center"><h2>${q[1]}</h2><button class="pill teal" id="say">শুনুন</button></div><input id="sa" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="ইংরেজি বানান লেখো"><button class="btn" id="sok">মিলাও</button>`;
        el.querySelector('#say').onclick = () => { const u = new SpeechSynthesisUtterance(q[0]); u.lang = 'en-US'; speechSynthesis.speak(u); };
        el.querySelector('#sok').onclick = () => { if (el.querySelector('#sa').value.trim().toLowerCase() === q[0]) score++; else toast('সঠিক: ' + q[0]); i++; i < qs.length ? ask() : finish(score, qs.length, 'spelling'); }; };
      ask();
    };
    el.querySelector('[data-g="bn"]').onclick = () => {
      const qs = shuffle(BANGLA).slice(0, 8); let i = 0, score = 0;
      const ask = () => { const [right, ...wrong] = qs[i]; const opts = shuffle([right, ...wrong]);
        el.innerHTML = `<div class="mute small center">${bn(i + 1)}/${bn(qs.length)} · কোন বানানটি সঠিক?</div><div class="card">${opts.map(o => `<button class="qopt" data-o="${o}">${o}</button>`).join('')}</div>`;
        el.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { const ok = b.dataset.o === right; if (ok) score++; b.classList.add(ok ? 'right' : 'wrong'); el.querySelectorAll('[data-o]').forEach(x => { x.disabled = true; if (x.dataset.o === right) x.classList.add('right'); }); setTimeout(() => { i++; i < qs.length ? ask() : finish(score, qs.length, 'word'); }, 700); }); };
      ask();
    };
  } };

  // ---------- certificates (printable; browser "Save as PDF") ----------
  SCREENS.certs = { title: 'সার্টিফিকেট', hdr: 'var(--plum400)', render: async (el, studentId) => {
    const st = studentId ? (await sel('students', `select=${STU}&id=eq.${studentId}`))[0] : await myStudent();
    setSub(nm(st));
    const [att, rat, praise, goals] = await Promise.all([
      sel('attendance', `select=check_in&student_id=eq.${st.id}&order=date.desc&limit=60`),
      sel('class_ratings', `select=behavior,homework,performance&student_id=eq.${st.id}&order=day.desc&limit=12`),
      sel('praise_cards', `select=id&student_id=eq.${st.id}`).catch(() => []),
      sel('student_goals', `select=subject,target_percent,achieved_at&student_id=eq.${st.id}`).catch(() => []),
    ]);
    const attPct = att.length ? Math.round(100 * att.filter(a => a.check_in).length / att.length) : 0;
    const avgT = rat.length ? rat.reduce((s, r) => s + +r.behavior + +r.homework + +r.performance, 0) / rat.length : 0;
    const avgB = rat.length ? rat.reduce((s, r) => s + +r.behavior, 0) / rat.length : 0;
    const certs = [
      ['calendar', 'নিয়মিত উপস্থিতি', `নিয়মিত ক্লাসে উপস্থিত থেকে ${bn(attPct)}% উপস্থিতি অর্জনের জন্য`, att.length >= 8 && attPct >= 90, `উপস্থিতি ৯০% হলে পাবে · এখন ${bn(attPct)}%`],
      ['star', 'আদর্শ আচরণ', 'ক্লাসে মনোযোগী, ভদ্র ও শৃঙ্খলাপূর্ণ আচরণের জন্য', rat.length >= 6 && avgB >= 2.8, 'শেষ ক্লাসগুলোতে আচরণে প্রায় পুরো নম্বর পেলে পাবে'],
      ['trophy', 'চমৎকার পারফরম্যান্স', `ক্লাসে গড়ে ${num(avgT.toFixed(1))}/১০ রেটিং অর্জনের জন্য`, rat.length >= 6 && avgT >= 8.5, `গড় রেটিং ৮.৫ হলে পাবে · এখন ${num(avgT.toFixed(1))}`],
      ['trophy', 'প্রশংসার তারকা', `শিক্ষকদের কাছ থেকে ${bn(praise.length)}টি প্রশংসা কার্ড অর্জনের জন্য`, praise.length >= 5, `৫টি প্রশংসা কার্ড লাগবে · আছে ${bn(praise.length)}টি`],
      ...goals.filter(g => g.achieved_at).map(g => ['target', 'লক্ষ্য পূরণ: ' + g.subject, `${g.subject} বিষয়ে ${bn(g.target_percent)}% নম্বরের লক্ষ্য পূরণের জন্য`, true, '']),
    ];
    el.innerHTML = certs.map(([ic, t, reason, ok, hint], i) => `<div class="card ${ok ? 'sun' : ''}" style="display:flex;gap:12px;align-items:center;${ok ? '' : 'opacity:.6'}">${chip(ic, 44)}<div style="flex:1"><h3>${esc(t)}</h3><div class="mute small">${ok ? 'অর্জিত!' : esc(hint)}</div></div>${ok ? `<button class="pill teal" data-cert="${i}">PDF</button>` : ''}</div>`).join('');
    el.querySelectorAll('[data-cert]').forEach(b => b.onclick = () => {
      const [, t, reason] = certs[+b.dataset.cert];
      const w = window.open('', '_blank'); if (!w) return toast('পপআপ চালু করুন');
      w.document.write(`<!doctype html><html lang="bn"><head><meta charset="utf-8"><title>${esc(t)}</title><style>@page{size:A4 landscape;margin:0}body{margin:0;font-family:"Noto Sans Bengali",sans-serif;background:#FBF8EC}.c{box-sizing:border-box;width:297mm;height:210mm;padding:18mm;border:10mm solid #3B1F42;outline:2px solid #E2CE7E;outline-offset:-14mm;text-align:center;display:flex;flex-direction:column;justify-content:center;gap:8mm}h1{font:600 34pt Georgia,serif;color:#502A58;margin:0}h2{font-size:28pt;margin:0;color:#28142E}p{font-size:15pt;color:#47404C;margin:0}.g{color:#A0832C;letter-spacing:3px;font:12pt Georgia,serif}</style></head><body><div class="c"><img src="${location.origin + location.pathname.replace(/[^/]*$/, '')}logo.svg" style="height:30mm;margin:0 auto"><div class="g">DIFFERENT ACADEMIC &amp; EXAM CARE</div><h1>${esc(t)}</h1><p>এই সনদ প্রদান করা হলো</p><h2>${esc(nm(st))}</h2><p>শ্রেণি ${bn(st.class_level)} · ${esc(reason)}</p><p>${fmtDateY(dhakaToday())}</p></div><script>onload=()=>setTimeout(()=>print(),400)<\/script></body></html>`);
      w.document.close();
    });
  } };
})();

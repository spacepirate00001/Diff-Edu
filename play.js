'use strict';
// Phase 4 — student fun & study screens. Mirrors FeatureScreens (quiz/leaderboard), PlayScreens, FunScreens,
// ContentScreens (flashcards, syllabus, mistake book), ProgressScreens (goals) and ClassroomScreens (doubt box).
(function () {
  const me = async () => { const k = await cached('kids', () => sel('students', `select=id,class_level,roll,batch:batches(shift),profile:profiles!students_profile_id_fkey(full_name),rewards:student_rewards(stars,streak_days)&profile_id=eq.${S.uid}&limit=1`)); return k[0]; };
  const LEITNER = [0, 1, 2, 4, 7, 14];
  const addDays = (d, n) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return x.toLocaleDateString('en-CA'); };
  const PUZZLES = [['আমি একটি দুই অঙ্কের সংখ্যা। আমাকে উল্টালেও আমি একই থাকি, আর আমার দুই অঙ্ক যোগ করলে হয় ৮। আমি কে?', '৪৪'], ['একটি সংখ্যাকে ৩ দিয়ে গুণ করে ৫ যোগ করলে ২০ হয়। সংখ্যাটি কত?', '৫'], ['রাফির কাছে ১২টি আম। সে অর্ধেক বোনকে দিল, বাকির অর্ধেক বন্ধুকে দিল। তার কাছে কয়টি আম রইল?', '৩'], ['১, ৪, ৯, ১৬, … পরের সংখ্যাটি কত?', '২৫'], ['ঘড়িতে ঠিক ৩টা বাজে। ঘণ্টার কাঁটা আর মিনিটের কাঁটার মাঝে কত ডিগ্রি কোণ?', '৯০'], ['৫ সপ্তাহ ৩ দিনে মোট কত দিন?', '৩৮'], ['২, ৪, ৮, ১৬, … পরের সংখ্যাটি কত?', '৩২'], ['একটি ত্রিভুজের তিন কোণের যোগফল কত ডিগ্রি?', '১৮০'], ['আমাকে ৪ দিয়ে ভাগ করলে ৭ হয়। আমি কোন সংখ্যা?', '২৮'], ['খাঁচায় কিছু মুরগি আর খরগোশ আছে। মোট মাথা ৫টি, মোট পা ১৪টি। খরগোশ কয়টি?', '২'], ['১ থেকে ১০ পর্যন্ত সব সংখ্যার যোগফল কত?', '৫৫'], ['একটি বর্গের এক বাহু ৬ সেমি। এর ক্ষেত্রফল কত বর্গসেমি?', '৩৬'], ['মিম রাফির চেয়ে ৩ বছরের বড়। দুজনের বয়সের যোগফল ১৯। মিমের বয়স কত?', '১১'], ['৫টি কলমের দাম ৫০ টাকা। ৮টি কলমের দাম কত টাকা?', '৮০'], ['একটি সংখ্যার দ্বিগুণ থেকে ৭ বাদ দিলে ১৩ থাকে। সংখ্যাটি কত?', '১০'], ['১০০ থেকে প্রতিবার ৭ করে বাদ দিলে কতবার বাদ দেওয়ার পর সংখ্যাটি প্রথম ২০-এর নিচে নামবে?', '১২'], ['এক বছরে কয়টি মাসে ৩১ দিন থাকে?', '৭'], ['৩ জন বন্ধু প্রত্যেকে প্রত্যেকের সাথে একবার করে হাত মেলাল। মোট কতবার হাত মেলানো হলো?', '৩'], ['১, ১, ২, ৩, ৫, ৮, … পরের সংখ্যাটি কত?', '১৩'], ['একটি আয়তক্ষেত্রের দৈর্ঘ্য ৮ সেমি, প্রস্থ ৫ সেমি। এর পরিসীমা কত সেমি?', '২৬'], ['আমি দুই অঙ্কের সবচেয়ে ছোট মৌলিক সংখ্যা। আমি কে?', '১১'], ['তানহা প্রতিদিন ১৫ মিনিট পড়ে। ৪ দিনে সে মোট কত মিনিট পড়ল?', '৬০']];
  const SHOP = [['av_cat', 'avatar', '🐱', 'বিড়াল', 10], ['av_tiger', 'avatar', '🐯', 'বাঘ', 15], ['av_owl', 'avatar', '🦉', 'পেঁচা', 20], ['av_rocket', 'avatar', '🚀', 'রকেট', 25], ['av_robot', 'avatar', '🤖', 'রোবট', 30], ['av_unicorn', 'avatar', '🦄', 'ইউনিকর্ন', 40], ['av_crown', 'avatar', '👑', 'মুকুট', 60],
    ['th_sky', 'theme', '🌤️', 'আকাশ', 20, '#2F8FC4'], ['th_forest', 'theme', '🌳', 'সবুজ বন', 25, '#2E8B57'], ['th_sunset', 'theme', '🌇', 'সূর্যাস্ত', 30, '#D9542F'], ['th_ocean', 'theme', '🌊', 'গভীর সমুদ্র', 40, '#1F4E8C']];
  window.applyTheme = key => { const t = SHOP.find(s => s[0] === key); if (t?.[5]) store.set('hdr', t[5]); else store.del('hdr'); };

  // Plays a list of {text, options, answer_index}; calls done(answers) at the end.
  function playQuestions(el, qs, title, done) {
    let i = 0; const answers = [];
    const step = () => {
      const q = qs[i];
      el.innerHTML = `<div class="mute small center">${esc(title)} · প্রশ্ন ${bn(i + 1)}/${bn(qs.length)}</div>${bar(i / qs.length, 'var(--teal)')}
        <div class="card"><h2>${esc(q.text)}</h2>${(q.options || []).map((o, j) => `<button class="qopt" data-o="${j}">${esc(o)}</button>`).join('')}</div>`;
      el.querySelectorAll('[data-o]').forEach(b => b.onclick = () => {
        const j = +b.dataset.o; answers.push(j);
        el.querySelectorAll('[data-o]').forEach(x => { x.disabled = true; if (+x.dataset.o === q.answer_index) x.classList.add('right'); });
        if (j !== q.answer_index) b.classList.add('wrong');
        setTimeout(() => { i++; i < qs.length ? step() : done(answers); }, 700);
      });
    };
    step();
  }

  // ---------- quizzes & leaderboard ----------
  SCREENS['s.quiz'] = { title: 'কুইজ ও লিডারবোর্ড', render: async (el) => {
    const st = await me();
    const [qz, lb] = await Promise.all([
      sel('quizzes', `select=id,title,class_level,questions,subject:subjects(name)&class_level=eq.${st.class_level}`),
      rpc('class_leaderboard', { p_class: st.class_level }).catch(() => []),
    ]);
    el.innerHTML = section('কুইজ') + (qz.map(q => `<div class="card tap" data-q="${q.id}" style="display:flex;gap:12px;align-items:center">${chip('trophy', 40)}<div><h3>${esc(q.title)}</h3><div class="mute small">${esc(q.subject?.name || '')} · ${bn((q.questions || []).length)}টি প্রশ্ন</div></div></div>`).join('') || empty('trophy', 'এই ক্লাসের জন্য এখনো কোনো কুইজ নেই।'))
      + section('লিডারবোর্ড') + `<div class="card">${(lb || []).slice(0, 20).map((r, i) => `<div class="row" style="${r.student_id === st.id ? 'font-weight:700;color:var(--teal-dark)' : ''}"><span>${bn(i + 1)}. ${esc(r.display_name)}${r.student_id === st.id ? ' (তুমি)' : ''}</span><b>${bn(r.stars)} স্টার</b></div>`).join('') || '<div class="mute">এখনো কেউ নেই</div>'}</div>`;
    el.querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
      const q = qz.find(x => x.id === b.dataset.q);
      playQuestions(el, q.questions, q.title, async answers => {
        el.innerHTML = skel(1);
        try {
          const r = await rpc('submit_quiz', { p_quiz_id: q.id, p_student_id: st.id, p_answers: answers });
          // wrong answers go to the mistake notebook (same as the APK)
          const wrong = q.questions.map((qq, i) => ({ qq, i })).filter(x => answers[x.i] !== x.qq.answer_index);
          if (wrong.length) upsert('quiz_mistakes', wrong.map(x => ({ coaching_id: S.me.coaching_id, student_id: st.id, q_key: `${q.id}:${x.i}`, subject: q.subject?.name || '', question: x.qq, box: 1, due: dhakaToday() })), 'student_id,q_key').catch(() => {});
          el.innerHTML = `<div class="card teal center">${empty('party', `${bn(r.correct)}/${bn(r.total)} সঠিক!${r.stars ? ` তুমি ${bn(r.stars)}টি স্টার পেয়েছ।` : ''}`)}</div><button class="btn" id="again">কুইজ তালিকা</button>`;
          el.querySelector('#again').onclick = () => render();
        } catch { el.innerHTML = empty('wifi_off', 'ফল জমা দেওয়া যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করো।'); }
      });
    });
  } };

  // ---------- daily puzzle ----------
  SCREENS['s.puzzle'] = { title: 'দৈনিক ধাঁধা', render: async (el) => {
    const st = await me();
    const day = Math.floor((Date.now() + 6 * 3600e3) / 864e5);
    const [q, a] = PUZZLES[day % PUZZLES.length];
    el.innerHTML = `<div class="card sun"><div class="mute small">আজকের ধাঁধা</div><h2>${esc(q)}</h2></div>
      <input id="pa" inputmode="numeric" placeholder="উত্তর লেখো"><button class="btn" id="pc">উত্তর মিলাও</button><div id="pr" class="center"></div>`;
    el.querySelector('#pc').onclick = async () => {
      const ok = ascii(el.querySelector('#pa').value).trim() === ascii(a);
      el.querySelector('#pr').innerHTML = ok ? '<b class="ok">সঠিক উত্তর! দারুণ!</b>' : '<b class="bad">হয়নি, আবার ভাবো।</b>';
      if (ok) { try { const r = await rpc('claim_puzzle_star', { p_student_id: st.id }); if (r === true || r === 'true') toast('একটি স্টার পেয়েছ!'); } catch {} }
    };
  } };

  // ---------- learning games (quick maths / times tables) ----------
  SCREENS['s.games'] = { title: 'শিক্ষামূলক খেলা', sub: 'দ্রুত গণিত, নামতা', render: async (el) => {
    const st = await me();
    const play = (kind) => {
      let n = 0, score = 0; const N = 10;
      const ask = () => {
        let a, b, op, ans;
        if (kind === 'tables') { a = 2 + Math.floor(Math.random() * 9); b = 1 + Math.floor(Math.random() * 10); op = '×'; ans = a * b; }
        else { op = ['+', '−', '×'][Math.floor(Math.random() * 3)]; a = 2 + Math.floor(Math.random() * (op === '×' ? 9 : 40)); b = 1 + Math.floor(Math.random() * (op === '×' ? 9 : 30)); if (op === '−' && b > a) [a, b] = [b, a]; ans = op === '+' ? a + b : op === '−' ? a - b : a * b; }
        el.innerHTML = `<div class="mute small center">${bn(n + 1)}/${bn(N)} · স্কোর ${bn(score)}</div>${bar(n / N, 'var(--teal)')}<div class="card center"><div style="font-size:44px;font-weight:800">${bn(a)} ${op} ${bn(b)} = ?</div></div><input id="ga" inputmode="numeric" autofocus><button class="btn" id="gok">উত্তর</button>`;
        const inp = el.querySelector('#ga'); inp.focus();
        const go2 = () => { if (+ascii(inp.value) === ans) score++; else toast(`উত্তর ছিল ${bn(ans)}`); n++; n < N ? ask() : finish(); };
        el.querySelector('#gok').onclick = go2; inp.onkeydown = e => { if (e.key === 'Enter') go2(); };
      };
      const finish = async () => {
        let star = false;
        if (score >= 7) { try { const r = await rpc('claim_daily_star', { p_student_id: st.id, p_kind: kind }); star = r === true || r === 'true'; } catch {} }
        el.innerHTML = `<div class="card teal">${empty('party', `${bn(score)}/${bn(N)} সঠিক!${star ? ' আজকের স্টার পেয়েছ!' : score >= 7 ? '' : ' ৭টি ঠিক হলে দিনে একটি স্টার।'}`)}</div><button class="btn" id="bk">আবার খেলো</button>`;
        el.querySelector('#bk').onclick = () => render();
      };
      ask();
    };
    el.innerHTML = grid2([`<button class="fun t-coral" data-g="math">${chip('numbers')}<b>দ্রুত গণিত</b><span class="small">যোগ, বিয়োগ, গুণ</span></button>`, `<button class="fun t-sky" data-g="tables">${chip('numbers')}<b>নামতা</b><span class="small">২ থেকে ১০</span></button>`]) + '<div class="mute small center">দিনে প্রতিটি খেলায় ৭/১০ পেলে একটি স্টার।</div>';
    el.querySelectorAll('[data-g]').forEach(b => b.onclick = () => play(b.dataset.g));
  } };

  // ---------- points shop ----------
  SCREENS['s.shop'] = { title: 'পয়েন্টের দোকান', sub: 'অবতার ও রং', render: async (el) => {
    const st = await me();
    const w = (await sel('student_rewards', `select=stars,owned,avatar,theme&student_id=eq.${st.id}`))[0] || { stars: 0, owned: [] };
    const owned = new Set(w.owned || []);
    el.innerHTML = `<div class="card sun center"><div class="mute small">তোমার স্টার</div><div class="big">${bn(w.stars)}</div></div>` +
      ['avatar', 'theme'].map(kind => section(kind === 'avatar' ? 'অবতার' : 'হেডারের রং') + grid2(SHOP.filter(s => s[1] === kind).map(([k, , e, n, c, col]) => {
        const on = w[kind] === k, has = owned.has(k);
        return `<button class="fun t-${on ? 'teal' : 'white'}" data-item="${k}" data-kind="${kind}" data-has="${has}"><span style="font-size:34px;${col ? `background:${col};border-radius:14px;width:44px;height:44px;display:flex;align-items:center;justify-content:center` : ''}">${e}</span><b>${n}</b><span class="small">${on ? 'ব্যবহার হচ্ছে' : has ? 'চাপলে ব্যবহার করো' : bn(c) + ' স্টার'}</span></button>`;
      }))).join('');
    el.querySelectorAll('[data-item]').forEach(b => b.onclick = async () => {
      const k = b.dataset.item, kind = b.dataset.kind;
      try {
        if (b.dataset.has !== 'true') {
          const item = SHOP.find(s => s[0] === k);
          if (!await confirmSheet('কিনবে?', `${item[2]} ${item[3]} — ${bn(item[4])} স্টার`, 'কিনে নাও')) return;
          await rpc('buy_item', { p_student_id: st.id, p_item: k });
        }
        const off = w[kind] === k;
        await rpc('equip_item', { p_student_id: st.id, p_slot: kind, p_item: off ? null : k });
        if (kind === 'theme') applyTheme(off ? null : k);
        toast('হয়ে গেছে!'); render();
      } catch (e) { toast(/not enough/.test(e.body || '') ? 'যথেষ্ট স্টার নেই' : 'হয়নি'); }
    });
  } };

  // ---------- weekly challenges ----------
  SCREENS['s.challenges'] = { title: 'সাপ্তাহিক চ্যালেঞ্জ', render: async (el) => {
    const st = await me();
    const list = await sel('weekly_challenges', `select=id,class_level,week_start,title,body,stars&week_start=gte.${daysAgo(28)}&or=(class_level.is.null,class_level.eq.${st.class_level})&order=week_start.desc,created_at.desc`);
    const mine = list.length ? Object.fromEntries((await sel('challenge_entries', `select=challenge_id,status&student_id=eq.${st.id}`)).map(x => [x.challenge_id, x.status])) : {};
    const L = { pending: ['স্যার দেখবেন', 'sun'], approved: ['স্টার পেয়েছ!', 'good'], rejected: ['আবার চেষ্টা করো', 'bad'] };
    el.innerHTML = list.map(c => `<div class="card"><div class="mute small">${fmtDate(c.week_start)} সপ্তাহ · ${bn(c.stars)} স্টার</div><h3>${esc(c.title)}</h3><div>${esc(c.body)}</div>
      <div style="margin-top:8px">${mine[c.id] ? pill(L[mine[c.id]][0], L[mine[c.id]][1]) : `<button class="pill teal" data-done="${c.id}">করেছি, জানাও</button>`}</div></div>`).join('') || empty('target', 'এই সপ্তাহে কোনো চ্যালেঞ্জ নেই।');
    el.querySelectorAll('[data-done]').forEach(b => b.onclick = () => sheet(`<h2>কী করেছ লেখো</h2><textarea id="cn" maxlength="500"></textarea><button class="btn" id="cs">পাঠাও</button><button class="link" data-close>বাতিল</button>`, (s, close) => {
      s.querySelector('#cs').onclick = async () => { try { await ins('challenge_entries', { challenge_id: b.dataset.done, student_id: st.id, coaching_id: S.me.coaching_id, note: s.querySelector('#cn').value.trim() }); close(); toast('পাঠানো হয়েছে'); render(); } catch { toast('হয়নি'); } };
    }));
  } };

  // ---------- quiz duel ----------
  SCREENS['s.duel'] = { title: 'কুইজ ডুয়েল', sub: 'বন্ধুকে চ্যালেঞ্জ করো', render: async (el) => {
    const st = await me();
    const duels = await sel('quiz_duels', `select=id,quiz_title,subject,questions,challenger_id,opponent_id,challenger_name,opponent_name,challenger_score,opponent_score,created_at&or=(challenger_id.eq.${st.id},opponent_id.eq.${st.id})&order=created_at.desc&limit=30`);
    el.innerHTML = `<button class="btn" id="nd">নতুন ডুয়েল</button>` + (duels.map(d => {
      const iAmC = d.challenger_id === st.id, mine = iAmC ? d.challenger_score : d.opponent_score, theirs = iAmC ? d.opponent_score : d.challenger_score;
      const other = iAmC ? d.opponent_name : d.challenger_name;
      return `<div class="card"><div class="mute small">${esc(d.subject)} · ${fmtDate(d.created_at)}</div><h3>${esc(d.quiz_title)} · বনাম ${esc(other)}</h3>
        <div>${mine == null ? `<button class="pill sun" data-play="${d.id}">এখন খেলো</button>` : `তুমি ${bn(mine)}${theirs == null ? ' · প্রতিপক্ষের অপেক্ষা' : ` · ${esc(other)} ${bn(theirs)} ${mine > theirs ? '— তুমি জিতেছ!' : mine < theirs ? '— পরের বার!' : '— সমান!'}`}`}</div></div>`;
    }).join('') || empty('swords', 'এখনো কোনো ডুয়েল নেই।'));
    el.querySelectorAll('[data-play]').forEach(b => b.onclick = () => {
      const d = duels.find(x => x.id === b.dataset.play);
      playQuestions(el, d.questions, d.quiz_title, async answers => {
        try { const r = await rpc('submit_duel', { p_duel_id: d.id, p_student_id: st.id, p_answers: answers }); toast(`${bn(r.score)}/${bn(r.total)} সঠিক`); } catch { toast('জমা হয়নি'); }
        render();
      });
    });
    el.querySelector('#nd').onclick = async () => {
      const [mates, qz] = await Promise.all([rpc('class_mates', { p_student_id: st.id }).catch(() => []), sel('quizzes', `select=id,title&class_level=eq.${st.class_level}`)]);
      if (!mates.length || !qz.length) return toast(!mates.length ? 'তোমার ক্লাসে আর কেউ নেই' : 'কোনো কুইজ নেই');
      sheet(`<h2>নতুন ডুয়েল</h2><label>বন্ধু</label><select id="dm">${mates.map(m => `<option value="${m.student_id}">${esc(m.display_name)}</option>`).join('')}</select>
        <label>কুইজ</label><select id="dq">${qz.map(q => `<option value="${q.id}">${esc(q.title)}</option>`).join('')}</select><button class="btn" id="dc">চ্যালেঞ্জ পাঠাও</button><button class="link" data-close>বাতিল</button>`, (s, close) => {
        s.querySelector('#dc').onclick = async () => { try { await rpc('create_duel', { p_student_id: st.id, p_opponent_id: s.querySelector('#dm').value, p_quiz_id: s.querySelector('#dq').value }); close(); render(); } catch { toast('হয়নি'); } };
      });
    };
  } };

  // ---------- flashcards ----------
  SCREENS.flash = { title: 'ফ্ল্যাশকার্ড', render: async (el, cls) => {
    const st = S.me.role === 'student' ? await me() : null;
    cls = +cls || st?.class_level || 6;
    const cards = await cached('flash' + cls, () => sel('flashcards', `select=id,subject,chapter_name,front,back&class_level=eq.${cls}&order=created_at`));
    const subjects = [...new Set(cards.map(c => c.subject))];
    let subj = subjects[0], i = 0, flip = false;
    const draw = () => {
      const list = cards.filter(c => c.subject === subj), c = list[i];
      el.innerHTML = (subjects.length > 1 ? chipRow(subjects.map(s => [s, s]), subj) : '') + (!c ? empty('flashcards', 'এই ক্লাসের জন্য এখনো কোনো ফ্ল্যাশকার্ড নেই।') :
        `<div class="mute small center">${bn(i + 1)}/${bn(list.length)}${c.chapter_name ? ' · ' + esc(c.chapter_name) : ''}</div>
        <div class="card ${flip ? 'teal' : 'sun'} tap center" id="fc" style="min-height:200px;display:flex;flex-direction:column;justify-content:center"><div class="mute small">${flip ? 'উত্তর' : 'প্রশ্ন'} · চাপলে উল্টাবে</div><h2>${esc(flip ? c.back : c.front)}</h2></div>
        <div class="grid2"><button class="btn ghost" id="fp" ${i ? '' : 'disabled'}>‹ আগের</button><button class="btn" id="fn" ${i < list.length - 1 ? '' : 'disabled'}>পরের ›</button></div>
        <button class="pill teal" data-speak="${esc(flip ? c.back : c.front)}">পড়ে শোনাও</button>`);
      el.querySelectorAll('[data-chip]').forEach(b => b.onclick = () => { subj = b.dataset.chip; i = 0; flip = false; draw(); });
      const fc = el.querySelector('#fc'); if (fc) fc.onclick = () => { flip = !flip; draw(); };
      const fp = el.querySelector('#fp'); if (fp) fp.onclick = () => { i--; flip = false; draw(); };
      const fn2 = el.querySelector('#fn'); if (fn2) fn2.onclick = () => { i++; flip = false; draw(); };
      window.bindSpeak?.(el);
    };
    draw();
  } };

  // ---------- doubt box (anonymous to classmates) ----------
  SCREENS['s.doubts'] = { title: 'প্রশ্ন বক্স', sub: 'নাম ছাড়াই প্রশ্ন করো', render: async (el) => {
    const st = await me();
    const ds = await sel('doubts', `select=id,class_level,subject,body,answer,created_at&class_level=eq.${st.class_level}&hidden=is.false&order=created_at.desc&limit=100`);
    el.innerHTML = `<div class="card"><h3>নতুন প্রশ্ন</h3><input id="ds" maxlength="40" placeholder="বিষয় (যেমন: গণিত)"><textarea id="db" maxlength="500" placeholder="কী বুঝতে পারছ না?"></textarea><button class="btn" id="dsend">পাঠাও</button><div class="mute small">ক্লাসের অন্যরা তোমার নাম দেখবে না।</div></div>` +
      ds.map(d => `<div class="card ${d.answer ? 'teal' : ''}"><div class="mute small">${esc(d.subject)} · ${fmtDate(d.created_at)}</div><h3>${esc(d.body)}</h3>${d.answer ? `<div style="margin-top:4px"><b>উত্তর:</b> ${esc(d.answer)}</div>` : '<div class="mute small">স্যারের উত্তরের অপেক্ষা</div>'}</div>`).join('');
    el.querySelector('#dsend').onclick = async () => {
      const subj = el.querySelector('#ds').value.trim(), body = el.querySelector('#db').value.trim();
      if (!subj || !body) return toast('বিষয় ও প্রশ্ন লেখো');
      try { await ins('doubts', { coaching_id: S.me.coaching_id, student_id: st.id, class_level: st.class_level, subject: subj, body }, 'select=id'); toast('পাঠানো হয়েছে'); render(); } catch { toast('হয়নি'); }
    };
  } };

  // ---------- goals ----------
  SCREENS['s.goals'] = { title: 'আমার লক্ষ্য', render: async (el) => {
    const st = await me();
    const [goals, marks] = await Promise.all([
      sel('student_goals', `select=id,subject,target_percent,achieved_at&student_id=eq.${st.id}&order=created_at`),
      sel('marks', `select=obtained,exam:exams(full_marks,subject:subjects(name))&student_id=eq.${st.id}`).catch(() => []),
    ]);
    const avg = {}; marks.filter(m => m.exam && m.obtained != null).forEach(m => { const s = m.exam.subject?.name || ''; (avg[s] ||= []).push(m.obtained / m.exam.full_marks * 100); });
    el.innerHTML = `<div class="card"><h3>নতুন লক্ষ্য</h3><div class="formrow"><input id="gs" maxlength="40" placeholder="বিষয়"><input id="gp" inputmode="numeric" placeholder="লক্ষ্য %" maxlength="3"></div><button class="btn" id="gadd">যোগ করো</button></div>` +
      goals.map(g => { const a = avg[g.subject] ? Math.round(avg[g.subject].reduce((x, y) => x + y, 0) / avg[g.subject].length) : null; return `<div class="card"><div style="display:flex;justify-content:space-between"><h3>${esc(g.subject)}</h3><span>${g.achieved_at ? pill('অর্জিত!', 'good') : pill('লক্ষ্য ' + bn(g.target_percent) + '%', 'teal')}</span></div>${a != null ? `<div class="mute small">এখন গড় ${bn(a)}%</div>${bar(a / g.target_percent)}` : '<div class="mute small">এখনো কোনো ফল নেই</div>'}<button class="pill" data-gdel="${g.id}" style="margin-top:6px">মুছো</button></div>`; }).join('');
    el.querySelector('#gadd').onclick = async () => {
      const s = el.querySelector('#gs').value.trim(), p = +ascii(el.querySelector('#gp').value);
      if (!s || !(p >= 1 && p <= 100)) return toast('বিষয় ও ১–১০০ লক্ষ্য দাও');
      try { await upsert('student_goals', { coaching_id: S.me.coaching_id, student_id: st.id, subject: s, target_percent: p }, 'student_id,subject'); render(); } catch { toast('হয়নি'); }
    };
    el.querySelectorAll('[data-gdel]').forEach(b => b.onclick = async () => { try { await del('student_goals', `id=eq.${b.dataset.gdel}`); render(); } catch { toast('হয়নি'); } });
  } };

  // ---------- mistake notebook (Leitner boxes) ----------
  SCREENS['s.mistakes'] = { title: 'ভুলের খাতা', sub: 'ভুল প্রশ্ন আবার অনুশীলন', render: async (el) => {
    const st = await me();
    const all = await sel('quiz_mistakes', `select=q_key,subject,question,box,due,wrong_count&student_id=eq.${st.id}&order=due`);
    const due = all.filter(m => m.due <= dhakaToday());
    el.innerHTML = `<div class="card sun"><div class="stats"><div><b>${bn(due.length)}</b><span class="mute small">আজ অনুশীলন</span></div><div><b>${bn(all.length)}</b><span class="mute small">মোট</span></div></div></div>` +
      (due.length ? '<button class="btn" id="mstart">অনুশীলন শুরু করো</button>' : empty('notebook', all.length ? 'আজকের অনুশীলন শেষ! পরে আবার এসো।' : 'কোনো ভুল জমা নেই। কুইজে ভুল হলে এখানে আসবে।'));
    const b = el.querySelector('#mstart');
    if (b) b.onclick = () => playQuestions(el, due.map(m => m.question), 'ভুলের খাতা', async answers => {
      await Promise.all(due.map((m, i) => {
        const ok = answers[i] === m.question.answer_index, f = `student_id=eq.${st.id}&q_key=eq.${enc(m.q_key)}`;
        if (ok && m.box >= 5) return del('quiz_mistakes', f).catch(() => {});
        const box = ok ? m.box + 1 : 1;
        return upd('quiz_mistakes', f + '&select=q_key', { box, due: addDays(dhakaToday(), LEITNER[box]), wrong_count: m.wrong_count + (ok ? 0 : 1) }).catch(() => {});
      }));
      toast('সংরক্ষিত'); render();
    });
  } };

  // ---------- syllabus ----------
  SCREENS.syllabus = { title: 'সিলেবাস ও বইয়ের পৃষ্ঠা', render: async (el, cls) => {
    const st = S.me.role === 'student' ? await me() : null;
    cls = +cls || st?.class_level || 6;
    const chs = await cached('chap' + cls, () => sel('chapters', `select=id,subject,number,title,pages,status,done_on&class_level=eq.${cls}&order=subject,number`));
    const by = {}; chs.forEach(c => (by[c.subject] ||= []).push(c));
    const ST = { todo: ['বাকি', ''], doing: ['চলছে', 'sun'], done: ['শেষ', 'good'] };
    el.innerHTML = Object.keys(by).map(s => { const d = by[s].filter(c => c.status === 'done').length; return `<div class="card"><div style="display:flex;justify-content:space-between"><h3>${esc(s)}</h3><span class="mute small">${bn(d)}/${bn(by[s].length)} শেষ</span></div>${bar(d / by[s].length)}
      ${by[s].map(c => `<div class="row"><span>${bn(c.number)}. ${esc(c.title)}${c.pages ? ` <span class="mute small">পৃ. ${esc(c.pages)}</span>` : ''}</span>${pill(ST[c.status][0], ST[c.status][1])}</div>`).join('')}</div>`; }).join('') || empty('book', 'এই ক্লাসের সিলেবাস এখনো যোগ করা হয়নি।');
  } };
})();

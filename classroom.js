'use strict';
// Phase 5 — rest of the teacher features. Mirrors ClassroomScreens.kt (doubts, signals), ProgressScreens.kt (risk,
// batch compare), FunScreens (challenges), ContentScreens (question bank, seat plan, syllabus edit), FeatureScreens (CCTV review).
(function () {
  const STU = 'id,class_level,roll,batch:batches(shift),profile:profiles!students_profile_id_fkey(full_name)';
  const nm = s => s?.profile?.full_name || s?.roll || 'শিক্ষার্থী';
  const pct = v => v == null ? '—' : bn(Math.round(+v)) + '%';
  const classChips = (cur, all = true) => chipRow([...(all ? [['', 'সব ক্লাস']] : []), ...CLASSES.map(c => [c, 'ক্লাস ' + bn(c)])], cur ?? '');

  // ---------- doubt box (teacher answers) ----------
  let dcls = null;
  SCREENS['t.doubts'] = { title: 'প্রশ্ন বক্স', sub: 'শিক্ষার্থীদের নামহীন প্রশ্ন', render: async (el) => {
    const ds = await sel('doubts', `select=id,class_level,subject,body,answer,created_at${dcls ? '&class_level=eq.' + dcls : ''}&hidden=is.false&order=created_at.desc&limit=100`);
    el.innerHTML = classChips(dcls) + (ds.map(d => `<div class="card ${d.answer ? 'teal' : 'sun'}"><div class="mute small">ক্লাস ${bn(d.class_level)} · ${esc(d.subject)} · ${fmtDate(d.created_at)}</div><h3>${esc(d.body)}</h3>
      ${d.answer ? `<div style="margin-top:4px"><b>উত্তর:</b> ${esc(d.answer)}</div>` : ''}<div class="chips" style="margin-top:8px"><button class="pill teal" data-ans="${d.id}">${d.answer ? 'উত্তর বদলান' : 'উত্তর দিন'}</button><button class="pill" data-hide="${d.id}">লুকান</button></div></div>`).join('') || empty('question', 'কোনো প্রশ্ন নেই।'));
    el.querySelectorAll('[data-chip]').forEach(b => b.onclick = () => { dcls = b.dataset.chip ? +b.dataset.chip : null; render(); });
    el.querySelectorAll('[data-ans]').forEach(b => b.onclick = () => { const d = ds.find(x => x.id === b.dataset.ans); sheet(`<h2>উত্তর</h2><div class="mute">${esc(d.body)}</div><textarea id="av" maxlength="1000">${esc(d.answer || '')}</textarea><button class="btn" id="as">পাঠান</button><button class="link" data-close>বাতিল</button>`, (s, close) => {
      s.querySelector('#as').onclick = async () => { const a = s.querySelector('#av').value.trim(); if (!a) return; try { await upd('doubts', `id=eq.${d.id}&select=id`, { answer: a, answered_at: new Date().toISOString() }); close(); render(); } catch { toast('হয়নি'); } };
    }); });
    el.querySelectorAll('[data-hide]').forEach(b => b.onclick = async () => { try { await upd('doubts', `id=eq.${b.dataset.hide}&select=id`, { hidden: true }); render(); } catch { toast('হয়নি'); } });
  } };

  // ---------- student signals: "বুঝিনি" + low mood ----------
  SCREENS['t.signals'] = { title: 'শিক্ষার্থীদের সংকেত', sub: '"বুঝিনি" ও মন খারাপ', render: async (el) => {
    const [conf, moods] = await Promise.all([
      sel('confusions', 'select=id,student_id,topic,created_at&resolved=is.false&order=created_at.desc&limit=100'),
      sel('mood_checkins', `select=student_id,day,mood,note&day=gte.${daysAgo(7)}`),
    ]);
    const ids = [...new Set([...conf.map(c => c.student_id), ...moods.map(m => m.student_id)])];
    const studs = ids.length ? Object.fromEntries((await sel('students', `select=${STU}&id=${inList(ids)}`)).map(s => [s.id, s])) : {};
    const low = {}; moods.filter(m => m.mood <= 2).forEach(m => (low[m.student_id] ||= []).push(m));
    el.innerHTML = section('"বুঝিনি"') + (conf.map(c => `<div class="card sun"><div class="mute small">${esc(nm(studs[c.student_id]))} · ক্লাস ${bn(studs[c.student_id]?.class_level || '')} · ${fmtDate(c.created_at)}</div><h3>${esc(c.topic)}</h3><button class="pill good" data-res="${c.id}" style="margin-top:6px">বুঝিয়ে দিয়েছি</button></div>`).join('') || empty('signal', 'কেউ "বুঝিনি" চাপেনি।'))
      + section('গত ৭ দিনে মন খারাপ') + (Object.entries(low).filter(([, l]) => l.length >= 2).map(([id, l]) => `<div class="card coral"><h3>${esc(nm(studs[id]))}</h3><div class="mute small">${bn(l.length)} দিন মন খারাপ জানিয়েছে${l.find(x => x.note) ? ' · "' + esc(l.find(x => x.note).note) + '"' : ''}</div></div>`).join('') || empty('sun', 'কোনো সতর্কতা নেই।'));
    el.querySelectorAll('[data-res]').forEach(b => b.onclick = async () => { try { await upd('confusions', `id=eq.${b.dataset.res}&select=id`, { resolved: true }); render(); } catch { toast('হয়নি'); } });
  } };

  // ---------- at-risk list ----------
  SCREENS['t.risk'] = { title: 'ঝুঁকিতে থাকা শিক্ষার্থী', sub: 'গত ১৪ দিন', render: async (el) => {
    const rows = await rpc('progress_risk', { p_days: 14 });
    if (!rows?.length) { el.innerHTML = empty('alert', 'এখন কেউ ঝুঁকিতে নেই।'); return; }
    const studs = Object.fromEntries((await sel('students', `select=${STU}&id=${inList(rows.map(r => r.student_id))}`)).map(s => [s.id, s]));
    el.innerHTML = rows.map(r => { const s = studs[r.student_id]; if (!s) return ''; const att = r.class_days ? r.present_days / r.class_days : 1;
      const why = [att < .75 && `উপস্থিতি ${bn(r.present_days)}/${bn(r.class_days)}`, r.recent_avg != null && r.prev_avg != null && r.recent_avg < r.prev_avg - .5 && `রেটিং কমেছে ${num((+r.prev_avg).toFixed(1))} → ${num((+r.recent_avg).toFixed(1))}`, r.homework_misses >= 2 && `হোমওয়ার্ক ${bn(r.homework_misses)} বার করেনি`, r.low_mood_days >= 2 && `${bn(r.low_mood_days)} দিন মন খারাপ`].filter(Boolean);
      return `<div class="card coral"><h3>${esc(nm(s))}</h3><div class="mute small">ক্লাস ${bn(s.class_level)} · রোল ${esc(bn(s.roll || '—'))}</div><div style="margin-top:4px">${why.map(w => pill(w, 'bad')).join(' ')}</div></div>`; }).join('');
  } };

  // ---------- batch compare ----------
  SCREENS['t.compare'] = { title: 'ব্যাচ তুলনা', sub: 'গত ৩০ দিন', render: async (el) => {
    const rows = await rpc('batch_stats', { p_days: 30 });
    el.innerHTML = (rows || []).map(r => `<div class="card"><h3>ক্লাস ${bn(r.class_level)} · ${shiftBn(r.shift) || '—'}</h3><div class="mute small">${bn(r.students)} জন</div>
      <div class="row"><span>উপস্থিতি</span><b>${pct(r.attendance_rate)}</b></div>${bar((+r.attendance_rate || 0) / 100)}
      <div class="row"><span>গড় রেটিং</span><b>${r.avg_rating == null ? '—' : num((+r.avg_rating).toFixed(1)) + '/১০'}</b></div>${bar((+r.avg_rating || 0) / 10, 'var(--teal)')}
      <div class="row"><span>পরীক্ষার গড়</span><b>${pct(r.avg_exam)}</b></div>${bar((+r.avg_exam || 0) / 100, 'var(--gold500)')}</div>`).join('') || empty('chart', 'তুলনার মতো তথ্য এখনো নেই।');
  } };

  // ---------- weekly challenges (post + review) ----------
  SCREENS['t.challenges'] = { title: 'সাপ্তাহিক চ্যালেঞ্জ', sub: 'দিন ও যাচাই করুন', render: async (el) => {
    const list = await sel('weekly_challenges', `select=id,class_level,week_start,title,body,stars&week_start=gte.${daysAgo(28)}&order=week_start.desc,created_at.desc`);
    const wk = () => { const d = new Date(dhakaToday() + 'T00:00:00'); d.setDate(d.getDate() - ((d.getDay() + 1) % 7)); return d.toLocaleDateString('en-CA'); }; // week starts Saturday
    el.innerHTML = `<div class="card"><h3>নতুন চ্যালেঞ্জ</h3><label>ক্লাস</label><select id="cc"><option value="">সব ক্লাস</option>${CLASSES.map(c => `<option value="${c}">ক্লাস ${bn(c)}</option>`).join('')}</select>
      <label>শিরোনাম</label><input id="ct" maxlength="120"><label>বিস্তারিত</label><textarea id="cb" maxlength="1000"></textarea><label>স্টার</label><input id="cs" inputmode="numeric" value="3"><button class="btn" id="cadd">চ্যালেঞ্জ দিন</button></div>` +
      list.map(c => `<div class="card tap" data-entries="${c.id}"><div class="mute small">${c.class_level ? 'ক্লাস ' + bn(c.class_level) : 'সব ক্লাস'} · ${fmtDate(c.week_start)} · ${bn(c.stars)} স্টার</div><h3>${esc(c.title)}</h3><div class="mute small">চাপলে জমা দেখুন ›</div></div>`).join('');
    el.querySelector('#cadd').onclick = async () => {
      const t = el.querySelector('#ct').value.trim(), s = +ascii(el.querySelector('#cs').value); if (!t || !(s >= 1 && s <= 10)) return toast('শিরোনাম ও ১–১০ স্টার দিন');
      try { await ins('weekly_challenges', { coaching_id: S.me.coaching_id, class_level: +el.querySelector('#cc').value || null, week_start: wk(), title: t, body: el.querySelector('#cb').value.trim(), stars: s, created_by: S.uid }, 'select=id'); render(); } catch { toast('হয়নি'); }
    };
    el.querySelectorAll('[data-entries]').forEach(b => b.onclick = async () => {
      const es = await sel('challenge_entries', `select=challenge_id,student_id,note,status,student:students(class_level,roll,profile:profiles!students_profile_id_fkey(full_name))&challenge_id=eq.${b.dataset.entries}&order=created_at`);
      sheet(`<h2>জমা</h2>${es.map(e => `<div class="row col"><b>${esc(nm(e.student))}</b><div class="mute">${esc(e.note)}</div>${e.status === 'pending' ? `<div class="chips"><button class="pill good" data-ap="${e.student_id}">অনুমোদন</button><button class="pill bad" data-rj="${e.student_id}">বাতিল</button></div>` : pill(e.status === 'approved' ? 'অনুমোদিত' : 'বাতিল', e.status === 'approved' ? 'good' : 'bad')}</div>`).join('') || '<div class="mute">এখনো কেউ জমা দেয়নি।</div>'}<button class="link" data-close>বন্ধ</button>`, (s, close) => {
        const go2 = (sid, ok) => rpc('review_challenge_entry', { p_challenge_id: b.dataset.entries, p_student_id: sid, p_approve: ok }).then(() => { toast(ok ? 'স্টার দেওয়া হয়েছে' : 'বাতিল'); close(); }).catch(() => toast('হয়নি'));
        s.querySelectorAll('[data-ap]').forEach(x => x.onclick = () => go2(x.dataset.ap, true));
        s.querySelectorAll('[data-rj]').forEach(x => x.onclick = () => go2(x.dataset.rj, false));
      });
    });
  } };

  // ---------- question bank ----------
  let qb = { cls: 6, subj: null };
  SCREENS['t.qbank'] = { title: 'প্রশ্ন ব্যাংক', render: async (el) => {
    const qs = await sel('question_bank', `select=id,class_level,subject,chapter_name,qtype,difficulty,body,options,answer&class_level=eq.${qb.cls}&order=created_at.desc&limit=300`);
    const subjects = [...new Set(qs.map(q => q.subject))];
    const shown = qs.filter(q => !qb.subj || q.subject === qb.subj);
    const T2 = { mcq: 'বহুনির্বাচনী', short: 'সংক্ষিপ্ত', creative: 'সৃজনশীল' }, D = { easy: 'সহজ', medium: 'মাঝারি', hard: 'কঠিন' };
    el.innerHTML = classChips(qb.cls, false) + (subjects.length > 1 ? chipRow([['', 'সব বিষয়'], ...subjects.map(s => [s, s])], qb.subj ?? '', 'data-subj') : '') +
      `<button class="btn" id="qadd">নতুন প্রশ্ন</button>` + (shown.map(q => `<div class="card"><div class="mute small">${esc(q.subject)}${q.chapter_name ? ' · ' + esc(q.chapter_name) : ''} · ${T2[q.qtype]} · ${D[q.difficulty]}</div><h3>${esc(q.body)}</h3>
        ${(q.options || []).length ? `<ol style="margin:4px 0 0 18px;padding:0">${q.options.map(o => `<li>${esc(o)}</li>`).join('')}</ol>` : ''}${q.answer ? `<div class="mute small">উত্তর: ${esc(q.answer)}</div>` : ''}<button class="pill" data-qdel="${q.id}" style="margin-top:6px">মুছুন</button></div>`).join('') || empty('archive', 'এই ক্লাসের ব্যাংকে কোনো প্রশ্ন নেই।'));
    el.querySelectorAll('[data-chip]').forEach(b => b.onclick = () => { qb = { cls: +b.dataset.chip, subj: null }; render(); });
    el.querySelectorAll('[data-subj]').forEach(b => b.onclick = () => { qb.subj = b.dataset.subj || null; render(); });
    el.querySelectorAll('[data-qdel]').forEach(b => b.onclick = async () => { if (!await confirmSheet('মুছবেন?', 'প্রশ্নটি ব্যাংক থেকে মুছে যাবে।', 'মুছুন', true)) return; try { await del('question_bank', `id=eq.${b.dataset.qdel}`); render(); } catch { toast('হয়নি'); } });
    el.querySelector('#qadd').onclick = () => sheet(`<h2>নতুন প্রশ্ন · ক্লাস ${bn(qb.cls)}</h2><label>বিষয়</label><input id="qs" maxlength="60" value="${esc(qb.subj || '')}"><label>অধ্যায়</label><input id="qc" maxlength="100">
      <div class="formrow"><div><label>ধরন</label><select id="qt"><option value="mcq">বহুনির্বাচনী</option><option value="short">সংক্ষিপ্ত</option><option value="creative">সৃজনশীল</option></select></div><div><label>কঠিনতা</label><select id="qd"><option value="easy">সহজ</option><option value="medium" selected>মাঝারি</option><option value="hard">কঠিন</option></select></div></div>
      <label>প্রশ্ন</label><textarea id="qb" maxlength="2000"></textarea><label>অপশন (বহুনির্বাচনী হলে, প্রতি লাইনে একটি)</label><textarea id="qo"></textarea><label>উত্তর</label><input id="qa" maxlength="500"><button class="btn" id="qsave">সংরক্ষণ</button><button class="link" data-close>বাতিল</button>`, (s, close) => {
      s.querySelector('#qsave').onclick = async () => {
        const v = id => s.querySelector(id).value.trim(); if (!v('#qs') || !v('#qb')) return toast('বিষয় ও প্রশ্ন দিন');
        try { await ins('question_bank', [{ coaching_id: S.me.coaching_id, class_level: qb.cls, subject: v('#qs'), chapter_name: v('#qc') || null, qtype: v('#qt'), difficulty: v('#qd'), body: v('#qb'), options: v('#qo') ? v('#qo').split('\n').map(x => x.trim()).filter(Boolean) : [], answer: v('#qa'), created_by: S.uid }], 'select=id'); close(); render(); }
        catch { toast('হয়নি'); }
      };
    });
  } };

  // ---------- seat plan (computed on the phone, like the APK) ----------
  SCREENS['t.seat'] = { title: 'সিট প্ল্যান', sub: 'পরীক্ষার আসন বিন্যাস', render: async (el) => {
    const studs = await T.allStudents();
    el.innerHTML = `<div class="card"><label>ক্লাস (একাধিক বাছুন — পাশাপাশি আলাদা ক্লাস বসবে)</label><div class="chips" id="cl">${CLASSES.map(c => `<button class="chip-btn" data-c="${c}">ক্লাস ${bn(c)}</button>`).join('')}</div>
      <div class="formrow"><div><label>প্রতি বেঞ্চে</label><input id="pb" inputmode="numeric" value="2"></div><div><label>রুমে বেঞ্চ</label><input id="rb" inputmode="numeric" value="15"></div></div><button class="btn" id="mk">সিট প্ল্যান তৈরি করুন</button></div><div id="out"></div>`;
    const on = new Set();
    el.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { const c = +b.dataset.c; on.has(c) ? on.delete(c) : on.add(c); b.classList.toggle('on', on.has(c)); });
    el.querySelector('#mk').onclick = () => {
      const per = Math.max(1, +ascii(el.querySelector('#pb').value) || 2), benches = Math.max(1, +ascii(el.querySelector('#rb').value) || 15);
      const groups = [...on].sort().map(c => T.sortRoster(studs.filter(s => s.class_level === c)));
      if (!groups.length) return toast('ক্লাস বাছুন');
      const order = []; let more = true, k = 0;
      while (more) { more = false; for (const g of groups) if (g[k]) { order.push(g[k]); more = true; } k++; } // interleave classes
      const cap = per * benches, rooms = [];
      for (let i = 0; i < order.length; i += cap) rooms.push(order.slice(i, i + cap));
      el.querySelector('#out').innerHTML = rooms.map((r, ri) => `<div class="card"><h3>রুম ${bn(ri + 1)}</h3><table class="t"><tr><th>বেঞ্চ</th><th>শিক্ষার্থী</th></tr>${Array.from({ length: Math.ceil(r.length / per) }, (_, bi) => `<tr><td>${bn(bi + 1)}</td><td>${r.slice(bi * per, bi * per + per).map(s => `${esc(nm(s))} <span class="mute small">(${bn(s.class_level)}/${esc(bn(s.roll || ''))})</span>`).join(' · ')}</td></tr>`).join('')}</table></div>`).join('') + '<button class="btn ghost" onclick="window.print()">প্রিন্ট করুন</button>';
    };
  } };

  // ---------- CCTV review ----------
  SCREENS['t.gate'] = { title: 'CCTV যাচাই', sub: 'অনিশ্চিত শনাক্তকরণ', render: async (el) => {
    const rs = await sel('attendance', 'select=id,student_id,date,check_in,confidence,student:students(roll,profile:profile_id(full_name))&needs_review=is.true&source=eq.cctv&order=date.desc');
    el.innerHTML = rs.map(r => `<div class="card"><h3>${esc(nm(r.student))}</h3><div class="mute small">${fmtDate(r.date)} · ${fmtTime(r.check_in)} · মিল ${bn(Math.round((+r.confidence || 0) * 100))}%</div><div class="chips" style="margin-top:8px"><button class="pill good" data-acc="${r.id}">ঠিক আছে</button><button class="pill bad" data-rej="${r.id}">ভুল</button></div></div>`).join('') || empty('cctv', 'যাচাইয়ের কিছু নেই।');
    const go2 = (id, ok) => rpc('resolve_gate_review', { p_attendance_id: id, p_accept: ok }).then(render).catch(() => toast('হয়নি'));
    el.querySelectorAll('[data-acc]').forEach(b => b.onclick = () => go2(b.dataset.acc, true));
    el.querySelectorAll('[data-rej]').forEach(b => b.onclick = () => go2(b.dataset.rej, false));
  } };
})();

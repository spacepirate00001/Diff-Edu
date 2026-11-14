'use strict';
// Phase 2–3 screens: marks entry, honorarium, leave, post notice (teacher) and fees, accounts, phone fixes (admin).
// Mirrors MarksScreens.kt, OfficeScreens.kt, FeeScreens.kt, AdminScreens.kt, PhoneRequestsScreen.
(function () {
  const LOG_BACK_DAYS = 7;
  const thisMonth = () => dhakaToday().slice(0, 7);
  const shiftMonth = (m, d) => { const [y, mo] = m.split('-').map(Number); const x = new Date(y, mo - 1 + d, 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`; };
  const monthLabel = m => `${MONTHS[+m.slice(5, 7) - 1]} ${bn(m.slice(0, 4))}`;
  const dayLabel = d => d === dhakaToday() ? 'আজ' : d === daysAgo(1) ? 'গতকাল' : `${fmtDate(d)} · ${DAYS[new Date(d + 'T00:00:00').getDay()]}`;
  const monthSwitch = (m, attr = 'data-month') => `<div style="display:flex;align-items:center;gap:8px"><button class="pill teal" ${attr}="${shiftMonth(m, -1)}">‹ আগের মাস</button><b style="flex:1;text-align:center">${monthLabel(m)}</b>${m < thisMonth() ? `<button class="pill teal" ${attr}="${shiftMonth(m, 1)}">পরের মাস ›</button>` : '<span style="width:88px"></span>'}</div>`;
  const staffList = () => cached('staff', () => sel('profiles', 'select=id,full_name,role&role=in.(admin,teacher)&order=full_name'));

  // ---------- marks entry ----------
  // New exam(s) for a class, one exam per picked subject (MarksRepository.createExams). Past dates are fine.
  const lastFriday = () => { const d = new Date(dhakaToday() + 'T00:00:00'); d.setDate(d.getDate() - ((d.getDay() + 2) % 7)); return d.toLocaleDateString('en-CA'); };
  async function newExams(cls, done, anyDate = false) {
    let subs = [];
    try {
      const seen = new Set();
      subs = (await sel('subjects', `select=name,name_bn&class_level=eq.${cls}&order=created_at`))
        .filter(r => (r.name || '').trim() && !seen.has(r.name) && seen.add(r.name)).map(r => ({ name: r.name, label: r.name_bn || r.name }));
    } catch { /* empty list below */ }
    sheet(`<h2>নতুন পরীক্ষা · ক্লাস ${bn(cls)}</h2>
      <label>তারিখ</label><input id="xd" type="date" value="${anyDate ? dhakaToday() : lastFriday()}" ${anyDate ? '' : `max="${dhakaToday()}"`}>
      <label>পরীক্ষার নাম</label><input id="xt" maxlength="80" value="সাপ্তাহিক মডেল টেস্ট">
      <label>প্রতি বিষয়ের পূর্ণমান</label><input id="xf" inputmode="numeric" value="২০">
      <label>বিষয় (একাধিক বাছা যায়, প্রতিটি আলাদা পরীক্ষা হবে)</label><div class="chips" id="xs">${subs.map((x, i) => `<button class="chip-btn" data-i="${i}">${esc(x.label)}</button>`).join('') || '<span class="mute small">এই ক্লাসের কোনো বিষয় পাওয়া যায়নি।</span>'}</div>
      <div class="err" id="xerr"></div><button class="btn" id="xgo">তৈরি করুন (০ টি)</button><button class="link" data-close>বাতিল</button>`, (s, close) => {
      const on = new Set(), go = s.querySelector('#xgo');
      const label = () => { go.textContent = `তৈরি করুন (${bn(on.size)} টি)`; };
      s.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const i = +b.dataset.i; on.has(i) ? on.delete(i) : on.add(i); b.classList.toggle('on', on.has(i)); label(); });
      go.onclick = async () => {
        const f = +ascii(s.querySelector('#xf').value), t = s.querySelector('#xt').value.trim(), d = s.querySelector('#xd').value || null;
        if (!on.size || !t || !(f >= 1 && f <= 1000)) return;
        go.disabled = true; go.textContent = 'তৈরি হচ্ছে…';
        try {
          for (const i of [...on].sort((a, b) => a - b)) {
            const name = subs[i].name;
            let sid = (await sel('subjects', `select=id&class_level=eq.${cls}&name=eq.${encodeURIComponent(name)}&limit=1`))[0]?.id;
            if (!sid) sid = (await ins('subjects', { coaching_id: S.me.coaching_id, class_level: cls, name }, 'select=id'))?.[0]?.id;
            await ins('exams', { coaching_id: S.me.coaching_id, title: t, subject_id: sid || null, class_level: cls, exam_date: d, full_marks: f, chapter_ids: [], created_by: S.uid }, 'select=id');
          }
          close(); done();
        } catch { s.querySelector('#xerr').textContent = 'পরীক্ষা তৈরি হয়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।'; go.disabled = false; label(); }
      };
    });
  }
  const M = { cls: 6, exam: null };
  SCREENS['t.marks'] = { title: 'নম্বর এন্ট্রি', sub: 'পরীক্ষা বেছে নম্বর লিখুন', render: async (el) => {
    const draw = async () => {
      const exams = await sel('exams', `select=id,title,exam_date,class_level,full_marks,subject:subjects(name,name_bn)&class_level=eq.${M.cls}&or=(exam_date.is.null,exam_date.gte.${daysAgo(400)})&order=exam_date.desc.nullsfirst&limit=300`);
      let h = chipRow(CLASSES.map(c => [c, 'ক্লাস ' + bn(c)]), M.cls) + '<button class="btn ghost" id="newEx">+ নতুন পরীক্ষা যোগ করুন (আগের তারিখও চলবে)</button>';
      if (!exams.length) { el.innerHTML = h + empty('numbers', 'এই ক্লাসের কোনো পরীক্ষা নেই। উপরে "নতুন পরীক্ষা যোগ করুন" চাপুন।'); bindTop(); return; }
      const ex = exams.find(e => e.id === M.exam) || null;
      h += exams.map(e => `<div class="card tap ${ex?.id === e.id ? 'teal' : ''}" data-exam="${e.id}"><div style="display:flex;justify-content:space-between;gap:8px"><div>${pill(e.subject?.name_bn || e.subject?.name || 'বিষয়', 'teal')}<h3 style="margin-top:4px">${esc(e.title)}</h3><div class="mute small">${e.exam_date ? fmtDate(e.exam_date) : 'তারিখ নেই'} · পূর্ণমান ${num(e.full_marks)}</div></div></div></div>`).join('');
      if (ex) {
        const [studs, marks] = await Promise.all([
          T.allStudents().then(l => T.sortRoster(l.filter(s => s.class_level === M.cls))),
          sel('marks', `select=student_id,obtained&exam_id=eq.${ex.id}`).then(r => Object.fromEntries(r.map(x => [x.student_id, x.obtained]))),
        ]);
        h += section(`${ex.title} · নম্বর`) + `<div class="card">${studs.map(s => `<div class="row"><div style="flex:1"><b>${esc(T.nameOf(s))}</b><div class="mute small">রোল ${esc(bn(s.roll || '—'))}</div></div>
          <input data-mark="${s.id}" inputmode="decimal" style="width:96px;margin:0;text-align:center" value="${marks[s.id] == null ? '' : marks[s.id]}" placeholder="—"></div>`).join('') || '<div class="mute">এই ক্লাসে কোনো শিক্ষার্থী নেই।</div>'}</div>
          <div class="err" id="merr"></div><button class="btn" id="msave">সংরক্ষণ করুন</button><div class="mute small center">ফাঁকা রাখলে "নম্বর দেওয়া হয়নি" ধরা হবে। খাতার ছবি থেকে নম্বর পড়া অ্যান্ড্রয়েড অ্যাপে আছে।</div>`;
      }
      el.innerHTML = h; bindTop();
      el.querySelectorAll('[data-exam]').forEach(b => b.onclick = () => { M.exam = M.exam === b.dataset.exam ? null : b.dataset.exam; draw(); });
      const sv = el.querySelector('#msave');
      if (sv) sv.onclick = async () => {
        const rows = []; let bad = false;
        el.querySelectorAll('[data-mark]').forEach(i => {
          const v = ascii(i.value).trim();
          if (v === '') rows.push({ coaching_id: S.me.coaching_id, exam_id: ex.id, student_id: i.dataset.mark, obtained: null });
          else { const n = +v; if (isNaN(n) || n < 0 || n > +ex.full_marks) { bad = true; i.style.borderColor = 'var(--bad)'; } else rows.push({ coaching_id: S.me.coaching_id, exam_id: ex.id, student_id: i.dataset.mark, obtained: n }); }
        });
        if (bad) { el.querySelector('#merr').textContent = `নম্বর ০ থেকে ${bn(ex.full_marks)}-এর মধ্যে হতে হবে।`; return; }
        sv.disabled = true; sv.textContent = 'সংরক্ষণ হচ্ছে…';
        try { const sent = await T.serial(() => writeOrQueue('POST', '/rest/v1/marks?on_conflict=exam_id,student_id', rows, 'return=minimal,resolution=merge-duplicates')); toast(sent ? 'নম্বর সংরক্ষিত হয়েছে ✓' : 'ইন্টারনেট নেই, ফোনে রাখা হয়েছে'); }
        catch { toast('সংরক্ষণ করা যায়নি'); }
        sv.disabled = false; sv.textContent = 'সংরক্ষণ করুন';
      };
    };
    const bindTop = () => {
      el.querySelectorAll('[data-chip]').forEach(b => b.onclick = () => { M.cls = +b.dataset.chip; M.exam = null; draw(); });
      const n = el.querySelector('#newEx'); if (n) n.onclick = () => newExams(M.cls, draw);
    };
    await draw();
  } };

  // ---------- exam planner (add exams so marks can be entered) ----------
  SCREENS['t.exams'] = { title: 'পরীক্ষার পরিকল্পনা', sub: 'আসন্ন পরীক্ষা', render: async (el) => {
    const [exams, subjects] = await Promise.all([
      sel('exams', `select=id,title,exam_date,class_level,full_marks,subject:subjects(name)&or=(exam_date.is.null,exam_date.gte.${daysAgo(30)})&order=exam_date.asc.nullslast&limit=100`),
      cached('subjects', () => sel('subjects', 'select=id,name,class_level&order=class_level,name')),
    ]);
    el.innerHTML = `<div class="card"><h3>নতুন পরীক্ষা</h3>
      <label>ক্লাস</label><select id="ec">${CLASSES.map(c => `<option value="${c}" ${c === 6 ? 'selected' : ''}>ক্লাস ${bn(c)}</option>`).join('')}</select>
      <label>বিষয়</label><select id="es"></select>
      <label>পরীক্ষার নাম</label><input id="et" maxlength="80" placeholder="যেমন: মাসিক পরীক্ষা">
      <div class="formrow"><div><label>তারিখ</label><input id="ed" type="date"></div><div><label>পূর্ণমান</label><input id="ef" inputmode="numeric" value="100"></div></div>
      <button class="btn" id="eadd">যোগ করুন</button></div>
      ${section('তালিকা')}
      ${exams.map(e => `<div class="card"><div class="mute small">ক্লাস ${bn(e.class_level)} · ${e.exam_date ? dayLabel(e.exam_date) : 'তারিখ নেই'}</div><h3>${esc(e.subject?.name ? e.subject.name + ' · ' : '')}${esc(e.title)}</h3><div class="mute small">পূর্ণমান ${num(e.full_marks)}</div></div>`).join('') || empty('calendar', 'কোনো আসন্ন পরীক্ষা নেই।')}`;
    const fill = () => { const c = +el.querySelector('#ec').value; el.querySelector('#es').innerHTML = '<option value="">—</option>' + subjects.filter(s => s.class_level === c).map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join(''); };
    el.querySelector('#ec').onchange = fill; fill();
    el.querySelector('#eadd').onclick = async () => {
      const t = el.querySelector('#et').value.trim(), f = +ascii(el.querySelector('#ef').value);
      if (!t || !(f > 0)) return toast('নাম ও পূর্ণমান দিন');
      try { await ins('exams', { coaching_id: S.me.coaching_id, title: t, class_level: +el.querySelector('#ec').value, subject_id: el.querySelector('#es').value || null, exam_date: el.querySelector('#ed').value || null, full_marks: f, created_by: S.uid }); toast('যোগ হয়েছে'); render(); }
      catch { toast('যোগ করা যায়নি'); }
    };
  } };

  // ---------- exam routine (ExamRoutineScreen.kt, exam-routine.sql) ----------
  // Everyone sees every class's exams by date; teachers add, admin edits / moves a day / deletes / sends a notice.
  const WEEKDAY = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
  const weekdayBn = d => WEEKDAY[new Date(d + 'T00:00:00').getDay()] || '';
  const examErr = e => {
    const m = e?.body || '';
    return /full marks below given marks/.test(m) ? 'দেওয়া নম্বরের চেয়ে পূর্ণমান কম রাখা যাবে না।'
      : /bad full marks/.test(m) ? 'পূর্ণমান ১ থেকে ১০০০ এর মধ্যে দিন।'
      : /title required/.test(m) ? 'পরীক্ষার নাম লিখুন।'
      : /admin only/.test(m) ? 'শুধু অ্যাডমিন পরীক্ষা বদলাতে পারেন।'
      : !e?.status ? 'ইন্টারনেট সংযোগ পাওয়া যায়নি।' : 'সংরক্ষণ হয়নি। আবার চেষ্টা করুন।';
  };
  const ER = { cls: null, past: false, open: null, confirm: null, msg: null, failed: false };
  SCREENS['t.routine'] = { title: 'পরীক্ষার রুটিন', sub: () => isAdmin() ? 'তারিখ, সময়, পূর্ণমান বদলান · সরান · মুছুন' : 'সব ক্লাসের পরীক্ষা', render: async (el) => {
    const admin = isAdmin();
    let exams = null, loadError = false;
    async function load() {
      try {
        const from = ER.past ? daysAgo(60) : dhakaToday();
        const rows = await sel('exams', `select=id,title,exam_date,class_level,full_marks,subject:subjects(name,name_bn)&exam_date=gte.${from}&order=exam_date,class_level&limit=600`);
        const marked = {};
        for (let i = 0; i < rows.length; i += 100) {
          const chunk = rows.slice(i, i + 100).map(r => r.id);
          (await sel('marks', `select=exam_id&obtained=not.is.null&exam_id=${inList(chunk)}&limit=10000`)).forEach(m => { marked[m.exam_id] = (marked[m.exam_id] || 0) + 1; });
        }
        exams = rows.map(r => ({ id: r.id, cls: r.class_level, subject: r.subject?.name_bn || r.subject?.name || '', title: r.title, date: r.exam_date, full: +r.full_marks, marked: marked[r.id] || 0 }));
        loadError = false;
      } catch { loadError = true; exams = null; }
    }
    async function run(job) {
      ER.msg = null;
      try { ER.msg = await job(); ER.failed = false; ER.open = null; ER.confirm = null; await load(); }
      catch (e) { ER.failed = true; ER.msg = examErr(e); }
      draw();
    }
    function sendNotice() {
      const list = (exams || []).filter(e => e.date >= dhakaToday());
      return run(async () => {
        if (!list.length) return 'সামনে কোনো পরীক্ষা নেই, নোটিশ পাঠানো হয়নি।';
        const byDate = {};
        list.forEach(e => (byDate[e.date] ||= []).push(e));
        const body = Object.keys(byDate).sort().map(d => {
          const groups = {};
          byDate[d].forEach(e => (groups[e.subject + '\u0000' + e.title] ||= []).push(e));
          return `${fmtDate(d)} (${weekdayBn(d)}): ` + Object.entries(groups).map(([k, rows]) => {
            const [subject, title] = k.split('\u0000'), time = /\((.+)\)/.exec(title)?.[1];
            return 'ক্লাস ' + [...new Set(rows.map(r => r.cls))].sort((a, b) => a - b).map(bn).join(', ') + ' ' + subject + (time ? ` (${time})` : '');
          }).join('; ');
        }).join('\n');
        await ins('notices', { coaching_id: S.me.coaching_id, title: 'পরীক্ষার রুটিন (হালনাগাদ)', body: body + '\n\nআদেশক্রমে - পরিচালক', audience: 'all', created_by: S.uid });
        return 'নোটিশ পাঠানো হয়েছে। সবাই হোমের নোটিশ বোর্ডে দেখবেন।';
      });
    }
    function card(e) {
      const open = admin && ER.open === e.id;
      let h = `<div class="card ${open ? 'teal' : ''} ${admin ? 'tap' : ''}" data-ex="${e.id}"><div style="display:flex;gap:8px;align-items:center"><div style="flex:1">
        <h3>ক্লাস ${bn(e.cls)} · ${esc(e.subject || 'বিষয় নেই')}</h3><div class="mute">${esc(e.title)}</div>
        <div class="mute small">পূর্ণমান ${num(e.full)}${e.marked ? ` · ${bn(e.marked)} জনের নম্বর দেওয়া` : ''}</div></div>${admin ? `<b style="color:var(--teal-dark)">${open ? 'বন্ধ' : 'বদলান'}</b>` : ''}</div>`;
      if (open) {
        const armed = ER.confirm === e.id;
        h += `<div class="stack" style="margin-top:8px" data-form="${e.id}">
          <label>তারিখ</label><input type="date" data-f="date" value="${e.date}">
          <label>নাম ও সময় (যেমন: মডেল টেস্ট ২০২৬ (বিকাল ৩:৪৫))</label><input data-f="title" maxlength="80" value="${esc(e.title)}">
          <label>বিষয়</label><input data-f="subject" maxlength="60" value="${esc(e.subject)}">
          <label>পূর্ণমান</label><input data-f="full" inputmode="decimal" maxlength="5" value="${num(e.full)}">
          <div class="grid2"><button class="btn ${armed ? 'coral' : 'ghost'}" data-del="${e.id}">${armed ? 'নিশ্চিত, মুছুন' : 'মুছুন'}</button><button class="btn" data-save="${e.id}">সংরক্ষণ</button></div>
          ${armed ? `<div class="err">${e.marked ? `সতর্কতা: এই পরীক্ষায় ${bn(e.marked)} জনের নম্বর দেওয়া আছে। মুছলে নম্বরগুলোও মুছে যাবে, আর ফেরত আনা যাবে না।` : 'আবার "নিশ্চিত, মুছুন" চাপলে পরীক্ষাটি মুছে যাবে।'}</div>` : ''}</div>`;
      }
      return h + '</div>';
    }
    function draw() {
      let h = chipRow([['', 'সব ক্লাস'], ...CLASSES.map(c => [c, 'ক্লাস ' + bn(c)])], ER.cls ?? '')
        + chipRow([['0', 'আজ থেকে সামনে'], ['1', 'গত ৬০ দিনসহ']], ER.past ? '1' : '0', 'data-past')
        + `<button class="btn ghost" id="addEx">+ নতুন পরীক্ষা যোগ করুন</button>`
        + (admin ? '<button class="btn ghost" id="sendN">হালনাগাদ রুটিন নোটিশে পাঠান</button>' : '')
        + (ER.msg ? `<div class="${ER.failed ? 'err' : 'center'}" style="${ER.failed ? '' : 'color:var(--teal-dark)'}">${esc(ER.msg)}</div>` : '');
      if (loadError) h += empty('wifi_off', 'রুটিন আনা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।');
      else if (!exams) h += skel(3);
      else {
        const shown = exams.filter(e => ER.cls == null || e.cls === ER.cls);
        if (!shown.length) h += empty('calendar', 'এই সময়ে কোনো পরীক্ষা নেই।');
        const byDate = {};
        shown.forEach(e => (byDate[e.date] ||= []).push(e));
        Object.keys(byDate).sort().forEach(d => {
          h += `<div style="display:flex;align-items:center;gap:8px;margin-top:8px"><div style="flex:1"><h3>${fmtDateY(d)}</h3><div class="mute small">${weekdayBn(d)} · ${bn(byDate[d].length)}টি পরীক্ষা</div></div>
            ${admin ? `<label class="pill teal" style="position:relative">দিন বদলান<input type="date" data-move="${d}" value="${d}" style="position:absolute;inset:0;opacity:0"></label>` : ''}</div>`
            + byDate[d].map(card).join('');
        });
      }
      const y = window.scrollY; el.innerHTML = h; window.scrollTo(0, y);
      el.querySelectorAll('[data-chip]').forEach(b => b.onclick = () => { ER.cls = b.dataset.chip === '' ? null : +b.dataset.chip; draw(); });
      el.querySelectorAll('[data-past]').forEach(b => b.onclick = async () => { const p = b.dataset.past === '1'; if (p === ER.past) return; ER.past = p; exams = null; draw(); await load(); draw(); });
      el.querySelector('#addEx').onclick = () => {
        if (ER.cls == null) { ER.failed = true; ER.msg = 'নতুন পরীক্ষা যোগ করতে উপরে একটি ক্লাস বাছুন।'; return draw(); }
        newExams(ER.cls, async () => { ER.msg = 'পরীক্ষা যোগ হয়েছে।'; ER.failed = false; await load(); draw(); }, true);
      };
      const sn = el.querySelector('#sendN'); if (sn) sn.onclick = sendNotice;
      if (!admin) return;
      el.querySelectorAll('[data-ex]').forEach(c => c.onclick = ev => {
        if (ev.target.closest('[data-form]')) return;
        ER.open = ER.open === c.dataset.ex ? null : c.dataset.ex; ER.confirm = null; draw();
      });
      el.querySelectorAll('[data-move]').forEach(i => i.onchange = () => {
        const from = i.dataset.move, to = i.value;
        if (!to || to === from) return;
        run(async () => {
          const n = await rpc('admin_move_exams', { p_from: from, p_to: to, p_classes: ER.cls == null ? null : [ER.cls] });
          return `${bn(+n || 0)}টি পরীক্ষা ${fmtDateY(to)} এ সরানো হয়েছে। সবাইকে জানাতে "হালনাগাদ রুটিন নোটিশে পাঠান" চাপুন।`;
        });
      });
      el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
        const e = exams.find(x => x.id === b.dataset.del);
        if (ER.confirm !== e.id) { ER.confirm = e.id; return draw(); }
        run(async () => { await rpc('admin_delete_exam', { p_id: e.id, p_force: e.marked > 0 }); return 'পরীক্ষা মুছে ফেলা হয়েছে।'; });
      });
      el.querySelectorAll('[data-save]').forEach(b => b.onclick = () => {
        const f = el.querySelector(`[data-form="${b.dataset.save}"]`), v = k => f.querySelector(`[data-f="${k}"]`).value;
        const full = parseFloat(ascii(v('full'))), title = v('title').trim();
        if (!title || isNaN(full)) { ER.failed = true; ER.msg = !title ? 'পরীক্ষার নাম লিখুন।' : 'পূর্ণমান ১ থেকে ১০০০ এর মধ্যে দিন।'; return draw(); }
        run(async () => { await rpc('admin_update_exam', { p_id: b.dataset.save, p_date: v('date'), p_title: title, p_full: full, p_subject: v('subject').trim() }); return 'সংরক্ষিত হয়েছে।'; });
      });
    }
    ER.msg = null; ER.open = null; ER.confirm = null;
    draw(); await load(); draw();
  } };

  // ---------- honorarium ----------
  let H = { month: null };
  SCREENS['t.honorarium'] = { title: () => isAdmin() ? 'শিক্ষকদের সম্মানী' : 'আমার সম্মানী', sub: () => isAdmin() ? 'ক্লাস × রেট' : 'নেওয়া ক্লাস থেকে হিসাব', render: async (el) => {
    H.month ||= thisMonth();
    const m = H.month, from = m + '-01', to = shiftMonth(m, 1) + '-01';
    if (isAdmin()) {
      const [staff, logs, rates, paid] = await Promise.all([
        staffList(), sel('class_logs', `select=teacher_id&day=gte.${from}&day=lt.${to}`),
        sel('pay_rates', 'select=teacher_id,per_class'), sel('honorarium_payments', `select=teacher_id,classes,amount&month=eq.${from}`),
      ]);
      const cnt = {}; logs.forEach(l => cnt[l.teacher_id] = (cnt[l.teacher_id] || 0) + 1);
      const rate = Object.fromEntries(rates.map(r => [r.teacher_id, +r.per_class]));
      const pay = Object.fromEntries(paid.map(p => [p.teacher_id, p]));
      const teachers = staff.filter(s => s.role === 'teacher');
      el.innerHTML = monthSwitch(m) + teachers.map(t => {
        const c = cnt[t.id] || 0, r = rate[t.id] || 0, p = pay[t.id];
        return `<div class="card"><div style="display:flex;justify-content:space-between;gap:8px"><div><h3>${esc(t.full_name)}</h3><div class="mute small">${bn(c)} ক্লাস × ${taka(r)}</div></div><div class="center"><b style="font-size:19px">${taka(c * r)}</b><div>${p ? pill('পরিশোধিত ' + taka(p.amount), 'good') : pill('বাকি', 'bad')}</div></div></div>
          <div class="chips" style="margin-top:8px"><button class="pill teal" data-rate="${t.id}" data-cur="${r}">রেট ঠিক করুন</button>${!p && c ? `<button class="pill sun" data-pay="${t.id}" data-c="${c}" data-a="${c * r}">পরিশোধ করা হয়েছে</button>` : ''}</div></div>`;
      }).join('') || empty('teacher', 'কোনো শিক্ষক অ্যাকাউন্ট নেই।');
      el.querySelectorAll('[data-rate]').forEach(b => b.onclick = () => sheet(`<h2>ক্লাস প্রতি রেট</h2><input id="rv" inputmode="numeric" value="${esc(b.dataset.cur)}"><button class="btn" id="rs">সংরক্ষণ</button><button class="link" data-close>বাতিল</button>`, (s, close) => {
        s.querySelector('#rs').onclick = async () => { const v = +ascii(s.querySelector('#rv').value); if (!(v >= 0)) return; try { await upsert('pay_rates', { teacher_id: b.dataset.rate, coaching_id: S.me.coaching_id, per_class: v, updated_at: new Date().toISOString() }, 'teacher_id'); close(); render(); } catch { toast('সংরক্ষণ হয়নি'); } };
      }));
      el.querySelectorAll('[data-pay]').forEach(b => b.onclick = async () => {
        if (!await confirmSheet('পরিশোধ', `${bn(b.dataset.c)} ক্লাস, ${taka(b.dataset.a)} পরিশোধ হিসেবে চিহ্নিত করবেন?`, 'হ্যাঁ, পরিশোধিত')) return;
        try { await upsert('honorarium_payments', { teacher_id: b.dataset.pay, month: from, coaching_id: S.me.coaching_id, classes: +b.dataset.c, amount: +b.dataset.a, paid_by: S.uid }, 'teacher_id,month'); render(); } catch { toast('সংরক্ষণ হয়নি'); }
      });
    } else {
      const [logs, rateRow, paidRow, recent] = await Promise.all([
        sel('class_logs', `select=id,day,label&teacher_id=eq.${S.uid}&day=gte.${from}&day=lt.${to}&order=day.desc,created_at.desc`),
        sel('pay_rates', `select=per_class&teacher_id=eq.${S.uid}`), sel('honorarium_payments', `select=classes,amount&teacher_id=eq.${S.uid}&month=eq.${from}`),
        sel('class_logs', `select=label&teacher_id=eq.${S.uid}&day=gte.${shiftMonth(thisMonth(), -1)}-01&order=day.desc&limit=40`),
      ]);
      const rate = +(rateRow[0]?.per_class || 0), paid = paidRow[0];
      const labels = [...new Set(recent.map(r => r.label))].slice(0, 6);
      let dayBack = 0;
      el.innerHTML = `<div class="card"><h3>ক্লাস নিলেন? যোগ করুন</h3>
          ${chipRow([...Array(LOG_BACK_DAYS + 1).keys()].map(i => [i, dayLabel(daysAgo(i))]), 0, 'data-day')}
          ${labels.length ? `<div style="margin-top:8px">${chipRow(labels.map(l => [l, l]), '', 'data-label')}</div>` : ''}
          <input id="lb" maxlength="60" placeholder="কোন ক্লাস (যেমন: ৫ম শ্রেণি · গণিত)" style="margin-top:8px">
          <button class="btn" id="ladd">ক্লাস যোগ করুন</button><div class="mute small">গত ${bn(LOG_BACK_DAYS)} দিনের ক্লাস পর্যন্ত যোগ করা যায়।</div></div>
        ${monthSwitch(m)}
        <div class="card ${paid ? 'good' : 'sun'}"><div class="stats"><div><b>${bn(logs.length)}</b><span class="mute small">ক্লাস</span></div><div><b>${taka(rate)}</b><span class="mute small">প্রতি ক্লাস</span></div><div><b>${taka(paid ? paid.amount : logs.length * rate)}</b><span class="mute small">${paid ? 'পরিশোধিত' : 'মোট'}</span></div></div></div>
        ${section('এই মাসের ক্লাস')}
        ${logs.map(l => `<div class="card" style="display:flex;align-items:center;gap:8px"><div style="flex:1"><h3>${esc(l.label)}</h3><div class="mute small">${dayLabel(l.day)}</div></div>${l.day >= daysAgo(LOG_BACK_DAYS) && !paid ? `<button class="pill coral" data-dellog="${l.id}">মুছুন</button>` : ''}</div>`).join('') || empty('calendar', 'এই মাসে কোনো ক্লাস যোগ করা হয়নি।')}`;
      el.querySelectorAll('[data-day]').forEach(b => b.onclick = () => { dayBack = +b.dataset.day; el.querySelectorAll('[data-day]').forEach(x => x.classList.toggle('on', x === b)); });
      el.querySelectorAll('[data-label]').forEach(b => b.onclick = () => { el.querySelector('#lb').value = b.dataset.label; });
      el.querySelector('#ladd').onclick = async () => {
        const label = el.querySelector('#lb').value.trim(); if (!label) return toast('কোন ক্লাস লিখুন');
        const day = daysAgo(dayBack);
        try {
          await T.serial(() => writeOrQueue('POST', '/rest/v1/class_logs?on_conflict=teacher_id,day,label', { coaching_id: S.me.coaching_id, teacher_id: S.uid, day, label }, 'return=minimal,resolution=ignore-duplicates'));
          H.month = day.slice(0, 7); toast('ক্লাস যোগ হয়েছে'); render();
        } catch (e) { toast(e.status === 403 || /row-level/.test(e.body || '') ? 'দিনে ৮টির বেশি ক্লাস যোগ করা যায় না।' : 'যোগ করা যায়নি'); }
      };
      el.querySelectorAll('[data-dellog]').forEach(b => b.onclick = async () => { try { await del('class_logs', `id=eq.${b.dataset.dellog}`); render(); } catch { toast('মুছা যায়নি'); } });
    }
    el.querySelectorAll('[data-month]').forEach(b => b.onclick = () => { H.month = b.dataset.month; render(); });
  } };

  // ---------- leave & substitute ----------
  const LEAVE_COLS = 'id,teacher_id,day_from,day_to,reason,status,substitute_id,admin_note,teacher:profiles!leave_requests_teacher_id_fkey(full_name),substitute:profiles!leave_requests_substitute_id_fkey(full_name)';
  const ST = { pending: ['অপেক্ষমাণ', 'sun'], approved: ['অনুমোদিত', 'good'], rejected: ['বাতিল', 'bad'] };
  const range = l => l.day_from === l.day_to ? fmtDate(l.day_from) : `${fmtDate(l.day_from)} – ${fmtDate(l.day_to)}`;
  SCREENS['t.leave'] = { title: 'ছুটি ও বদলি', sub: () => isAdmin() ? 'আবেদন অনুমোদন' : 'ছুটির আবেদন', render: async (el) => {
    if (isAdmin()) {
      const [pending, decided, staff] = await Promise.all([
        sel('leave_requests', `select=${LEAVE_COLS}&status=eq.pending&order=day_from&limit=200`),
        sel('leave_requests', `select=${LEAVE_COLS}&status=neq.pending&order=day_from.desc&limit=40`), staffList(),
      ]);
      const card = l => `<div class="card"><div style="display:flex;justify-content:space-between;gap:8px"><div><h3>${esc(l.teacher?.full_name || '')}</h3><div class="mute small">${range(l)}</div></div>${pill(ST[l.status][0], ST[l.status][1])}</div>
        <div style="margin-top:4px">${esc(l.reason)}</div>${l.substitute ? `<div class="mute small">বদলি: ${esc(l.substitute.full_name)}</div>` : ''}${l.admin_note ? `<div class="mute small">নোট: ${esc(l.admin_note)}</div>` : ''}
        ${l.status === 'pending' ? `<div class="chips" style="margin-top:8px"><button class="pill good" data-ok="${l.id}">অনুমোদন</button><button class="pill bad" data-no="${l.id}">বাতিল</button></div>` : ''}</div>`;
      el.innerHTML = section('অপেক্ষমাণ') + (pending.map(card).join('') || empty('palm', 'কোনো অপেক্ষমাণ আবেদন নেই।')) + section('সাম্প্রতিক') + decided.map(card).join('');
      const decide = (id, approve) => sheet(`<h2>${approve ? 'অনুমোদন' : 'বাতিল'}</h2>
        ${approve ? `<label>বদলি শিক্ষক (ঐচ্ছিক)</label><select id="sub"><option value="">—</option>${staff.filter(s => s.role === 'teacher').map(s => `<option value="${s.id}">${esc(s.full_name)}</option>`).join('')}</select>` : ''}
        <label>নোট</label><input id="nt" maxlength="200"><button class="btn ${approve ? '' : 'coral'}" id="dk">${approve ? 'অনুমোদন করুন' : 'বাতিল করুন'}</button><button class="link" data-close>পিছনে</button>`, (s, close) => {
        s.querySelector('#dk').onclick = async () => {
          try { await upd('leave_requests', `id=eq.${id}&select=id`, { status: approve ? 'approved' : 'rejected', substitute_id: approve ? (s.querySelector('#sub')?.value || null) : null, admin_note: s.querySelector('#nt').value.trim(), decided_at: new Date().toISOString() }); close(); toast('সংরক্ষিত'); render(); }
          catch { toast('সংরক্ষণ হয়নি'); }
        };
      });
      el.querySelectorAll('[data-ok]').forEach(b => b.onclick = () => decide(b.dataset.ok, true));
      el.querySelectorAll('[data-no]').forEach(b => b.onclick = () => decide(b.dataset.no, false));
    } else {
      const mine = await sel('leave_requests', `select=${LEAVE_COLS}&teacher_id=eq.${S.uid}&order=day_from.desc&limit=30`);
      el.innerHTML = `<div class="card"><h3>ছুটির আবেদন</h3><div class="formrow"><div><label>শুরু</label><input id="lf" type="date" value="${dhakaToday()}"></div><div><label>শেষ</label><input id="lt" type="date" value="${dhakaToday()}"></div></div>
        <label>কারণ</label><input id="lr" maxlength="200"><button class="btn" id="lsend">আবেদন পাঠান</button><div class="mute small">অনুমোদন হলে আপনার ক্লাসের অভিভাবকরা বদলি শিক্ষকের খবর পাবেন।</div></div>
        ${section('আমার আবেদন')}
        ${mine.map(l => `<div class="card"><div style="display:flex;justify-content:space-between;gap:8px"><div><h3>${range(l)}</h3><div class="mute small">${esc(l.reason)}</div></div>${pill(ST[l.status][0], ST[l.status][1])}</div>
          ${l.substitute ? `<div class="mute small">বদলি: ${esc(l.substitute.full_name)}</div>` : ''}${l.admin_note ? `<div class="mute small">অ্যাডমিন: ${esc(l.admin_note)}</div>` : ''}${l.status === 'pending' ? `<button class="pill coral" data-wd="${l.id}" style="margin-top:6px">আবেদন তুলে নিন</button>` : ''}</div>`).join('') || empty('palm', 'এখনো কোনো আবেদন নেই।')}`;
      el.querySelector('#lsend').onclick = async () => {
        const f = el.querySelector('#lf').value, t = el.querySelector('#lt').value, r = el.querySelector('#lr').value.trim();
        if (!f || !t || t < f) return toast('তারিখ ঠিক করুন'); if (!r) return toast('কারণ লিখুন');
        try { await ins('leave_requests', { coaching_id: S.me.coaching_id, teacher_id: S.uid, day_from: f, day_to: t, reason: r }, 'select=id'); toast('আবেদন পাঠানো হয়েছে'); render(); } catch { toast('পাঠানো যায়নি'); }
      };
      el.querySelectorAll('[data-wd]').forEach(b => b.onclick = async () => { try { await del('leave_requests', `id=eq.${b.dataset.wd}`); render(); } catch { toast('হয়নি'); } });
    }
  } };

  // ---------- post notice (PostNoticeScreen) ----------
  SCREENS['t.notice'] = { title: 'নোটিশ পাঠান', render: async (el) => {
    let aud = 'all';
    el.innerHTML = `<div class="card"><label>শিরোনাম</label><input id="nt" maxlength="120"><label>বিস্তারিত</label><textarea id="nb" maxlength="2000"></textarea></div>
      <div class="h2">প্রাপক</div><div class="chips">${[['all', 'সবাই'], ['guardians', 'অভিভাবক'], ['students', 'শিক্ষার্থী'], ['teachers', 'শিক্ষক']].map(([v, l]) => `<button class="chip-btn ${v === aud ? 'on' : ''}" data-aud="${v}">${l}</button>`).join('')}</div>
      <button class="btn" id="ns">নোটিশ পাঠান</button>
      <div class="card cream"><h3>লেখার নির্দেশনা</h3><div class="mute">ছোট, পরিষ্কার শিরোনাম দিন। তারিখ, সময় ও কী করতে হবে তা স্পষ্ট লিখুন।</div></div>`;
    el.querySelectorAll('[data-aud]').forEach(b => b.onclick = () => { aud = b.dataset.aud; el.querySelectorAll('[data-aud]').forEach(x => x.classList.toggle('on', x === b)); });
    el.querySelector('#ns').onclick = async () => {
      const t = el.querySelector('#nt').value.trim(), body = el.querySelector('#nb').value.trim();
      if (!t || !body) return toast('শিরোনাম ও বিস্তারিত লিখুন');
      try { await ins('notices', { coaching_id: S.me.coaching_id, title: t, body, audience: aud, created_by: S.uid }); el.innerHTML = `<div class="card teal">${empty('megaphone', 'নোটিশটি পাঠানো হয়েছে।')}</div><button class="btn" data-go="notices">সকল নোটিশ</button>`; el.querySelectorAll('[data-go]').forEach(bindGo); }
      catch { toast('পাঠানো যায়নি'); }
    };
  } };

  // ---------- admin: fees (FeeScreens) ----------
  let F = { month: null, cls: null, filter: 'due' };
  const FEE_COLS = 'id,student_id,month,amount,paid_amount,method,trx_id,student:students(class_level,roll,profile:profiles!students_profile_id_fkey(full_name))';
  SCREENS['a.fees'] = { title: 'ফি ব্যবস্থাপনা', sub: () => monthLabel(F.month || thisMonth()), render: async (el) => {
    F.month ||= thisMonth();
    const rows = (await sel('fees', `select=${FEE_COLS}&month=eq.${F.month}-01&limit=1000`)).sort((a, b) => (a.student?.class_level - b.student?.class_level) || (parseInt(ascii(a.student?.roll)) || 0) - (parseInt(ascii(b.student?.roll)) || 0));
    const total = rows.reduce((s, r) => s + +r.amount, 0), got = rows.reduce((s, r) => s + +r.paid_amount, 0);
    const classes = [...new Set(rows.map(r => r.student?.class_level))].sort((a, b) => a - b);
    const shown = rows.filter(r => (F.cls == null || r.student?.class_level === F.cls) && (F.filter === 'all' || (F.filter === 'due' ? +r.paid_amount < +r.amount : +r.paid_amount >= +r.amount)));
    el.innerHTML = monthSwitch(F.month) + `<div class="card"><div class="stats"><div><b>${taka(total)}</b><span class="mute small">মোট</span></div><div><b class="ok">${taka(got)}</b><span class="mute small">আদায়</span></div><div><b class="bad">${taka(total - got)}</b><span class="mute small">বাকি</span></div></div><div style="margin-top:8px">${bar(total ? got / total : 0)}</div></div>
      ${!rows.length ? `<div class="card sun"><h3>${monthLabel(F.month)}-এর ফি এখনো তৈরি হয়নি</h3>` : '<div class="card"><h3>নতুন শিক্ষার্থীর ফি যোগ</h3>'}
        <div class="formrow"><div><label>ক্লাস</label><select id="gc"><option value="">সব ক্লাস</option>${CLASSES.map(c => `<option value="${c}">ক্লাস ${bn(c)}</option>`).join('')}</select></div><div><label>টাকা</label><input id="ga" inputmode="numeric" placeholder="৮০০"></div></div>
        <button class="btn" id="gen">মাসের ফি তৈরি করুন</button><div class="mute small">যাদের এই মাসের ফি আগে থেকে আছে, তাদের বাদ রাখা হয়।</div></div>
      ${rows.length ? `${chipRow([['due', 'বাকি'], ['paid', 'পরিশোধিত'], ['all', 'সব']], F.filter, 'data-f')}${classes.length > 1 ? chipRow([['', 'সব ক্লাস'], ...classes.map(c => [c, 'ক্লাস ' + bn(c)])], F.cls ?? '', 'data-fc') : ''}` : ''}
      ${shown.map(r => { const due = +r.amount - +r.paid_amount; return `<div class="card" style="display:flex;align-items:center;gap:10px"><div style="flex:1"><h3>${esc(r.student?.profile?.full_name || r.student?.roll)}</h3><div class="mute small">ক্লাস ${bn(r.student?.class_level)} · রোল ${esc(bn(r.student?.roll || '—'))} · ${taka(r.amount)}${+r.paid_amount ? ' · জমা ' + taka(r.paid_amount) : ''}</div></div>
        ${due > 0 ? `<button class="pill sun" data-pay="${r.id}">জমা নিন</button>` : pill('পরিশোধিত', 'good')}</div>`; }).join('')}`;
    el.querySelectorAll('[data-month]').forEach(b => b.onclick = () => { F.month = b.dataset.month; setSub(monthLabel(F.month)); render(); });
    el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { F.filter = b.dataset.f; render(); });
    el.querySelectorAll('[data-fc]').forEach(b => b.onclick = () => { F.cls = b.dataset.fc === '' ? null : +b.dataset.fc; render(); });
    el.querySelector('#gen').onclick = async () => {
      const amt = +ascii(el.querySelector('#ga').value); if (!(amt > 0)) return toast('টাকার পরিমাণ দিন');
      const c = el.querySelector('#gc').value;
      try {
        const studs = await sel('students', `select=id&active=eq.true${c ? '&class_level=eq.' + c : ''}&limit=2000`);
        const have = new Set(rows.map(r => r.student_id));
        const fresh = studs.filter(s => !have.has(s.id)).map(s => ({ coaching_id: S.me.coaching_id, student_id: s.id, month: F.month + '-01', amount: amt }));
        if (!fresh.length) return toast('নতুন কারো ফি তৈরি করার নেই');
        await raw('POST', '/rest/v1/fees?on_conflict=student_id,month', fresh, { prefer: 'return=minimal,resolution=ignore-duplicates' });
        toast(`${bn(fresh.length)} জনের ফি তৈরি হয়েছে`); render();
      } catch { toast('তৈরি করা যায়নি'); }
    };
    el.querySelectorAll('[data-pay]').forEach(b => b.onclick = () => {
      const r = rows.find(x => x.id === b.dataset.pay), due = +r.amount - +r.paid_amount;
      sheet(`<h2>${esc(r.student?.profile?.full_name || '')} · জমা</h2><div class="mute">বাকি ${taka(due)}</div>
        <label>টাকা</label><input id="pa" inputmode="numeric" value="${due}">
        <div class="seg" style="margin:8px 0">${[['cash', 'নগদ'], ['bkash', 'bKash'], ['nagad', 'Nagad']].map(([v, l], i) => `<button data-m="${v}" class="${i ? '' : 'on'}"><b>${l}</b></button>`).join('')}</div>
        <label>ট্রানজেকশন আইডি (bKash/Nagad)</label><input id="pt" maxlength="40">
        <button class="btn" id="ps">জমা সংরক্ষণ</button><button class="link" data-close>বাতিল</button>`, (s, close) => {
        let method = 'cash';
        s.querySelectorAll('[data-m]').forEach(x => x.onclick = () => { method = x.dataset.m; s.querySelectorAll('[data-m]').forEach(y => y.classList.toggle('on', y === x)); });
        s.querySelector('#ps').onclick = async () => {
          const add = +ascii(s.querySelector('#pa').value); if (!(add > 0)) return toast('টাকা দিন');
          const paid = Math.min(+r.amount, +r.paid_amount + add);
          try {
            const done = await upd('fees', `id=eq.${r.id}&paid_amount=eq.${r.paid_amount}&select=id`, { paid_amount: paid, status: paid >= +r.amount ? 'paid' : 'partial', method, trx_id: s.querySelector('#pt').value.trim() || r.trx_id || null, paid_at: new Date().toISOString() });
            if (!done.length) { toast('এর মধ্যে অন্য কেউ বদলেছে, আবার দেখুন'); close(); render(); return; }
            close(); toast('জমা সংরক্ষিত ✓'); render();
          } catch { toast('সংরক্ষণ হয়নি'); }
        };
      });
    });
  } };

  // ---------- admin: accounts (admin-users function) ----------
  SCREENS['a.users'] = { title: 'অ্যাকাউন্ট ব্যবস্থাপনা', sub: 'নতুন অ্যাকাউন্ট ও পিন রিসেট', render: async (el) => {
    let role = 'student';
    const studs = await T.allStudents().catch(() => []);
    const draw = () => {
      el.innerHTML = `<div class="seg">${[['student', 'শিক্ষার্থী'], ['guardian', 'অভিভাবক'], ['teacher', 'শিক্ষক']].map(([v, l]) => `<button data-role="${v}" class="${v === role ? 'on' : ''}"><b>${l}</b></button>`).join('')}</div>
        <div class="card"><h3>নতুন ${role === 'student' ? 'শিক্ষার্থী' : role === 'guardian' ? 'অভিভাবক' : 'শিক্ষক'}</h3>
          <label>পূর্ণ নাম</label><input id="un" maxlength="80">
          <label>${role === 'student' ? 'লগইন আইডি (যেমন s43)' : 'মোবাইল নম্বর (এটাই লগইন আইডি)'}</label><input id="ul" maxlength="20" ${role === 'student' ? '' : 'inputmode="tel"'}>
          ${role === 'student' ? `<div class="formrow"><div><label>ক্লাস</label><select id="uc">${CLASSES.map(c => `<option value="${c}">ক্লাস ${bn(c)}</option>`).join('')}</select></div><div><label>রোল</label><input id="ur" maxlength="6"></div></div>
            <label>শিফট</label><select id="us">${SHIFTS.map(s => `<option value="${s.id}" ${s.id === 'afternoon' ? 'selected' : ''}>${s.bn}</option>`).join('')}</select>` : ''}
          ${role === 'guardian' ? `<label>সন্তান</label><select id="ug" multiple size="5">${T.sortRoster(studs).map(s => `<option value="${s.id}">${esc(T.nameOf(s))} · ক্লাস ${bn(s.class_level)} · রোল ${esc(bn(s.roll || ''))}</option>`).join('')}</select><label>সম্পর্ক</label><input id="urel" maxlength="20" placeholder="মা / বাবা">` : ''}
          <label>শুরুর পিন</label><input id="up" inputmode="numeric" maxlength="6" value="${role === 'teacher' ? '2580' : '1234'}">
          <div class="mute small">প্রথম লগইনে নিজের পিন ঠিক করতে বলা হবে।</div>
          <button class="btn" id="uadd">অ্যাকাউন্ট তৈরি করুন</button></div>
        <div class="card"><h3>পিন রিসেট</h3><label>লগইন আইডি</label><input id="rl" maxlength="20"><label>নতুন পিন</label><input id="rp" inputmode="numeric" maxlength="6" value="1234"><button class="btn sun" id="rset">পিন রিসেট করুন</button></div>`;
      el.querySelectorAll('[data-role]').forEach(b => b.onclick = () => { role = b.dataset.role; draw(); });
      el.querySelector('#uadd').onclick = async () => {
        const v = id => el.querySelector(id)?.value.trim();
        const login = ascii(v('#ul')).toLowerCase(), pin = ascii(v('#up'));
        if (!v('#un') || !login) return toast('নাম ও আইডি দিন');
        if (!/^\d{4,6}$/.test(pin)) return toast('পিন ৪–৬ সংখ্যার');
        if (role !== 'student' && !/^01\d{9}$/.test(login)) return toast('সঠিক মোবাইল নম্বর দিন');
        const body = { action: 'create', role, login_id: login, pin, full_name: v('#un') };
        if (role !== 'student') body.phone = login;
        if (role === 'student') Object.assign(body, { class_level: +v('#uc'), roll: ascii(v('#ur')) || null, shift: v('#us') });
        if (role === 'guardian') Object.assign(body, { student_ids: [...el.querySelector('#ug').selectedOptions].map(o => o.value), relation: v('#urel') || null });
        try { await fn('admin-users', body); toast('অ্যাকাউন্ট তৈরি হয়েছে ✓'); store.del('c.allstudents'); draw(); }
        catch (e) { toast(/exists|already|duplicate/i.test(e.body || '') ? 'এই আইডি আগে থেকেই আছে' : 'তৈরি করা যায়নি'); }
      };
      el.querySelector('#rset').onclick = async () => {
        const login = ascii(el.querySelector('#rl').value.trim()).toLowerCase(), pin = ascii(el.querySelector('#rp').value.trim());
        if (!login || !/^\d{4,6}$/.test(pin)) return toast('আইডি ও ৪–৬ সংখ্যার পিন দিন');
        try { await fn('admin-users', { action: 'reset_pin', login_id: login, pin }); toast('পিন রিসেট হয়েছে ✓'); } catch { toast('রিসেট করা যায়নি'); }
      };
    };
    draw();
  } };

  // ---------- admin: wrong-number reports ----------
  SCREENS['a.phones'] = { title: 'নম্বর সংশোধন', sub: 'শিক্ষকদের জানানো ভুল নম্বর', render: async (el) => {
    const rs = await sel('phone_change_requests', 'select=id,student_id,guardian_id,old_phone,new_phone,owner,note,student:students(roll,profile:profiles!students_profile_id_fkey(full_name)),guardian:profiles!phone_change_requests_guardian_id_fkey(full_name),reporter:profiles!phone_change_requests_reported_by_fkey(full_name)&status=eq.pending&order=created_at&limit=200');
    el.innerHTML = rs.map(r => `<div class="card"><h3>${esc(r.student?.profile?.full_name || r.student?.roll || '')}</h3><div class="mute small">অভিভাবক: ${esc(r.guardian?.full_name || '')} · জানিয়েছেন ${esc(r.reporter?.full_name || '')}</div>
      <div style="margin-top:4px">পুরনো: ${esc(bn(r.old_phone))}${r.new_phone ? ` → নতুন: <b>${esc(bn(r.new_phone))}</b>` : ''}</div>${r.note ? `<div class="mute small">${esc(r.note)}</div>` : ''}
      <div class="chips" style="margin-top:8px"><button class="pill good" data-ap="${r.id}" data-np="${esc(r.new_phone || '')}">নম্বর বদলান</button><button class="pill bad" data-rj="${r.id}">বাতিল</button></div></div>`).join('') || empty('phone', 'কোনো অপেক্ষমাণ অনুরোধ নেই।');
    el.querySelectorAll('[data-ap]').forEach(b => b.onclick = () => sheet(`<h2>নতুন নম্বর</h2><input id="np" inputmode="tel" value="${esc(b.dataset.np)}" maxlength="14"><button class="btn" id="ok">সংরক্ষণ</button><button class="link" data-close>বাতিল</button>`, (s, close) => {
      s.querySelector('#ok').onclick = async () => {
        const p = ascii(s.querySelector('#np').value).replace(/\D/g, ''); if (!/^01\d{9}$/.test(p)) return toast('সঠিক নম্বর দিন');
        try { await rpc('decide_phone_change', { p_id: b.dataset.ap, p_approve: true, p_phone: p }); close(); toast('বদলানো হয়েছে'); store.del('c.contacts'); render(); }
        catch (e) { toast(/stale/.test(e.body || '') ? 'নম্বরটি এর মধ্যে বদলে গেছে' : 'হয়নি'); }
      };
    }));
    el.querySelectorAll('[data-rj]').forEach(b => b.onclick = async () => { try { await rpc('decide_phone_change', { p_id: b.dataset.rj, p_approve: false, p_phone: null }); render(); } catch { toast('হয়নি'); } });
  } };
})();

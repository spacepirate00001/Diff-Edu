'use strict';
// Staff: profile editing (PeopleScreens.kt), batch/class change requests, the class routine (RoutineScreens.kt)
// and the staff notes card (StaffNotes.kt). Business rules live in SQL (people.sql, periods.sql, automation.sql).
(function () {
  const SH = id => SHIFTS.find(s => s.id === id);
  const batchShifts = () => cached('batchshifts', async () => Object.fromEntries((await sel('batches', 'select=id,shift')).map(b => [b.id, b.shift])));
  const PHONE_OK = p => !p || /^01\d{9}$/.test(p);
  const friendly = e => {
    const b = (e && (e.body || e.message)) || '';
    return /bad phone/.test(b) ? 'ফোন নম্বর ঠিক নেই (০১ দিয়ে শুরু, ১১ সংখ্যা)।' : /guardian needs a phone/.test(b) ? 'অভিভাবকের ফোন নম্বর লাগবে।'
      : /name required/.test(b) ? 'নাম লিখুন।' : /admin only/.test(b) ? 'শুধু অ্যাডমিন এটি করতে পারেন।' : /already decided/.test(b) ? 'এই অনুরোধের সিদ্ধান্ত আগেই হয়ে গেছে।' : 'সংরক্ষণ হয়নি। আবার চেষ্টা করুন।';
  };
  const shiftsBn = l => l.map(s => SH(s)?.bn || esc(s)).join(' + ');
  async function loadStudents() {
    const [shifts, rows] = await Promise.all([batchShifts(), sel('students', 'select=id,class_level,roll,active,batch_id,profile:profiles!students_profile_id_fkey(full_name,phone,login_id),extra:student_batches(batch_id),links:guardian_students(guardian:profiles!guardian_students_guardian_id_fkey(full_name))&order=class_level,roll&limit=3000')]);
    return rows.map(o => ({ id: o.id, name: o.profile?.full_name || o.roll || 'নাম নেই', phone: o.profile?.phone || '', class_level: o.class_level, roll: o.roll || '', active: o.active !== false, login: o.profile?.login_id || '',
      shifts: [...new Set([shifts[o.batch_id], ...(o.extra || []).map(x => shifts[x.batch_id])].filter(Boolean))], guardians: (o.links || []).map(l => l.guardian?.full_name).filter(Boolean) }));
  }
  async function loadPeople(role) {
    const rows = await sel('profiles', `select=id,role,full_name,phone,login_id&role=eq.${role}&order=full_name&limit=3000`);
    if (role !== 'guardian') return rows.map(r => ({ ...r, kids: [] }));
    const links = await sel('guardian_students', 'select=guardian_id,student_id&limit=5000');
    return rows.map(r => ({ ...r, kids: links.filter(l => l.guardian_id === r.id).map(l => l.student_id) }));
  }
  // Shift picker: one main batch + any extra batches (EditStudent / RequestStudentChange).
  const shiftPicker = (main, extra) => `<label>মূল ব্যাচ</label><div class="seg">${SHIFTS.map(s => `<button data-main="${s.id}" class="${s.id === main ? 'on' : ''}"><b>${s.bn}</b></button>`).join('')}</div>
    <label>আর যে ব্যাচেও পড়ে (একাধিক বাছা যায়)</label><div class="chips">${SHIFTS.filter(s => s.id !== main).map(s => `<button class="chip-btn ${extra.includes(s.id) ? 'on' : ''}" data-extra="${s.id}">${extra.includes(s.id) ? '✓ ' : ''}${s.bn}</button>`).join('')}</div>`;

  // ---------- profile editing (PeopleAdminScreen) ----------
  const P = { tab: 'student', q: '', cls: null };
  SCREENS['a.people'] = { title: 'প্রোফাইল সম্পাদনা', sub: 'শিক্ষার্থী, শিক্ষক ও অভিভাবক', render: async (el) => {
    const [list, pending] = await Promise.all([
      P.tab === 'student' ? loadStudents() : loadPeople(P.tab),
      sel('student_change_requests', 'select=id&status=eq.pending&limit=200').then(r => r.length).catch(() => 0),
    ]);
    let drawn = false;
    const draw = () => {
      const q = ascii(P.q).trim().toLowerCase();
      const hit = (...f) => !q || f.some(x => ascii(String(x || '')).toLowerCase().includes(q));
      let h = '<button class="btn" data-go="a.admit">নতুন ভর্তি</button>' + (pending ? `<div class="card sun tap" data-go="t.requests">শিক্ষকদের ${bn(pending)}টি পরিবর্তনের অনুরোধ অপেক্ষায় আছে →</div>` : '');
      h += chipRow([['student', 'শিক্ষার্থী'], ['teacher', 'শিক্ষক'], ['guardian', 'অভিভাবক']], P.tab, 'data-tab');
      h += `<input id="pq" maxlength="40" placeholder="নাম, রোল, আইডি বা ফোন দিয়ে খুঁজুন" value="${esc(P.q)}">`;
      if (P.tab === 'student') {
        const classes = [...new Set(list.map(s => s.class_level))].sort((a, b) => a - b);
        h += chipRow([['', 'সব'], ...classes.map(c => [c, 'ক্লাস ' + bn(c)])], P.cls ?? '', 'data-cls');
        const shown = list.filter(s => (P.cls == null || s.class_level === P.cls) && (hit(s.phone) || (window.Search ? Search.score(Search.prep(s.name, s.login, s.roll), P.q) >= 0 : hit(s.name, s.roll, s.login))));
        h += shown.map(s => `<div class="card tap" data-go="a.editstudent:${s.id}" style="display:flex;gap:10px;align-items:center">${avatar(s.name)}<div style="flex:1"><h3>${esc(s.name)}</h3>
          <div class="mute small">ক্লাস ${bn(s.class_level)}${s.roll ? ' · রোল ' + esc(bn(s.roll)) : ''}${s.shifts.length ? ' · ' + shiftsBn(s.shifts) : ''}</div></div>${!s.active ? pill('বন্ধ', 'coral') : s.shifts.length > 1 ? pill(bn(s.shifts.length) + ' ব্যাচ', 'teal') : ''}</div>`).join('') || empty('search', 'কাউকে পাওয়া যায়নি।');
      } else {
        const shown = list.filter(p => hit(p.full_name, p.login_id, p.phone));
        h += shown.map(p => `<div class="card tap" data-go="a.editperson:${p.id}" style="display:flex;gap:10px;align-items:center">${avatar(p.full_name)}<div style="flex:1"><h3>${esc(p.full_name || 'নাম নেই')}</h3>
          <div class="mute small">${[p.phone ? 'ফোন ' + esc(bn(p.phone)) : '', p.login_id ? 'আইডি ' + esc(p.login_id) : '', P.tab === 'guardian' ? 'সন্তান ' + bn(p.kids.length) + ' জন' : ''].filter(Boolean).join(' · ')}</div></div></div>`).join('') || empty('search', 'কাউকে পাওয়া যায়নি।');
      }
      el.innerHTML = h;
      if (drawn) el.querySelectorAll('[data-go]').forEach(bindGo); // the first draw is bound by render()
      drawn = true;
      el.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { P.tab = b.dataset.tab; P.cls = null; render(); });
      el.querySelectorAll('[data-cls]').forEach(b => b.onclick = () => { P.cls = b.dataset.cls === '' ? null : +b.dataset.cls; draw(); });
      const qi = el.querySelector('#pq'); qi.oninput = () => { P.q = qi.value.slice(0, 40); const pos = qi.selectionStart; draw(); const n = el.querySelector('#pq'); n.focus(); n.setSelectionRange(pos, pos); };
    };
    draw();
  } };

  // ---------- edit student (EditStudentScreen) ----------
  SCREENS['a.editstudent'] = { title: 'শিক্ষার্থী সম্পাদনা', render: async (el, id) => {
    const [s, links] = await Promise.all([
      loadStudents().then(all => all.find(x => x.id === id)),
      sel('guardian_students', `select=relation,guardian:profiles!guardian_students_guardian_id_fkey(id,full_name,phone)&student_id=eq.${id}`),
    ]);
    if (!s) { el.innerHTML = empty('search', 'কাউকে পাওয়া যায়নি।'); return; }
    // Linked guardians: name and phone can be changed here. oname/ophone are what the server holds now.
    const G = links.filter(l => l.guardian).map(l => ({ id: l.guardian.id, relation: l.relation || '',
      oname: l.guardian.full_name || '', ophone: l.guardian.phone || '', name: l.guardian.full_name || '', phone: l.guardian.phone || '' }));
    const f = { name: s.name, phone: s.phone, roll: s.roll, cls: s.class_level, main: s.shifts[0] || 'afternoon', extra: s.shifts.slice(1), active: s.active };
    const draw = () => {
      el.innerHTML = `<div class="card"><label>নাম</label><input id="en" maxlength="100" value="${esc(f.name)}">
        <label>শিক্ষার্থীর ফোন (না থাকলে খালি রাখুন)</label><input id="ep" inputmode="tel" maxlength="14" value="${esc(f.phone)}">
        <label>রোল</label><input id="er" maxlength="10" value="${esc(f.roll)}">
        <div class="mute small">লগইন আইডি: ${esc(s.login || '—')} (পিন বদলাতে: অ্যাকাউন্ট ব্যবস্থাপনা)</div></div>
        ${section('ক্লাস')}${chipRow(CLASSES.map(c => [c, bn(c)]), f.cls, 'data-cls')}
        ${section('ব্যাচ')}<div class="card">${shiftPicker(f.main, f.extra)}</div>
        <div class="card"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="ea" ${f.active ? 'checked' : ''} style="width:auto"> ভর্তি আছে</label><div class="mute small">বন্ধ করলে হাজিরা ও তালিকায় আর আসবে না; তথ্য মুছবে না।</div></div>
        ${section('অভিভাবক')}
        ${G.map((g, i) => `<div class="card">${g.relation ? `<div class="guard-rel">${esc(g.relation)}</div>` : ''}
          <label>নাম</label><input id="gn${i}" maxlength="100" value="${esc(g.name)}">
          <label>মোবাইল নম্বর</label><input id="gp${i}" inputmode="tel" maxlength="14" value="${esc(g.phone)}">
        </div>`).join('') || '<div class="card"><div class="mute">এখনো কোনো অভিভাবক যোগ হয়নি</div></div>'}
        <div class="err" id="ee"></div><button class="btn" id="es">সংরক্ষণ করুন</button>`;
      const keep = () => {
        f.name = el.querySelector('#en').value; f.phone = ascii(el.querySelector('#ep').value).replace(/\s/g, ''); f.roll = el.querySelector('#er').value; f.active = el.querySelector('#ea').checked;
        G.forEach((g, i) => { const n = el.querySelector('#gn' + i), p = el.querySelector('#gp' + i); if (n) g.name = n.value; if (p) g.phone = ascii(p.value).replace(/\s/g, ''); });
      };
      el.querySelectorAll('[data-cls]').forEach(b => b.onclick = () => { keep(); f.cls = +b.dataset.cls; draw(); });
      el.querySelectorAll('[data-main]').forEach(b => b.onclick = () => { keep(); f.main = b.dataset.main; f.extra = f.extra.filter(x => x !== f.main); draw(); });
      el.querySelectorAll('[data-extra]').forEach(b => b.onclick = () => { keep(); const x = b.dataset.extra; f.extra = f.extra.includes(x) ? f.extra.filter(y => y !== x) : f.extra.concat(x); draw(); });
      el.querySelector('#es').onclick = async () => {
        keep();
        const err = el.querySelector('#ee');
        const b = el.querySelector('#es');
        if (!f.name.trim()) return err.textContent = 'নাম লিখুন।';
        if (!PHONE_OK(f.phone)) return err.textContent = 'ফোন নম্বর ঠিক নেই (০১ দিয়ে শুরু, ১১ সংখ্যা)।';
        if (G.some(g => !g.name.trim())) return err.textContent = 'নাম লিখুন।';
        if (G.some(g => !/^01\d{9}$/.test(g.phone))) return err.textContent = 'ফোন নম্বর ঠিক নেই (০১ দিয়ে শুরু, ১১ সংখ্যা)।';
        b.disabled = true; b.textContent = 'সংরক্ষণ হচ্ছে…';
        try {
          await rpc('admin_update_student', { p_student: s.id, p_full_name: f.name.trim(), p_phone: f.phone, p_class_level: f.cls, p_roll: f.roll.trim(), p_shifts: [f.main, ...f.extra], p_active: f.active });
          // Then only the guardians whose name or phone changed, with the same profile save the person screen uses.
          const changed = G.filter(g => g.name !== g.oname || g.phone !== g.ophone);
          try {
            for (const g of changed) {
              await rpc('admin_update_profile', { p_id: g.id, p_full_name: g.name.trim(), p_phone: g.phone });
              g.oname = g.name; g.ophone = g.phone;
            }
          } catch {
            err.textContent = 'শিক্ষার্থীর তথ্য ঠিক আছে, কিন্তু অভিভাবকের তথ্য বদলানো যায়নি। আবার চেষ্টা করুন।';
            b.disabled = false; b.textContent = 'সংরক্ষণ করুন';
            return;
          }
          toast('সংরক্ষণ হয়ে গেছে।'); err.textContent = '';
        } catch (e) { err.textContent = friendly(e); }
        b.disabled = false; b.textContent = 'সংরক্ষণ করুন';
      };
    };
    draw();
  } };

  // ---------- edit teacher / guardian (EditPersonScreen) ----------
  SCREENS['a.editperson'] = { title: 'প্রোফাইল সম্পাদনা', render: async (el, id) => {
    const prof = (await sel('profiles', `select=id,role,full_name,phone,login_id&id=eq.${id}`))[0];
    if (!prof) { el.innerHTML = empty('search', 'কাউকে পাওয়া যায়নি।'); return; }
    const guardian = prof.role === 'guardian';
    setTitle(guardian ? 'অভিভাবক সম্পাদনা' : 'শিক্ষক সম্পাদনা');
    const studs = guardian ? await loadStudents() : [];
    const orig = guardian ? (await sel('guardian_students', `select=student_id&guardian_id=eq.${id}`)).map(r => r.student_id) : [];
    const f = { name: prof.full_name || '', phone: prof.phone || '', kids: orig.slice(), q: '' };
    const draw = () => {
      const q = ascii(f.q).trim().toLowerCase();
      const linked = studs.filter(s => f.kids.includes(s.id));
      const found = q ? (window.Search ? Search.filter(studs.filter(s => !f.kids.includes(s.id)), f.q, s => ({ name: s.name, login: s.login, roll: s.roll })) : studs.filter(s => !f.kids.includes(s.id) && ascii(`${s.name} ${s.roll} ${s.login}`).toLowerCase().includes(q))).slice(0, 20) : [];
      el.innerHTML = `<div class="card"><label>নাম</label><input id="pn" maxlength="100" value="${esc(f.name)}">
        <label>${guardian ? 'ফোন নম্বর' : 'ফোন নম্বর (ঐচ্ছিক)'}</label><input id="pp" inputmode="tel" maxlength="14" value="${esc(f.phone)}"></div>
        ${guardian ? `${section(`সন্তান (${bn(f.kids.length)} জন)`)}<input id="pk" maxlength="40" placeholder="শিক্ষার্থী খুঁজুন" value="${esc(f.q)}">
          <div class="stack">${[...linked, ...found].map(s => `<button class="pickrow ${f.kids.includes(s.id) ? 'on' : ''}" data-kid="${s.id}"><b>${f.kids.includes(s.id) ? '✓ ' : ''}${esc(s.name)}</b><span class="mute small">ক্লাস ${bn(s.class_level)} · রোল ${esc(bn(s.roll || '—'))}</span></button>`).join('')}</div>
          <div class="mute small">আরেকজনকে যোগ করতে উপরে নাম লিখে খুঁজুন। সরাতে নামের উপর চাপুন।</div>` : ''}
        <div class="err" id="pe"></div><button class="btn" id="ps">সংরক্ষণ করুন</button>`;
      const keep = () => { f.name = el.querySelector('#pn').value; f.phone = ascii(el.querySelector('#pp').value).replace(/\s/g, ''); };
      const pk = el.querySelector('#pk');
      if (pk) pk.oninput = () => { keep(); f.q = pk.value; const pos = pk.selectionStart; draw(); const n = el.querySelector('#pk'); n.focus(); n.setSelectionRange(pos, pos); };
      el.querySelectorAll('[data-kid]').forEach(b => b.onclick = () => { keep(); const k = b.dataset.kid; f.kids = f.kids.includes(k) ? f.kids.filter(x => x !== k) : f.kids.concat(k); draw(); });
      el.querySelector('#ps').onclick = async () => {
        keep();
        const err = el.querySelector('#pe');
        if (!f.name.trim()) return err.textContent = 'নাম লিখুন।';
        if (guardian && !f.phone) return err.textContent = 'অভিভাবকের ফোন নম্বর লাগবে।';
        if (!PHONE_OK(f.phone)) return err.textContent = 'ফোন নম্বর ঠিক নেই (০১ দিয়ে শুরু, ১১ সংখ্যা)।';
        const b = el.querySelector('#ps'); b.disabled = true; b.textContent = 'সংরক্ষণ হচ্ছে…';
        try {
          await rpc('admin_update_profile', { p_id: id, p_full_name: f.name.trim(), p_phone: f.phone });
          const changed = guardian && (f.kids.length !== orig.length || f.kids.some(k => !orig.includes(k)));
          if (changed) { await rpc('admin_set_guardian_links', { p_guardian: id, p_students: f.kids }); orig.splice(0, orig.length, ...f.kids); }
          toast('সংরক্ষণ হয়ে গেছে।'); err.textContent = '';
        } catch (e) { err.textContent = friendly(e); }
        b.disabled = false; b.textContent = 'সংরক্ষণ করুন';
      };
    };
    draw();
  } };

  // ---------- teacher: ask the admin to change a student's class / batch (RequestStudentChangeScreen) ----------
  SCREENS['t.reqchange'] = { title: 'পরিবর্তনের অনুরোধ', render: async (el, id) => {
    const s = (await T.allStudents()).find(x => x.id === id);
    if (!s) { el.innerHTML = empty('search', 'কাউকে পাওয়া যায়নি।'); return; }
    setSub(T.nameOf(s));
    const f = { cls: null, change: false, main: s.batch?.shift || 'afternoon', extra: [], note: '' };
    const draw = () => {
      el.innerHTML = `<div class="card"><h3>${esc(T.nameOf(s))}</h3><div class="mute small">ক্লাস ${bn(s.class_level)} · রোল ${esc(bn(s.roll || '—'))} · ${shiftBn(s.batch?.shift)}</div></div>
        ${section('নতুন ক্লাস')}${chipRow([['', 'ক্লাস বদল নেই'], ...CLASSES.map(c => [c, 'ক্লাস ' + bn(c)])], f.cls ?? '', 'data-cls')}
        <div class="seg"><button data-chg="0" class="${!f.change ? 'on' : ''}"><b>ব্যাচ বদল নেই</b></button><button data-chg="1" class="${f.change ? 'on' : ''}"><b>ব্যাচ বদলাতে চাই</b></button></div>
        ${f.change ? `<div class="card">${shiftPicker(f.main, f.extra)}</div>` : ''}
        <label>কারণ, বা অন্য কিছু বদলাতে লিখুন (যেমন নামের বানান)</label><textarea id="rn" maxlength="300">${esc(f.note)}</textarea>
        <div class="err" id="re"></div><button class="btn" id="rs">অ্যাডমিনকে পাঠান</button>`;
      const keep = () => { f.note = el.querySelector('#rn').value; };
      el.querySelectorAll('[data-cls]').forEach(b => b.onclick = () => { keep(); f.cls = b.dataset.cls === '' ? null : +b.dataset.cls; draw(); });
      el.querySelectorAll('[data-chg]').forEach(b => b.onclick = () => { keep(); f.change = b.dataset.chg === '1'; draw(); });
      el.querySelectorAll('[data-main]').forEach(b => b.onclick = () => { keep(); f.main = b.dataset.main; f.extra = f.extra.filter(x => x !== f.main); draw(); });
      el.querySelectorAll('[data-extra]').forEach(b => b.onclick = () => { keep(); const x = b.dataset.extra; f.extra = f.extra.includes(x) ? f.extra.filter(y => y !== x) : f.extra.concat(x); draw(); });
      el.querySelector('#rs').onclick = async () => {
        keep();
        if (f.cls == null && !f.change && !f.note.trim()) return;
        const b = el.querySelector('#rs'); b.disabled = true; b.textContent = 'পাঠানো হচ্ছে…';
        try {
          await ins('student_change_requests', { coaching_id: S.me.coaching_id, student_id: s.id, requested_by: S.uid, new_class_level: f.cls, new_shifts: f.change ? [f.main, ...f.extra] : null, note: f.note.trim() || null }, 'select=id');
          el.innerHTML = `<div class="card teal">অনুরোধ গেছে। অ্যাডমিন অনুমোদন দিলে বদলে যাবে। অবস্থা দেখুন "আমার অনুরোধ" পাতায়।</div><button class="btn" data-go="t.requests">আমার অনুরোধ</button>`;
          el.querySelectorAll('[data-go]').forEach(bindGo);
        } catch (e) {
          el.querySelector('#re').textContent = /row-level security/.test(e.body || '') ? 'আজ অনেক অনুরোধ গেছে। কাল আবার চেষ্টা করুন।' : friendly(e);
          b.disabled = false; b.textContent = 'অ্যাডমিনকে পাঠান';
        }
      };
    };
    draw();
  } };

  // ---------- change requests: admin decides, teacher sees own (StudentRequestsScreen) ----------
  const STATUS = { pending: ['অপেক্ষমাণ', 'sun'], approved: ['অনুমোদিত', 'teal'], rejected: ['বাতিল', 'coral'] };
  SCREENS['t.requests'] = { title: () => isAdmin() ? 'পরিবর্তনের অনুরোধ' : 'আমার অনুরোধ', sub: () => isAdmin() ? 'শিক্ষকরা যা বদলাতে বলেছেন' : 'শিক্ষার্থীর ব্যাচ / ক্লাস বদলের অনুরোধ', render: async (el) => {
    const [shifts, rows] = await Promise.all([batchShifts(), sel('student_change_requests', 'select=id,student_id,new_class_level,new_shifts,note,status,admin_note,created_at,student:students(class_level,roll,batch_id,extra:student_batches(batch_id),profile:profiles!students_profile_id_fkey(full_name)),requester:profiles!student_change_requests_requested_by_fkey(full_name)&order=status.desc,created_at.desc&limit=200')]);
    rows.sort((a, b) => (a.status !== 'pending') - (b.status !== 'pending'));
    const cur = r => [...new Set([shifts[r.student?.batch_id], ...(r.student?.extra || []).map(x => shifts[x.batch_id])].filter(Boolean))];
    el.innerHTML = (isAdmin() ? '' : '<div class="card cream mute">নতুন অনুরোধ পাঠাতে শিক্ষার্থীর প্রোফাইল খুলে "ব্যাচ / ক্লাস বদলের অনুরোধ" চাপুন।</div>') + (rows.map(r => {
      const [lbl, cls] = STATUS[r.status] || STATUS.pending;
      const onlyNote = r.new_class_level == null && !r.new_shifts;
      return `<div class="card"><div style="display:flex;justify-content:space-between;gap:8px"><div><h3>${esc(r.student?.profile?.full_name || r.student?.roll || '')}</h3><div class="mute small">${fmtDate(r.created_at)}${r.requester?.full_name ? ' · ' + esc(r.requester.full_name) : ''}</div></div>${pill(lbl, cls)}</div>
        ${r.new_class_level != null ? `<div>ক্লাস: ${bn(r.student?.class_level)} → ${bn(r.new_class_level)}</div>` : ''}
        ${r.new_shifts ? `<div>ব্যাচ: ${shiftsBn(cur(r))} → ${shiftsBn(r.new_shifts)}</div>` : ''}
        ${r.note ? `<div>কারণ: ${esc(r.note)}</div>` : ''}${r.admin_note ? `<div class="mute">অ্যাডমিনের মন্তব্য: ${esc(r.admin_note)}</div>` : ''}
        ${r.status === 'pending' ? (isAdmin() ? `${onlyNote ? '<div class="mute small">এই অনুরোধে শুধু মন্তব্য আছে: অনুমোদনের আগে "প্রোফাইল সম্পাদনা" থেকে নিজে বদলে নিন।</div>' : ''}<input data-note="${r.id}" maxlength="200" placeholder="মন্তব্য (ঐচ্ছিক)">
          <div class="chips"><button class="pill teal" data-ok="${esc(r.id)}">অনুমোদন ও বদলান</button><button class="pill coral" data-no="${esc(r.id)}">বাতিল</button></div>`
          : `<button class="pill" data-undo="${esc(r.id)}">অনুরোধ তুলে নিন</button>`) : ''}</div>`;
    }).join('') || empty('question', 'এখন কোনো অনুরোধ নেই। সব গোছানো।'));
    const decide = async (id, ok) => {
      const note = el.querySelector(`[data-note="${id}"]`)?.value || '';
      try { await rpc('decide_student_request', { p_id: id, p_approve: ok, p_note: note.trim() }); render(); } catch (e) { toast(friendly(e)); }
    };
    el.querySelectorAll('[data-ok]').forEach(b => b.onclick = () => decide(b.dataset.ok, true));
    el.querySelectorAll('[data-no]').forEach(b => b.onclick = () => decide(b.dataset.no, false));
    el.querySelectorAll('[data-undo]').forEach(b => b.onclick = async () => { try { await del('student_change_requests', `id=eq.${b.dataset.undo}&status=eq.pending`); render(); } catch { toast('পাঠানো যায়নি'); } });
  } };

  // ---------- class routine (RoutineEditorScreen) ----------
  let RT = { shift: 'afternoon', open: null };
  SCREENS['a.routine'] = { title: 'ক্লাস রুটিন', sub: 'কোন সময়ে কোন শিক্ষক কোন ক্লাস নেবেন', render: async (el) => {
    const [routine, staff, studs] = await Promise.all([
      sel('class_periods', 'select=shift,slot,class_level,teacher_id,teacher:teacher_id(full_name)&order=shift,slot,class_level'),
      cached('staff', () => sel('profiles', 'select=id,full_name,role&role=in.(admin,teacher)&order=full_name')),
      T.rosterOf(RT.shift),
    ]);
    const rows = routine.filter(p => p.shift === RT.shift);
    const levels = [...new Set([...studs.map(s => s.class_level), ...rows.filter(p => p.class_level != null).map(p => +p.class_level)])].sort((a, b) => a - b);
    const count = {}; rows.forEach(p => { if (p.teacher_id) { const n = p.teacher?.full_name || ''; count[n] = (count[n] || new Set()).add(p.slot); } });
    const cell = (slot, c) => { const r = rows.find(p => +p.slot === slot && (c == null ? p.class_level == null : +p.class_level === c));
      const key = slot + ':' + (c ?? 0);
      return `<button class="pickrow ${RT.open === key ? 'on' : ''}" data-cell="${key}" style="flex-direction:row;justify-content:space-between"><b>${c == null ? 'সব ক্লাস একসাথে' : 'ক্লাস ' + bn(c)}</b><span>${!r ? 'ক্লাস নেই' : esc(r.teacher?.full_name || 'শিক্ষক নেই')}</span></button>
        ${RT.open === key ? `<div class="chips" style="margin:4px 0 8px">${staff.map(t => `<button class="chip-btn ${r?.teacher_id === t.id ? 'on' : ''}" data-set="${key}|${t.id}">${r?.teacher_id === t.id ? '✓ ' : ''}${esc(t.full_name)}</button>`).join('')}<button class="chip-btn" data-set="${key}|none" style="background:var(--sun-soft)">ক্লাস নেই</button></div>` : ''}`; };
    let h = chipRow(SHIFTS.map(s => [s.id, `${s.bn} (${s.time})`]), RT.shift, 'data-sh') +
      '<div class="card cream mute">এই রুটিন অনুযায়ী হাজিরা ও রেটিংয়ের পাতা সাজে, শিক্ষকরা নম্বর দেওয়ার মনে করানো বার্তা পান, রিপোর্ট কার্ডেও শিক্ষকের নাম যায়। ঘরে চাপ দিয়ে শিক্ষক বদলান।</div>';
    const names = Object.keys(count);
    if (names.length) h += `<div class="card teal"><h3>দিনে কার কয়টি ক্লাস (${shiftBn(RT.shift)})</h3>${names.map(n => `<div>${esc(n)}: ${bn(count[n].size)}টি</div>`).join('')}</div>`;
    for (const slot of [1, 2, 3]) {
      const all = rows.some(p => +p.slot === slot && p.class_level == null);
      h += `<div class="card"><h3>${T.slotBn(slot)} ক্লাস</h3><div class="stack" style="margin-top:6px">${all ? cell(slot, null) + '<div class="mute small">এই সময়ে শিফটের সব ক্লাস একজন শিক্ষকের কাছে। আলাদা ক্লাসে ভাগ করতে উপরে "ক্লাস নেই" বেছে নিন।</div>'
        : levels.map(c => cell(slot, c)).join('') + (RT.open === slot + ':0' ? `<div class="chips">${staff.map(t => `<button class="chip-btn" data-set="${slot}:0|${t.id}">${esc(t.full_name)}</button>`).join('')}<button class="chip-btn" data-set="${slot}:0|none" style="background:var(--sun-soft)">ক্লাস নেই</button></div>`
          : `<button class="btn ghost" data-all="${slot}">এই সময়ে সব ক্লাস একসাথে একজনের কাছে</button>`)}</div></div>`;
    }
    h += '<div class="card"><h3>মনে রাখবেন</h3><div class="mute">• একই সময়ে একজন শিক্ষক একাধিক ক্লাস নিলে (যেমন ক্লাস ৭ আর ৮ একসাথে) দুই ঘরেই তাঁর নাম দিন।<br>• যে ক্লাসের এই সময়ে ক্লাস হয় না, সেখানে "ক্লাস নেই" দিন।<br>• বদল তখনই সবার অ্যাপে চলবে; আগের দিনের হাজিরা বা রেটিং বদলায় না।</div></div>';
    el.innerHTML = h;
    const save = async (slot, cls, teacher) => {
      try { await rpc('admin_set_period', { p_shift: RT.shift, p_slot: slot, p_class: cls, p_teacher: teacher }); RT.open = null; render(); }
      catch { toast('সংরক্ষণ হয়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।'); }
    };
    el.querySelectorAll('[data-sh]').forEach(b => b.onclick = () => { RT = { shift: b.dataset.sh, open: null }; render(); });
    el.querySelectorAll('[data-cell]').forEach(b => b.onclick = () => { RT.open = RT.open === b.dataset.cell ? null : b.dataset.cell; render(); });
    el.querySelectorAll('[data-set]').forEach(b => b.onclick = () => { const [key, t] = b.dataset.set.split('|'); const [slot, c] = key.split(':').map(Number); save(slot, c === 0 ? null : c, t === 'none' ? null : t); });
    el.querySelectorAll('[data-all]').forEach(b => b.onclick = () => { RT.open = b.dataset.all + ':0'; render(); });
  } };

  // ---------- staff notes card on the teacher home (StaffNotesCard) ----------
  T.staffNotesCard = async box => {
    const notes = (await sel('staff_notes', 'select=id,day,title,body,read_at,created_at&order=created_at.desc&limit=20').catch(() => [])).filter(n => !n.read_at).slice(0, 4);
    if (!notes.length || !box.isConnected) return;
    const marks = notes.some(n => (n.title || '').startsWith('নম্বর'));
    box.innerHTML = `<div class="card sun"><h3>নতুন বার্তা</h3>${notes.map(n => `<div style="margin-top:6px"><b>${esc(n.title)}</b><div class="mute small">${esc(n.body)}</div></div>`).join('')}
      <div class="chips" style="margin-top:8px"><button class="pill teal" id="sno">${marks ? 'নম্বর এন্ট্রি খুলুন' : 'রিপোর্ট কার্ড খুলুন'}</button><button class="pill" id="snr">দেখেছি</button></div></div>`;
    const read = () => rpc('mark_staff_notes_read', { p_ids: notes.map(n => n.id) }).catch(() => {});
    box.querySelector('#sno').onclick = async () => { await read(); go(marks ? 't.marks' : 'a.reports'); };
    box.querySelector('#snr').onclick = async () => { await read(); box.innerHTML = ''; };
  };
})();

'use strict';
// Guardian & student screens (PWA). Data is read-only here; RLS limits it to the user's own children.
(function () {
  let kid = store.get('kid');
  const sel1 = 'id,class_level,roll,batch:batches(shift),profile:profiles!students_profile_id_fkey(full_name)';
  const D = {
    kids: () => cached('kids', async () => {
      if (S.me.role === 'student') return sel('students', `select=${sel1}&profile_id=eq.${S.uid}`);
      const l = await sel('guardian_students', `select=student_id&guardian_id=eq.${S.uid}`);
      if (!l.length) return [];
      return sel('students', `select=${sel1}&id=${inList(l.map(x => x.student_id))}`);
    }),
    att: id => cached('att' + id, () => sel('attendance', `select=date,check_in,check_out&student_id=eq.${id}&order=date.desc&limit=60`)),
    marks: id => cached('marks' + id, () => sel('marks', `select=obtained,exam:exams(title,exam_date,full_marks,subject:subjects(name))&student_id=eq.${id}`)),
    fees: id => cached('fees' + id, () => sel('fees', `select=month,amount,paid_amount,status,method&student_id=eq.${id}&order=month.desc`)),
    notices: () => cached('notices', () => sel('notices', 'select=id,title,body,created_at&order=created_at.desc&limit=30')),
    notes: () => cached('notes', () => sel('guardian_notes', 'select=id,student_id,day,title,body,read_at&order=updated_at.desc&limit=40')),
    hw: cls => cached('hw' + cls, () => sel('homework', `select=title,due_date,subject:subjects(name)&class_level=eq.${cls}&order=due_date.asc`)),
  };
  const kidName = k => k?.profile?.full_name || 'শিক্ষার্থী';

  // Wraps a screen that needs the selected child: adds the child picker on top.
  function withKid(fn, { needKid = true } = {}) {
    return async (el) => {
      const kids = await D.kids();
      if (!kids.length && needKid) { el.innerHTML = '<div class="card">কোনো শিক্ষার্থী যুক্ত নেই। অফিসে যোগাযোগ করুন।</div>'; return; }
      if (!kid || !kids.find(k => k.id === kid)) kid = kids[0]?.id;
      const k = kids.find(x => x.id === kid);
      const picker = kids.length > 1 ? `<div class="kids">${kids.map(x => `<button data-id="${x.id}" class="${x.id === kid ? 'on' : ''}">${esc(kidName(x))}</button>`).join('')}</div>` : '';
      el.innerHTML = picker + await fn(k, kids);
      el.querySelectorAll('.kids button').forEach(b => b.onclick = () => { kid = b.dataset.id; store.set('kid', kid); render(); });
    };
  }

  Object.assign(SCREENS, {
    home: { title: 'ডিফ এডু', render: withKid(async (k) => {
      setTimeout(apkPopup, 1200);
      const [att, fees, notes] = await Promise.all([D.att(k.id), D.fees(k.id), D.notes().catch(() => [])]);
      const today = att.find(a => a.date === dhakaToday());
      const month = dhakaToday().slice(0, 7);
      const present = att.filter(a => a.date.startsWith(month) && a.check_in).length;
      const due = fees.filter(f => f.status !== 'paid').reduce((s, f) => s + (f.amount - f.paid_amount), 0);
      const unread = notes.filter(n => !n.read_at).length;
      return `<div class="card"><h2>${esc(kidName(k))}</h2><div class="mute">শ্রেণি ${bn(k.class_level)}${k.roll ? ' · রোল ' + esc(bn(k.roll)) : ''}</div>
        <div class="row"><span>আজ</span><span class="chip ${today?.check_in ? 'ok' : ''}">${today?.check_in ? 'উপস্থিত' : 'এখনো আসেনি'}</span></div>
        <div class="row"><span>এ মাসে উপস্থিতি</span><b>${bn(present)} দিন</b></div></div>
        ${due > 0 ? `<div class="card" data-go="fees"><h2>বকেয়া ফি</h2><div class="big bad">${taka(due)}</div><div class="mute">বিস্তারিত দেখুন ›</div></div>` : ''}
        ${unread ? `<div class="card" data-go="notes"><h2>নতুন বার্তা</h2><div class="big">${bn(unread)}টি</div></div>` : ''}
        ${apkBanner()}`;
    }) },
    att: { title: 'হাজিরা', render: withKid(async (k) => {
      const att = await D.att(k.id);
      const by = Object.fromEntries(att.map(a => [a.date, a]));
      const td = dhakaToday(); const y = +td.slice(0, 4), m = +td.slice(5, 7) - 1;
      const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
      let cells = ['র', 'সো', 'ম', 'বু', 'বৃ', 'শু', 'শ'].map(d => `<div class="mute">${d}</div>`).join('');
      for (let i = 0; i < first; i++) cells += '<div></div>';
      for (let d = 1; d <= days; d++) {
        const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const a = by[ds]; const fri = new Date(y, m, d).getDay() === 5;
        cells += `<div class="${a?.check_in ? 'p' : a || (ds < td && !fri) ? 'a' : 'h'}">${bn(d)}</div>`;
      }
      const time = t => t ? new Date(t).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dhaka' }) : '—';
      return `<div class="card"><h2>${MONTHS[m]}</h2><div class="cal">${cells}</div><p class="mute">সবুজ = উপস্থিত · লাল = অনুপস্থিত</p></div>
        <div class="card"><h2>সাম্প্রতিক</h2>${att.slice(0, 10).map(a => `<div class="row"><span>${fmtDate(a.date)}</span><span class="${a.check_in ? 'mute' : 'bad'}">${a.check_in ? time(a.check_in) + (a.check_out ? ' – ' + time(a.check_out) : '') : 'অনুপস্থিত'}</span></div>`).join('') || '<div class="mute">এখনো কিছু নেই</div>'}</div>`;
    }) },
    marks: { title: 'নম্বর', render: withKid(async (k) => {
      const ms = (await D.marks(k.id)).filter(m => m.exam && m.obtained != null);
      ms.sort((a, b) => (b.exam.exam_date || '').localeCompare(a.exam.exam_date || ''));
      return `<div class="card"><h2>পরীক্ষার ফল</h2>${ms.map(m => {
        const pct = Math.round(m.obtained / m.exam.full_marks * 100);
        return `<div class="row"><div>${esc(m.exam.subject?.name || '')} <span class="mute">${esc(m.exam.title)}${m.exam.exam_date ? ' · ' + fmtDate(m.exam.exam_date) : ''}</span></div><b class="${pct < 40 ? 'bad' : ''}">${bn(m.obtained)}/${bn(m.exam.full_marks)}</b></div>`;
      }).join('') || '<div class="mute">এখনো কোনো ফল নেই</div>'}</div>`;
    }) },
    fees: { title: 'ফি', render: withKid(async (k) => {
      const fs = await D.fees(k.id);
      return `<div class="card"><h2>মাসিক ফি</h2>${fs.map(f => {
        const d = new Date(f.month);
        const st = f.status === 'paid' ? '<span class="chip ok">পরিশোধিত</span>' : f.status === 'partial' ? `<span class="chip bad">বাকি ${taka(f.amount - f.paid_amount)}</span>` : '<span class="chip bad">বাকি</span>';
        return `<div class="row"><div>${MONTHS[d.getMonth()]} ${bn(d.getFullYear())}<div class="mute">${taka(f.amount)}</div></div>${st}</div>`;
      }).join('') || '<div class="mute">কোনো ফি নেই</div>'}</div>
      <p class="mute">ফি অফিসে জমা দিন; জমা হলে এখানে দেখা যাবে।</p>`;
    }) },
    more: { title: 'আরও', render: async (el) => {
      el.innerHTML = `<div class="card" data-go="notices"><h2>নোটিশ বোর্ড</h2><div class="mute">কোচিংয়ের নোটিশ ›</div></div>
        <div class="card" data-go="notes"><h2>বার্তা</h2><div class="mute">হাজিরা ও ক্লাস স্কোরের বার্তা ›</div></div>
        <div class="card" data-go="hw"><h2>বাড়ির কাজ</h2><div class="mute">শ্রেণি অনুযায়ী ›</div></div>
        <div class="card" data-go="pin"><h2>পিন বদলান</h2><div class="mute">নিজের পিন ঠিক করুন ›</div></div>
        <div class="card"><h2>${esc(S.me.full_name)}</h2><div class="mute">লগইন আইডি: ${esc(S.me.login_id)}</div></div>`;
    } },
    notices: { title: 'নোটিশ', tab: 'more', back: 'more', render: async (el) => {
      const ns = await D.notices();
      el.innerHTML = ns.map(n => `<div class="card"><h2>${esc(n.title)}</h2><div class="mute">${fmtDate(n.created_at)}</div><p style="white-space:pre-wrap">${esc(n.body)}</p></div>`).join('') || '<div class="card mute">কোনো নোটিশ নেই</div>';
    } },
    notes: { title: 'বার্তা', tab: 'more', back: 'more', render: withKid(async (k, kids) => {
      const ns = await D.notes();
      const unread = ns.filter(n => !n.read_at).map(n => n.id);
      if (unread.length && !offlineFlag) rpc('mark_notes_read', { p_ids: unread }).catch(() => {});
      const name = id => kidName(kids.find(x => x.id === id));
      return ns.map(n => `<div class="card"><h2>${esc(n.title)} ${n.read_at ? '' : '<span class="chip bad">নতুন</span>'}</h2><div class="mute">${esc(name(n.student_id))} · ${fmtDate(n.day)}</div><p>${esc(n.body)}</p></div>`).join('') || '<div class="card mute">কোনো বার্তা নেই</div>';
    }, { needKid: false }) },
    hw: { title: 'বাড়ির কাজ', tab: 'more', back: 'more', render: withKid(async (k) => {
      const hs = await D.hw(k.class_level);
      return `<div class="card"><h2>শ্রেণি ${bn(k.class_level)}</h2>${hs.map(h => `<div class="row"><div>${esc(h.title)}<div class="mute">${esc(h.subject?.name || '')}</div></div><span class="mute">${h.due_date ? fmtDate(h.due_date) : ''}</span></div>`).join('') || '<div class="mute">কোনো কাজ নেই</div>'}</div>`;
    }) },
  });

  setTabs([
    { id: 'home', label: 'হোম' }, { id: 'att', label: 'হাজিরা' }, { id: 'marks', label: 'নম্বর' },
    { id: 'fees', label: 'ফি' }, { id: 'more', label: 'আরও' },
  ]);
})();

'use strict';
// Guardian ↔ teacher chat and meeting slots (both sides). Mirrors CommsScreens.kt + OfficeScreens.kt (meetings).
(function () {
  const staff = () => S.me.role === 'teacher' || S.me.role === 'admin';
  const STU = 'id,class_level,roll,profile:profiles!students_profile_id_fkey(full_name)';
  const nm = s => s?.profile?.full_name || 'শিক্ষার্থী';

  // ---------- chat ----------
  SCREENS.chats = { title: 'অভিভাবকদের বার্তা', sub: 'শিক্ষার্থী বেছে কথা বলুন', render: async (el) => {
    const studs = await cached('chatstuds', () => sel('students', `select=${STU}&active=is.true&order=class_level,roll`));
    let q = '';
    const draw = () => {
      const list = studs.filter(s => !q || nm(s).includes(q) || bn(s.roll || '').includes(bn(q)));
      el.innerHTML = `<input id="cq" placeholder="নাম বা রোল খুঁজুন" value="${esc(q)}">` + list.slice(0, 80).map(s => `<div class="card tap" data-go="chat:${s.id}" style="display:flex;gap:12px;align-items:center">${avatar(nm(s))}<div><h3>${esc(nm(s))}</h3><div class="mute small">ক্লাস ${bn(s.class_level)} · রোল ${esc(bn(s.roll || '—'))}</div></div></div>`).join('');
      el.querySelectorAll('[data-go]').forEach(bindGo);
      const i = el.querySelector('#cq'); i.oninput = () => { q = i.value.trim(); const pos = i.selectionStart; draw(); const j = el.querySelector('#cq'); j.focus(); j.setSelectionRange(pos, pos); };
    };
    draw();
  } };
  SCREENS.chat = { title: 'শিক্ষকের সাথে যোগাযোগ', render: async (el, studentId) => {
    const s = (await sel('students', `select=${STU}&id=eq.${studentId}`))[0];
    setTitle(staff() ? nm(s) : 'শিক্ষকের সাথে যোগাযোগ'); setSub(staff() ? `ক্লাস ${bn(s?.class_level)} · অভিভাবকের সাথে বার্তা` : nm(s));
    const draw = async () => {
      const ms = await sel('messages', `select=id,body,created_at,sender_id,sender:profiles(full_name,role)&thread_student_id=eq.${studentId}&order=created_at`);
      el.innerHTML = `<div class="list-gap" style="display:flex;flex-direction:column">${ms.map(m => { const mine = m.sender_id === S.uid; const fromStaff = ['teacher', 'admin'].includes(m.sender?.role);
        return `<div class="bubble ${mine ? 'me' : ''}"><div class="small" style="opacity:.75">${esc(m.sender?.full_name || (fromStaff ? 'শিক্ষক' : 'অভিভাবক'))} · ${fmtTime(m.created_at)}</div>${esc(m.body)}</div>`; }).join('') || empty('chat', 'এখনো কোনো বার্তা নেই। প্রথম বার্তা লিখুন।')}</div>
        <div class="formrow" style="align-items:flex-end"><textarea id="mb" maxlength="1000" style="min-height:54px;margin:0" placeholder="বার্তা লিখুন"></textarea><button class="btn" id="ms" style="flex:0 0 96px">পাঠান</button></div>`;
      el.querySelector('#ms').onclick = async () => {
        const body = el.querySelector('#mb').value.trim(); if (!body) return;
        try { await ins('messages', { coaching_id: S.me.coaching_id, thread_student_id: studentId, sender_id: S.uid, body }); draw(); } catch { toast('পাঠানো যায়নি'); }
      };
      window.scrollTo(0, document.body.scrollHeight);
    };
    await draw();
    const t = setInterval(() => { if (cur().r !== 'chat') return clearInterval(t); if (!document.activeElement?.matches('#mb')) draw().catch(() => {}); }, 15000);
  } };

  // ---------- meetings ----------
  const SLOT = 'id,teacher_id,starts_at,minutes,place,booked_by,student_id,note,teacher:profiles!meeting_slots_teacher_id_fkey(full_name),student:students(roll,profile:profiles!students_profile_id_fkey(full_name))';
  const when = s => { const d = new Date(s.starts_at); return `${fmtDate(d)} · ${DAYS[d.getDay()]} · ${fmtTime(s.starts_at)}`; };
  SCREENS.meetings = { title: () => staff() ? 'অভিভাবক মিটিং' : 'শিক্ষকের সাথে মিটিং', sub: () => staff() ? 'সময় দিন, অভিভাবক বুক করবেন' : 'সময় বুক করুন', render: async (el) => {
    const from = `${dhakaToday()}T00:00:00%2B06:00`;
    if (staff()) {
      const slots = await sel('meeting_slots', `select=${SLOT}${isAdmin() ? '' : '&teacher_id=eq.' + S.uid}&starts_at=gte.${from}&order=starts_at&limit=100`);
      el.innerHTML = `<div class="card"><h3>নতুন সময়</h3><div class="formrow"><div><label>তারিখ</label><input id="sd" type="date" value="${dhakaToday()}"></div><div><label>সময়</label><input id="st" type="time" value="17:00"></div></div>
        <div class="formrow"><div><label>মিনিট</label><input id="sm" inputmode="numeric" value="15"></div><div><label>কোথায়</label><input id="sp" value="অফিস"></div></div><button class="btn" id="sa">যোগ করুন</button></div>` +
        slots.map(s => `<div class="card"><div style="display:flex;justify-content:space-between;gap:8px"><div><h3>${when(s)}</h3><div class="mute small">${bn(s.minutes)} মিনিট · ${esc(s.place)}${isAdmin() ? ' · ' + esc(s.teacher?.full_name || '') : ''}</div></div>${s.booked_by ? pill('বুক হয়েছে', 'good') : pill('খালি', 'teal')}</div>
          ${s.booked_by ? `<div style="margin-top:4px">${esc(nm(s.student))}${s.note ? ' · ' + esc(s.note) : ''}</div>` : `<button class="pill coral" data-del="${s.id}" style="margin-top:6px">মুছুন</button>`}</div>`).join('');
      el.querySelector('#sa').onclick = async () => {
        const d = el.querySelector('#sd').value, t = el.querySelector('#st').value, m = +ascii(el.querySelector('#sm').value);
        if (!d || !t || !(m > 0)) return toast('তারিখ, সময় ও মিনিট দিন');
        try { await ins('meeting_slots', { coaching_id: S.me.coaching_id, teacher_id: S.uid, starts_at: `${d}T${t}:00+06:00`, minutes: m, place: el.querySelector('#sp').value.trim() || 'অফিস' }, 'select=id'); render(); } catch { toast('যোগ করা যায়নি'); }
      };
      el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { try { await del('meeting_slots', `id=eq.${b.dataset.del}`); render(); } catch { toast('হয়নি'); } });
    } else {
      const [slots, kids] = await Promise.all([
        sel('meeting_slots', `select=${SLOT}&starts_at=gte.${from}&order=starts_at&limit=100`),
        sel('guardian_students', `select=student:students(${STU})&guardian_id=eq.${S.uid}`).then(r => r.map(x => x.student).filter(Boolean)),
      ]);
      const mine = slots.filter(s => s.booked_by === S.uid), open = slots.filter(s => !s.booked_by);
      el.innerHTML = (mine.length ? section('আমার বুকিং') + mine.map(s => `<div class="card good"><h3>${when(s)}</h3><div class="mute small">${esc(s.teacher?.full_name || '')} · ${esc(s.place)} · ${esc(nm(s.student))}</div><button class="pill coral" data-cancel="${s.id}" style="margin-top:6px">বাতিল করুন</button></div>`).join('') : '') +
        section('খালি সময়') + (open.map(s => `<div class="card"><h3>${when(s)}</h3><div class="mute small">${esc(s.teacher?.full_name || '')} · ${bn(s.minutes)} মিনিট · ${esc(s.place)}</div><button class="pill sun" data-book="${s.id}" style="margin-top:6px">বুক করুন</button></div>`).join('') || empty('handshake', 'এখন কোনো খালি সময় নেই।'));
      el.querySelectorAll('[data-book]').forEach(b => b.onclick = () => sheet(`<h2>মিটিং বুক</h2><label>কার বিষয়ে</label><select id="bk">${kids.map(k => `<option value="${k.id}">${esc(nm(k))}</option>`).join('')}</select><label>কী নিয়ে কথা বলবেন (ঐচ্ছিক)</label><input id="bn" maxlength="200"><button class="btn" id="bb">বুক করুন</button><button class="link" data-close>বাতিল</button>`, (s, close) => {
        s.querySelector('#bb').onclick = async () => {
          try { await rpc('book_meeting', { p_slot_id: b.dataset.book, p_student_id: s.querySelector('#bk').value, p_note: s.querySelector('#bn').value.trim() }); close(); toast('বুক হয়েছে ✓'); render(); }
          catch (e) { toast(/slot taken/.test(e.body || '') ? 'এই সময় এইমাত্র অন্য কেউ বুক করেছেন' : /too many/.test(e.body || '') ? 'একসাথে বেশি বুকিং করা যায় না' : 'বুক করা যায়নি'); close(); render(); }
        };
      }));
      el.querySelectorAll('[data-cancel]').forEach(b => b.onclick = async () => { try { await rpc('cancel_meeting', { p_slot_id: b.dataset.cancel }); render(); } catch { toast('হয়নি'); } });
    }
  } };
})();

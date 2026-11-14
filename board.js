'use strict';
// "আজ কার হাজিরা" (spec 2026-11-14, attendance board): who took today's attendance, per shift and class period.
// Taken rows: RPC attendance_board. Still due: the routine (class_periods) minus whatever is already taken.
// Open to every staff member (teacher and admin); the server decides what they can see.
(function () {
  const ROUTINE_Q = 'select=shift,slot,class_level,teacher_id,teacher:teacher_id(full_name)&order=shift,slot,class_level';
  const slotText = n => (+n === 0 ? 'সব স্লট' : `${T.slotBn(+n)} ক্লাস`);
  // A taken row covers a routine row when it is the same shift, the same slot (or the whole-shift exam slot 0) and the same class.
  const covers = (t, p) => t.shift === p.shift && (+t.slot === +p.slot || +t.slot === 0) && (p.class_level == null || +t.class_level === +p.class_level);

  async function load() {
    let taken;
    try { taken = await rpc('attendance_board', {}); }
    catch (e) {
      if (e.status === 404 || /PGRST202/.test(e.body || '')) return { off: true };
      return { err: e };
    }
    const routine = await sel('class_periods', ROUTINE_Q).catch(() => []); // routine missing: only the taken rows show
    return { taken: Array.isArray(taken) ? taken : [], routine: Array.isArray(routine) ? routine : [] };
  }

  function rowsOf({ taken, routine }) {
    const rows = taken.map(t => ({ done: true, shift: t.shift, slot: +t.slot, cl: t.class_level == null ? null : +t.class_level, t }));
    const seen = new Set();
    routine.forEach(p => {
      if (!(+p.slot >= 1 && +p.slot <= 3) || taken.some(t => covers(t, p))) return;
      const key = [p.shift, p.slot, p.class_level, p.teacher_id].join('|');
      if (seen.has(key)) return;
      seen.add(key);
      rows.push({ done: false, shift: p.shift, slot: +p.slot, cl: p.class_level == null ? null : +p.class_level, teacher: p.teacher?.full_name || 'শিক্ষক ঠিক করা হয়নি' });
    });
    // Within a shift: not-yet rows first, then done rows; by slot, then class.
    const sIdx = s => SHIFTS.findIndex(x => x.id === s);
    return rows.sort((a, b) => sIdx(a.shift) - sIdx(b.shift) || (a.done - b.done) || a.slot - b.slot || (a.cl ?? 0) - (b.cl ?? 0));
  }

  function rowHtml(r) {
    if (!r.done) {
      return `<div class="card brow"><div class="brow-top"><h3>${esc(r.cl == null ? 'সব ক্লাস' : 'ক্লাস ' + bn(r.cl))}</h3><span class="pill">এখনো নেওয়া হয়নি</span></div>
        <div class="mute small">${esc(slotText(r.slot))} · দায়িত্বে: ${esc(r.teacher)}</div></div>`;
    }
    const t = r.t, exam = t.session === 'exam';
    const title = exam ? `পরীক্ষা · ${esc(t.exam_title || 'নাম দেওয়া হয়নি')}` : `ক্লাস ${esc(bn(t.class_level))}`;
    const meta = [exam ? `ক্লাস ${bn(t.class_level)}` : null, slotText(t.slot), fmtTime(t.marked_at)].filter(Boolean).map(esc).join(' · ');
    return `<div class="card brow"><div class="brow-top"><h3>${title}</h3><span class="pill good">নেওয়া হয়েছে</span></div>
      <div class="mute small">${meta}</div>
      <div>${esc(t.teacher_names || 'নাম পাওয়া যায়নি')}</div>
      <div class="mute small">${esc(bn(t.present_count))} জন উপস্থিত, ${esc(bn(t.absent_count))} জন অনুপস্থিত</div></div>`;
  }

  function boardHtml(d) {
    if (d.off) return `<div class="card">${empty('check_list', 'এই সুবিধা এখনো চালু হয়নি।')}</div>`;
    if (d.err) return `<div class="card">${empty('wifi_off', `তথ্য আনা যায়নি${isOfflineErr(d.err) ? ' (ইন্টারনেট নেই?)' : ''}।`)}</div>`;
    const rows = rowsOf(d);
    if (!rows.length) return `<div class="card">${empty('check_list', 'আজ এখনো কোনো হাজিরা নেওয়া হয়নি।')}</div>`;
    const done = rows.filter(r => r.done).length, due = rows.length - done;
    let h = `<div class="mute small" style="padding:0 4px">${due ? `${bn(done)}টি নেওয়া হয়েছে, ${bn(due)}টি এখনো বাকি।` : `${bn(done)}টি নেওয়া হয়েছে। আজ সব হয়ে গেছে।`}</div>`;
    SHIFTS.forEach(s => {
      const list = rows.filter(r => r.shift === s.id);
      if (list.length) h += section(`${s.bn} শিফট · ${s.time}`) + `<div class="stack">${list.map(rowHtml).join('')}</div>`;
    });
    return h;
  }

  SCREENS['t.board'] = { title: 'আজ কার হাজিরা', sub: () => todayBnLong(), render: async (el) => {
    const d = await load();
    el.innerHTML = boardHtml(d) + `<button class="btn ghost" id="bagain">আবার দেখুন</button>`;
    el.querySelector('#bagain').onclick = () => render();
  } };
})();

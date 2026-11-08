'use strict';
// Report cards — mirror Reports.kt (rules), SupabaseReportRepository.kt and WeeklyReports.kt.
// Weekly (Sat–Fri) or model-test series; score = 60% marks + 40% rating; tie → more days present.
// Guardians/students see published cards (MyReports) and tap "দেখেছি"; staff build, print and (admin) publish.
(function () {
  const W_MARKS = 0.6, W_RATING = 0.4;
  const KIND = { weekly: 'সাপ্তাহিক রিপোর্ট কার্ড', series: 'মডেল টেস্ট সিরিজ' };
  const grade = p => p >= 80 ? 'A+' : p >= 70 ? 'A' : p >= 60 ? 'A-' : p >= 50 ? 'B' : p >= 40 ? 'C' : p >= 33 ? 'D' : 'F';
  const rankBn = n => bn(n) + ([1, 5, 7, 8, 9, 10].includes(n) ? 'ম' : [2, 3].includes(n) ? 'য়' : n === 4 ? 'র্থ' : n === 6 ? 'ষ্ঠ' : 'তম');
  const d1 = v => v == null ? '—' : bn((Math.round(v * 10) / 10).toString());
  const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };
  const lastFriday = (iso = dhakaToday()) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() - ((d.getDay() + 2) % 7)); return d.toLocaleDateString('en-CA'); };
  const range = (f, t) => `${fmtDate(f)} – ${fmtDateY(t)}`;
  const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
  const totalOf = r => +r.behavior + +r.homework + +r.performance;
  const chunks = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
  const COLS = 'id,student_id,kind,title,period_from,period_to,class_level,rank,class_size,award,data,published_at,seen_at';

  // ---------- one card (screen + print share the same markup) ----------
  function cardHtml(c, { print = false } = {}) {
    const d = c.data || {}, lines = d.lines || [];
    const full = lines.reduce((s, l) => s + (+l.f || 0), 0), got = lines.reduce((s, l) => s + (+l.o || 0), 0);
    const pct = full > 0 ? 100 * got / full : null;
    const weekly = c.kind !== 'series';
    const arrow = l => l.p == null ? '' : (+l.o || 0) > +l.p ? ' ↑' : (+l.o || 0) < +l.p ? ' ↓' : ' =';
    const rows = lines.map(l => `<tr><td>${esc(l.s)}</td>${weekly ? '' : `<td>${l.d ? fmtDate(l.d) : '—'}</td>`}<td>${num(l.f)}</td><td>${l.o == null ? 'অনুপস্থিত' : num(l.o)}</td><td>${l.o == null ? '—' : grade(100 * l.o / l.f)}</td>${weekly ? `<td>${l.p == null ? '—' : num(l.p) + arrow(l)}</td>` : ''}</tr>`).join('');
    if (!print) return `<div class="card rc"><div class="mute small">${esc(c.title || KIND[c.kind] || '')} · ${range(c.period_from, c.period_to)}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:4px"><h3>${esc(d.name || '')}</h3>${c.rank ? `<b>${rankBn(c.rank)} / ${bn(c.class_size)}</b>` : ''}</div>
      ${c.award === 'topper' ? pill('★ এ সপ্তাহের ক্লাস টপার', 'sun') : c.award === 'improved' ? pill('↑ সবচেয়ে উন্নতি', 'teal') : ''}
      <div style="margin-top:6px">${lines.map(l => `<div class="row"><span>${esc(l.s)}</span><b>${l.o == null ? 'অনুপস্থিত' : `${num(l.o)} / ${num(l.f)} · ${grade(100 * l.o / l.f)}`}</b></div>`).join('')}
      ${lines.length ? `<div class="row"><span>মোট</span><b>${num(got)} / ${num(full)}${pct != null ? ' · ' + grade(pct) : ''}</b></div>` : ''}</div>
      <div class="mute small" style="margin-top:6px">রেটিং ${d.rating == null ? '—' : d1(d.rating)}/১০ · উপস্থিতি ${bn(d.present || 0)}/${bn(d.days || 0)} দিন</div>`;
    return `<div class="pc"><div class="ph"><b>ডিফারেন্ট একাডেমিক অ্যান্ড এক্সাম কেয়ার</b><div>Different Academic &amp; Exam Care · Kushtia · Since 2008</div><div><b>${esc(KIND[c.kind] || c.title || '')}</b> · ${range(c.period_from, c.period_to)}</div></div>
      <div class="pm"><div>নাম: <b>${esc(d.name || '')}</b> · ক্লাস: ${bn(c.class_level)} · রোল: ${esc(bn(d.roll || '—'))} · ব্যাচ: ${esc(d.batch || '')}</div></div>
      <div class="pb"><table><tr><th>বিষয়</th>${weekly ? '' : '<th>তারিখ</th>'}<th>পূর্ণমান</th><th>প্রাপ্ত</th><th>গ্রেড</th>${weekly ? '<th>আগের সপ্তাহ</th>' : ''}</tr>${rows}
        ${lines.length ? `<tr><th>মোট</th>${weekly ? '' : '<th></th>'}<th>${num(full)}</th><th>${num(got)}</th><th>${pct != null ? grade(pct) : ''}</th>${weekly ? '<th></th>' : ''}</tr>` : ''}</table>
        <div class="ps"><div>ক্লাসে অবস্থান<b>${c.rank ? rankBn(c.rank) : '—'}</b><span>${bn(c.class_size || 0)} জনের মধ্যে</span></div>
          <div>${weekly ? 'সাপ্তাহিক রেটিং' : 'এই সময়ের রেটিং'}<b>${d.rating == null ? '—' : d1(d.rating) + '/১০'}</b></div>
          <div>উপস্থিতি<b>${bn(d.present || 0)}/${bn(d.days || 0)}</b></div><div>মোট স্কোর<b>${d1(d.score)}</b></div>
          ${c.award === 'topper' ? '<div><b>★ ক্লাস টপার</b></div>' : c.award === 'improved' ? '<div><b>↑ সবচেয়ে উন্নতি</b></div>' : ''}</div></div>
      <div class="pn">শিক্ষকের মন্তব্য: ________________________________________________</div>
      <div class="pg"><span>শ্রেণি শিক্ষক</span><span>পরিচালক</span><span>অভিভাবকের স্বাক্ষর</span></div>
      <div class="pf">Different Academic &amp; Exam Care · Every child is Different.</div></div>`;
  }
  // Two cards per A4 page, black and white, with a cut line (WeeklyReports.cardsPdf). The browser's print
  // dialog also offers "Save as PDF".
  function printCards(cards, title) {
    const w = window.open('', '_blank');
    if (!w) return toast('পপআপ বন্ধ আছে, প্রিন্ট খোলা যায়নি');
    const pages = chunks(cards, 2).map(p => `<section>${p.map(c => cardHtml(c, { print: true })).join('<div class="cut">✂ এখানে কেটে নিন</div>')}</section>`).join('');
    w.document.write(`<!doctype html><html lang="bn"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      @page{size:A4;margin:8mm}body{font-family:'Noto Sans Bengali','Hind Siliguri',sans-serif;color:#000;margin:0;font-size:11.5px}
      section{page-break-after:always;height:281mm;display:flex;flex-direction:column;justify-content:space-between}section:last-child{page-break-after:auto}
      .pc{border:1.5px solid #000;padding:8px 10px;height:132mm;box-sizing:border-box;display:flex;flex-direction:column;gap:5px}
      .ph{text-align:center;border-bottom:1px solid #000;padding-bottom:4px}.ph b{font-size:15px}.pb{display:flex;gap:10px;flex:1}
      table{border-collapse:collapse;flex:1;align-self:flex-start}td,th{border:1px solid #000;padding:2px 5px;text-align:center}td:first-child{text-align:left}
      .ps{width:34%;display:flex;flex-direction:column;gap:4px}.ps div{border:1px solid #000;padding:3px;text-align:center}.ps b{display:block;font-size:15px}
      .pg{display:flex;justify-content:space-between;margin-top:14px}.pg span{border-top:1px solid #000;padding-top:2px;width:28%;text-align:center}
      .pf{text-align:center;font-size:10px}.cut{text-align:center;border-top:1px dashed #000;font-size:10px;padding-top:2px}
    </style></head><body>${pages}<script>onload=()=>{print()}<\/script></body></html>`);
    w.document.close();
  }

  // ---------- guardian / student: published cards ----------
  SCREENS.myreports = { title: 'রিপোর্ট কার্ড', render: async (el, sid) => {
    if (!sid && S.me.role === 'student') sid = (await sel('students', `select=id&profile_id=eq.${S.uid}&limit=1`))[0]?.id;
    if (!sid) { el.innerHTML = empty('document', 'এখনো কোনো রিপোর্ট কার্ড প্রকাশ হয়নি। প্রতি সপ্তাহের মডেল টেস্টের পর এখানে আসবে।'); return; }
    const cards = await sel('report_cards', `select=${COLS}&student_id=eq.${sid}&order=period_to.desc&limit=40`);
    if (!cards.length) { el.innerHTML = empty('document', 'এখনো কোনো রিপোর্ট কার্ড প্রকাশ হয়নি। প্রতি সপ্তাহের মডেল টেস্টের পর এখানে আসবে।'); return; }
    el.innerHTML = cards.map(c => cardHtml(c) + `<div class="chips" style="margin:-4px 0 12px">${c.seen_at ? pill('✓ দেখেছেন (' + fmtDate(c.seen_at) + ')', 'teal') : S.me.role === 'guardian' ? `<button class="pill sun" data-seen="${c.id}">দেখেছি</button>` : ''}<button class="pill" data-pdf="${c.id}">PDF</button></div>`).join('');
    el.querySelectorAll('[data-seen]').forEach(b => b.onclick = async () => { b.disabled = true; try { await rpc('mark_report_seen', { p_id: b.dataset.seen }); render(); } catch { b.disabled = false; toast('পাঠানো যায়নি'); } });
    el.querySelectorAll('[data-pdf]').forEach(b => b.onclick = () => { const c = cards.find(x => x.id === b.dataset.pdf); printCards([c], c.title || 'রিপোর্ট কার্ড'); });
  } };

  if (typeof T === 'undefined') return; // the rest is for staff only

  // ---------- staff: build, print, publish (ReportsAdminScreen) ----------
  const RP = { kind: 'weekly', cls: 6, fri: null, from: null, to: null, old: false };
  async function loadPeriod(cls, from, to) {
    const studs = T.sortRoster((await T.allStudents()).filter(s => s.class_level === cls));
    const ids = studs.map(s => s.id);
    const exams = await sel('exams', `select=id,title,exam_date,full_marks,subject:subjects(name,name_bn)&class_level=eq.${cls}&exam_date=gte.${from}&exam_date=lte.${to}&order=exam_date&limit=300`);
    const marks = exams.length ? await sel('marks', `select=exam_id,student_id,obtained&exam_id=${inList(exams.map(e => e.id))}&limit=20000`) : [];
    const em = exams.map(e => ({ exam: e, subject: e.subject?.name_bn || e.subject?.name || '', marks: Object.fromEntries(marks.filter(m => m.exam_id === e.id).map(m => [m.student_id, m.obtained == null ? null : +m.obtained])) }));
    let ratings = [], att = [];
    for (const part of chunks(ids, 150)) {
      const [r, a] = await Promise.all([
        sel('class_ratings', `select=student_id,day,behavior,homework,performance,shift,slot&day=gte.${from}&day=lte.${to}&student_id=${inList(part)}&limit=5000`),
        sel('attendance', `select=student_id,check_in&date=gte.${from}&date=lte.${to}&student_id=${inList(part)}&limit=5000`),
      ]);
      ratings = ratings.concat(r); att = att.concat(a);
    }
    const attendance = {};
    att.forEach(a => { const x = attendance[a.student_id] ||= [0, 0]; x[1]++; if (a.check_in) x[0]++; });
    return { studs, exams: em, ratings, attendance };
  }
  // Same as Reports.kt buildCards.
  function buildCards(kind, from, to, d, prev) {
    const score = (m, r) => m != null && r != null ? W_MARKS * m + W_RATING * r * 10 : m != null ? m : r != null ? r * 10 : null;
    const pct = (exams, sid) => { const full = exams.reduce((s, e) => s + +e.exam.full_marks, 0); return full <= 0 ? null : 100 * exams.reduce((s, e) => s + (e.marks[sid] ?? 0), 0) / full; };
    const by = (l, k) => l.reduce((m, x) => ((m[x[k]] ||= []).push(x), m), {});
    const rBy = by(d.ratings, 'student_id'), pBy = by(prev?.ratings || [], 'student_id');
    const prevSub = {}; (prev?.exams || []).forEach(e => { if (!(e.subject in prevSub)) prevSub[e.subject] = e; });
    const hasPrev = prev && (prev.exams.length || prev.ratings.length);
    const sorted = d.exams.slice().sort((a, b) => (a.exam.exam_date || '').localeCompare(b.exam.exam_date || '') || a.subject.localeCompare(b.subject));
    const cards = d.studs.map(s => {
      const rs = rBy[s.id] || [], ps = pBy[s.id] || [];
      const rating = avg(rs.map(totalOf));
      const lines = sorted.map(e => { const p = kind === 'weekly' ? prevSub[e.subject] : null;
        return { s: e.subject || e.exam.title, d: e.exam.exam_date, f: +e.exam.full_marks, o: e.marks[s.id] ?? null, p: p ? p.marks[s.id] ?? null : null, pf: p ? +p.exam.full_marks : null }; });
      const [present, days] = d.attendance[s.id] || [0, 0];
      return { student_id: s.id, name: T.nameOf(s), roll: s.roll || '', batch: shiftBn(s.batch?.shift), lines, rating,
        b: avg(rs.map(r => +r.behavior)), h: avg(rs.map(r => +r.homework)), pe: avg(rs.map(r => +r.performance)), present, days,
        score: score(pct(d.exams, s.id), rating), prev_score: hasPrev ? score(pct(prev.exams, s.id), avg(ps.map(totalOf))) : null };
    });
    const r10 = c => Math.round(c.score * 10);
    const ranked = cards.filter(c => c.score != null).sort((a, b) => r10(b) - r10(a) || b.present - a.present);
    const rank = {};
    ranked.forEach((c, i) => { const p = ranked[i - 1]; rank[c.student_id] = p && r10(p) === r10(c) && p.present === c.present ? rank[p.student_id] : i + 1; });
    let improved = null, gain = 0.5;
    ranked.forEach(c => { if (rank[c.student_id] !== 1 && c.prev_score != null && c.score - c.prev_score > gain) { gain = c.score - c.prev_score; improved = c.student_id; } });
    return cards.map(c => ({ ...c, rank: rank[c.student_id] ?? null, class_size: ranked.length, award: rank[c.student_id] === 1 ? 'topper' : c.student_id === improved ? 'improved' : null }))
      .sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || a.name.localeCompare(b.name));
  }
  const asCard = (c, kind, from, to, cls) => ({ kind, title: KIND[kind], period_from: from, period_to: to, class_level: cls, rank: c.rank, class_size: c.class_size, award: c.award,
    data: { name: c.name, roll: c.roll, batch: c.batch, lines: c.lines, rating: c.rating, b: c.b, h: c.h, pe: c.pe, present: c.present, days: c.days, score: c.score, prev_score: c.prev_score } });

  SCREENS['a.reports'] = { title: 'রিপোর্ট কার্ড', sub: 'সাপ্তাহিক ও মডেল টেস্ট সিরিজ', render: async (el) => {
    RP.fri ||= lastFriday(); RP.from ||= monthStart(); RP.to ||= dhakaToday();
    const weekly = RP.kind === 'weekly';
    const from = weekly ? addDays(RP.fri, -6) : RP.from, to = weekly ? RP.fri : RP.to, cls = RP.cls;
    let h = chipRow([['weekly', 'সাপ্তাহিক'], ['series', 'মডেল টেস্ট সিরিজ']], RP.kind, 'data-kind') + chipRow(CLASSES.map(c => [c, 'ক্লাস ' + bn(c)]), cls, 'data-cls');
    h += weekly ? `<div class="mute small">কোন সপ্তাহ (শনি – শুক্র)</div>${chipRow([0, 1, 2, 3, 4, 5].map(i => { const f = addDays(lastFriday(), -7 * i); return [f, fmtDate(f)]; }), RP.fri, 'data-fri')}`
      : `<div class="formrow"><div><label>শুরু</label><input type="date" id="rf" value="${RP.from}"></div><div><label>শেষ</label><input type="date" id="rt" value="${RP.to}"></div></div>`;
    h += `<div class="mute small">${range(from, to)} · নিয়ম: নম্বর ৬০% + রেটিং ৪০%</div>`;
    el.innerHTML = h + skel(3);
    const [d, prev, pub] = await Promise.all([
      loadPeriod(cls, from, to),
      weekly ? loadPeriod(cls, addDays(from, -7), addDays(to, -7)) : Promise.resolve(null),
      sel('report_cards', `select=${COLS}&class_level=eq.${cls}&kind=eq.${RP.kind}&period_from=eq.${from}&period_to=eq.${to}&limit=500`).catch(() => []),
    ]);
    const cards = buildCards(RP.kind, from, to, d, prev);
    const gaps = d.exams.map(e => [e.subject || e.exam.title, d.studs.filter(s => !(s.id in e.marks)).length]).filter(g => g[1] > 0);
    h += `<div class="card ${gaps.length || !d.exams.length ? 'sun' : 'teal'}">${!d.exams.length ? `এই সময়ে ক্লাস ${bn(cls)} এর কোনো পরীক্ষা পাওয়া যায়নি। কার্ড শুধু রেটিং দিয়ে হবে। পরীক্ষা যোগ করতে: নম্বর ইনপুট।`
      : `<div>পরীক্ষা ${bn(d.exams.length)} টি: ${esc(d.exams.map(e => e.subject || e.exam.title).join(', '))}</div>${gaps.length ? gaps.map(([s, n]) => `<div>• ${esc(s)}: ${bn(n)} জনের নম্বর এখনো দেওয়া হয়নি</div>`).join('') : '<div>সব নম্বর দেওয়া হয়েছে, কার্ড তৈরি।</div>'}`}</div>`;
    const canPub = cards.some(c => c.score != null);
    h += `<button class="btn" id="pall" ${cards.length ? '' : 'disabled'}>সব কার্ড প্রিন্ট করুন (এক পাতায় ২টি)</button>
      ${isAdmin() ? `<button class="btn sun" id="pub" ${canPub ? '' : 'disabled'}>অভিভাবকদের অ্যাপে প্রকাশ করুন</button>` : ''}`;
    if (pub.length) { const seen = pub.filter(p => p.seen_at); h += `<div class="card"><h3>অভিভাবক দেখেছেন: ${bn(seen.length)} / ${bn(pub.length)} জন</h3>${pub.length > seen.length ? `<div class="mute small">এখনো দেখেননি: ${esc(pub.filter(p => !p.seen_at).map(p => p.data?.name || '').join(', '))}</div>` : ''}</div>`; }
    if (isAdmin()) h += '<div id="rem"></div>';
    h += `<button class="btn ghost" id="oldb">আগের প্রকাশিত রিপোর্ট দেখুন (ক্লাস ${bn(cls)})</button><div id="old"></div>`;
    h += section('ক্লাসে অবস্থান') + (cards.map(c => `<div class="card" style="display:flex;gap:10px;align-items:center"><b style="min-width:42px">${c.rank ? rankBn(c.rank) : '—'}</b><div style="flex:1"><h3>${esc(c.name)}</h3>
      <div class="mute small">নম্বর ${num(c.lines.reduce((s, l) => s + (l.o || 0), 0))}/${num(c.lines.reduce((s, l) => s + l.f, 0))} · রেটিং ${c.rating == null ? '—' : d1(c.rating)} · উপস্থিত ${bn(c.present)}/${bn(c.days)}</div>
      ${c.award === 'topper' ? pill('★ ক্লাস টপার', 'sun') : c.award === 'improved' ? pill('↑ সবচেয়ে উন্নতি', 'teal') : ''}</div><b>${d1(c.score)}</b></div>`).join('') || empty('school', 'এই ক্লাসে কোনো শিক্ষার্থী নেই।'));
    el.innerHTML = h;
    el.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => { RP.kind = b.dataset.kind; render(); });
    el.querySelectorAll('[data-cls]').forEach(b => b.onclick = () => { RP.cls = +b.dataset.cls; render(); });
    el.querySelectorAll('[data-fri]').forEach(b => b.onclick = () => { RP.fri = b.dataset.fri; render(); });
    const rf = el.querySelector('#rf'), rt = el.querySelector('#rt');
    if (rf) rf.onchange = () => { if (rf.value) { RP.from = rf.value; render(); } };
    if (rt) rt.onchange = () => { if (rt.value) { RP.to = rt.value; render(); } };
    el.querySelector('#pall').onclick = () => printCards(cards.map(c => asCard(c, RP.kind, from, to, cls)), 'রিপোর্ট কার্ড · ক্লাস ' + bn(cls));
    const pb = el.querySelector('#pub');
    if (pb) pb.onclick = async () => {
      const rows = cards.filter(c => c.score != null || c.lines.length).map(c => ({ coaching_id: S.me.coaching_id, student_id: c.student_id, ...asCard(c, RP.kind, from, to, cls), published_by: S.uid }));
      pb.disabled = true; pb.textContent = 'প্রকাশ হচ্ছে…';
      try {
        await raw('POST', '/rest/v1/report_cards?on_conflict=student_id,kind,period_from,period_to&select=id', rows, { prefer: 'return=representation,resolution=merge-duplicates' });
        toast('প্রকাশ হয়েছে। অভিভাবকরা অ্যাপে কার্ড দেখে "দেখেছি" চাপবেন।'); render();
      } catch { toast('প্রকাশ করা যায়নি। আবার চেষ্টা করুন।'); pb.disabled = false; pb.textContent = 'অভিভাবকদের অ্যাপে প্রকাশ করুন'; }
    };
    el.querySelector('#oldb').onclick = async () => {
      const box = el.querySelector('#old'); box.innerHTML = skel(2);
      const rows = await sel('report_cards', `select=kind,period_from,period_to,seen_at&class_level=eq.${cls}&order=period_to.desc&limit=5000`).catch(() => []);
      const per = {}; rows.forEach(r => { const k = `${r.kind}|${r.period_from}|${r.period_to}`; const x = per[k] ||= { kind: r.kind, from: r.period_from, to: r.period_to, n: 0, seen: 0 }; x.n++; if (r.seen_at) x.seen++; });
      const list = Object.values(per);
      box.innerHTML = section(`আগের প্রকাশিত রিপোর্ট · ক্লাস ${bn(cls)}`) + (list.map(p => `<div class="card"><div class="mute small">${KIND[p.kind]} · দেখেছেন ${bn(p.seen)}/${bn(p.n)}</div><h3>${range(p.from, p.to)}</h3>
        <div class="chips"><button class="pill teal" data-open="${p.kind}|${p.from}|${p.to}">খুলুন</button><button class="pill" data-reprint="${p.kind}|${p.from}|${p.to}">আবার প্রিন্ট</button></div></div>`).join('') || empty('document', 'এই ক্লাসের কোনো রিপোর্ট এখনো প্রকাশ হয়নি।'));
      box.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { const [k, f, t] = b.dataset.open.split('|'); RP.kind = k; if (k === 'weekly') RP.fri = t; else { RP.from = f; RP.to = t; } render(); });
      box.querySelectorAll('[data-reprint]').forEach(b => b.onclick = async () => {
        const [k, f, t] = b.dataset.reprint.split('|');
        const cs = await sel('report_cards', `select=${COLS}&class_level=eq.${cls}&kind=eq.${k}&period_from=eq.${f}&period_to=eq.${t}&limit=500`).catch(() => []);
        printCards(cs.sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9)), 'রিপোর্ট কার্ড · ক্লাস ' + bn(cls));
      });
    };
    if (isAdmin()) reminderCard(el.querySelector('#rem'));
  } };

  // ---------- admin: when marks are due and reminders go out (ReminderSettingsCard) ----------
  const DOW = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি']; // index = Postgres dow (0 = Sunday)
  const timeBn = t => { const [hh, mm] = (t || '00:00').split(':').map(Number); const part = hh < 12 ? 'সকাল' : hh < 15 ? 'দুপুর' : hh < 18 ? 'বিকেল' : hh < 20 ? 'সন্ধ্যা' : 'রাত'; return `${part} ${bn(((hh + 11) % 12) + 1)}:${bn(String(mm).padStart(2, '0'))}`; };
  async function reminderCard(box) {
    const r = (await sel('report_settings', 'select=due_dow,reminder_time,due_time,enabled&limit=1').catch(() => []))[0] || {};
    const st = { due_dow: r.due_dow ?? 5, reminder_time: (r.reminder_time || '17:00').slice(0, 5), due_time: (r.due_time || '21:00').slice(0, 5), enabled: r.enabled ?? true, open: false };
    const draw = () => {
      box.innerHTML = `<div class="card"><h3>নম্বর জমার সময় ও মনে করানো</h3><div class="mute">${st.enabled ? `প্রতি${DOW[st.due_dow]}বার: ${timeBn(st.reminder_time)} থেকে শিক্ষকদের মনে করানো, ${timeBn(st.due_time)} এ আপনার কাছে ফল` : 'বন্ধ আছে'}</div>
        <button class="pill teal" id="ro" style="margin-top:8px">${st.open ? 'বদলান ▴' : 'বদলান ▾'}</button>
        ${st.open ? `${chipRow([6, 0, 1, 2, 3, 4, 5].map(i => [i, DOW[i]]), st.due_dow, 'data-dow')}
          <div class="formrow"><div><label>মনে করানো</label><input type="time" id="rr" value="${st.reminder_time}"></div><div><label>শেষ সময়</label><input type="time" id="rd" value="${st.due_time}"></div></div>
          <button class="btn ghost" id="ren">${st.enabled ? 'মনে করানো বন্ধ করুন' : 'মনে করানো চালু করুন'}</button><button class="btn" id="rs">সংরক্ষণ</button>` : ''}</div>`;
      box.querySelector('#ro').onclick = () => { st.open = !st.open; draw(); };
      box.querySelectorAll('[data-dow]').forEach(b => b.onclick = () => { st.due_dow = +b.dataset.dow; draw(); });
      const rr = box.querySelector('#rr'), rd = box.querySelector('#rd');
      if (rr) rr.onchange = () => { st.reminder_time = rr.value || st.reminder_time; };
      if (rd) rd.onchange = () => { st.due_time = rd.value || st.due_time; };
      const en = box.querySelector('#ren'); if (en) en.onclick = () => { st.enabled = !st.enabled; draw(); };
      const sv = box.querySelector('#rs');
      if (sv) sv.onclick = async () => {
        try {
          await raw('POST', '/rest/v1/report_settings?on_conflict=coaching_id&select=coaching_id', { coaching_id: S.me.coaching_id, due_dow: st.due_dow, reminder_time: st.reminder_time, due_time: st.due_time, enabled: st.enabled }, { prefer: 'return=representation,resolution=merge-duplicates' });
          toast('সংরক্ষিত হয়েছে।'); st.open = false; draw();
        } catch { toast('সংরক্ষণ হয়নি।'); }
      };
    };
    draw();
  }
})();

'use strict';
// Report cards — mirror Reports.kt (rules), SupabaseReportRepository.kt and WeeklyReports.kt.
// Weekly (Sat–Fri) or model-test series. Score, rank and award are computed in SQL (compute_report_scores);
// this file only assembles the card lines, saves drafts and shows the result.
// Guardians/students see published cards (MyReports) and tap "দেখেছি"; staff build drafts, print and (admin) publish.
(function () {
  const KIND = { weekly: 'সাপ্তাহিক রিপোর্ট কার্ড', series: 'মডেল টেস্ট সিরিজ' };
  const grade = p => p >= 80 ? 'A+' : p >= 70 ? 'A' : p >= 60 ? 'A-' : p >= 50 ? 'B' : p >= 40 ? 'C' : p >= 33 ? 'D' : 'F';
  const rankBn = n => bn(n) + ([1, 5, 7, 8, 9, 10].includes(n) ? 'ম' : [2, 3].includes(n) ? 'য়' : n === 4 ? 'র্থ' : n === 6 ? 'ষ্ঠ' : 'তম');
  const d1 = v => v == null ? '—' : bn((Math.round(v * 10) / 10).toString());
  const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };
  const lastFriday = (iso = dhakaToday()) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() - ((d.getDay() + 2) % 7)); return d.toLocaleDateString('en-CA'); };
  const range = (f, t) => `${fmtDate(f)} – ${fmtDateY(t)}`;
  const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
  const chunks = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
  const COLS = 'id,student_id,kind,title,period_from,period_to,class_level,rank,class_size,award,data,status,published_at,seen_at';

  // ---------- one card (screen + print share the same markup) ----------
  function cardHtml(c, { print = false } = {}) {
    const d = c.data || {}, lines = d.lines || [];
    const full = lines.reduce((s, l) => s + (+l.f || 0), 0), got = lines.reduce((s, l) => s + (+l.o || 0), 0);
    const pct = full > 0 ? 100 * got / full : null;
    const weekly = c.kind !== 'series';
    const arrow = l => l.p == null ? '' : (+l.o || 0) > +l.p ? ' ↑' : (+l.o || 0) < +l.p ? ' ↓' : ' =';
    if (!print) return `<div class="card rc"><div class="mute small">${esc(c.title || KIND[c.kind] || '')} · ${range(c.period_from, c.period_to)}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:4px"><h3>${esc(d.name || '')}</h3>${c.rank ? `<b>${rankBn(c.rank)} / ${bn(c.class_size)}</b>` : ''}</div>
      ${c.award === 'topper' ? pill('★ এ সপ্তাহের ক্লাস টপার', 'sun') : c.award === 'improved' ? pill('↑ সবচেয়ে উন্নতি', 'teal') : ''}
      <div style="margin-top:6px">${lines.map(l => `<div class="row"><span>${esc(l.s)}</span><b>${l.o == null ? 'অনুপস্থিত' : `${num(l.o)} / ${num(l.f)} · ${grade(100 * l.o / l.f)}`}</b></div>`).join('')}
      ${lines.length ? `<div class="row"><span>মোট</span><b>${num(got)} / ${num(full)}${pct != null ? ' · ' + grade(pct) : ''}</b></div>` : ''}</div>
      <div class="mute small" style="margin-top:6px">রেটিং ${d.rating == null ? '—' : d1(d.rating)}/১০ · উপস্থিতি ${bn(d.present || 0)}/${bn(d.days || 0)} দিন</div>`;
    const nr = !!c.noRank;   // printed without the class position
    const awardTxt = nr ? '' : c.award === 'topper' ? '★ ক্লাস টপার' : c.award === 'improved' ? '↑ সবচেয়ে উন্নতি' : '';
    const first = (d.name || '').trim().split(/\s+/)[0] || 'তুমি';
    const prevSum = lines.reduce((s, l) => s + (+l.p || 0), 0), hasPrev = weekly && lines.some(l => l.p != null);
    const msg = cheer(pct, hasPrev && got > prevSum, first);
    const g = pct == null ? '—' : grade(pct);
    const trs = lines.map(l => `<tr><td>${esc(l.s)}${!weekly && l.d ? `<small> · ${fmtDate(l.d)}</small>` : ''}</td><td>${num(l.f)}</td><td class="ob">${l.o == null ? '<i>অনুপস্থিত</i>' : num(l.o)}</td><td class="gr">${l.o == null ? '—' : grade(100 * l.o / l.f)}</td>${weekly ? `<td class="pv">${l.p == null ? '—' : num(l.p) + arrow(l)}</td>` : ''}</tr>`).join('');
    const field = (k, v, cls = '') => `<div class="fd ${cls}"><small>${k}</small><b>${v}</b></div>`;
    return `<div class="pc"><div class="tk"><img class="wm" src="${LOGO()}" alt="">
      <div class="bar"><img src="${LOGO()}" alt=""><div class="bt"><b>ডিফারেন্ট একাডেমিক অ্যান্ড এক্সাম কেয়ার</b><span>DIFFERENT ACADEMIC &amp; EXAM CARE · KUSHTIA</span></div>
        <div class="bi">${['pencil', 'book', 'star'].map(n => doodle(n)).join('')}</div><div class="kd">${esc(KIND[c.kind] || c.title || '')}</div></div>
      <div class="fs">${field('শিক্ষার্থী', esc(d.name || ''), 'nm')}${field('ক্লাস', bn(c.class_level))}${field('রোল', esc(bn(d.roll || '—')))}${field('ব্যাচ', esc(d.batch || '—'))}${field('সময়', range(c.period_from, c.period_to), 'pd')}</div>
      <div class="bd${lines.length > 9 ? ' d2' : lines.length > 6 ? ' d1' : ''}"><div class="lc"><table><tr><th>বিষয়</th><th>পূর্ণমান</th><th>প্রাপ্ত</th><th>গ্রেড</th>${weekly ? '<th>গত সপ্তাহ</th>' : ''}</tr>${trs}
            ${lines.length ? `<tr class="tot"><td>মোট</td><td>${num(full)}</td><td class="ob">${num(got)}</td><td class="gr">${g}</td>${weekly ? '<td></td>' : ''}</tr>` : ''}</table>
          ${d.b != null && lines.length <= 4 ? `<div class="rb"><div class="rh">${weekly ? 'এই সপ্তাহের' : 'এই সময়ের'} ক্লাস রেটিং <small>(প্রতিদিনের গড়)</small></div>${[['আচরণ', d.b, 3], ['বাড়ির কাজ', d.h, 3], ['ক্লাসের পারফরম্যান্স', d.pe, 4]].map(([k, v, m]) => `<div class="rr"><span>${k}</span><div class="rt"><i style="width:${v == null ? 0 : Math.min(100, 100 * v / m)}%"></i></div><b>${v == null ? '—' : d1(v)}<small>/${bn(m)}</small></b></div>`).join('')}<div class="rn">মোট স্কোর = পরীক্ষার নম্বর ৬০% + ক্লাস রেটিং ৪০%</div></div>` : ''}
          <div class="gp">${[['bulb', 30, -14, -4], ['ruler', 24, 18, 4], ['atom', 28, 6, -3], ['book', 24, -8, 4], ['globe', 30, -4, -2], ['pencil', 24, 24, 3], ['flask', 27, 10, -4]].map(([n, w, r, y]) => doodle(n, `width:${w}px;height:${w}px;transform:translateY(${y}px) rotate(${r}deg)`)).join('')}</div>
          <div class="sx">${field('রেটিং', d.rating == null ? '—' : d1(d.rating) + '<em>/১০</em>')}${field('উপস্থিতি', `${bn(d.present || 0)}<em>/${bn(d.days || 0)} দিন</em>`)}${field('মোট স্কোর', d1(d.score))}</div></div>
        <div class="sd">${nr ? '' : `<div class="rk"><small>ক্লাসে অবস্থান</small><b>${c.rank ? rankBn(c.rank) : '—'}</b><span>${bn(c.class_size || 0)} জনের মধ্যে</span>${awardTxt ? `<em>${awardTxt}</em>` : ''}</div>`}
          <div class="stp"><small>গ্রেড</small><b>${g}</b></div>${doodle('star', 'width:20px;height:20px;transform:rotate(14deg);opacity:.55;align-self:flex-end;margin-right:8px')}</div></div>
      ${msg ? `<div class="ms">${msg}${doodle('cap', 'position:absolute;right:190px;top:-4px;width:30px;height:30px;transform:rotate(-10deg);opacity:.5')}${doodle('calc', 'position:absolute;right:150px;top:4px;width:22px;height:22px;transform:rotate(12deg);opacity:.5')}</div>` : ''}
      <div class="tn"><span>শিক্ষকের মন্তব্য</span><i></i></div>
      <div class="sg"><span>শ্রেণি শিক্ষক</span>${doodle('compass', 'transform:rotate(-12deg)')}<span>পরিচালক</span>${doodle('abc', 'transform:rotate(8deg)')}<span>অভিভাবকের স্বাক্ষর</span></div>
      <div class="ft"><img src="${LOGO()}" alt=""><b>ডিফারেন্ট একাডেমিক অ্যান্ড এক্সাম কেয়ার</b><u></u><span>Every child is Different.</span></div>
    </div></div>`;
  }
  // Little encouragement printed on every card (kind, never harsh).
  function cheer(pct, up, name) {
    const base = pct >= 80 ? 'দারুণ করেছ! এভাবেই এগিয়ে চলো।' : pct >= 60 ? 'ভালো করেছ! আরেকটু চেষ্টায় আরও ভালো হবে।' : '';
    if (!base && !up) return '';   // nothing to say is better than a sad line
    return `<b>${esc(name)},</b> ${base || 'গত সপ্তাহের চেয়ে এগিয়েছ ↑'}${base && up ? ' গত সপ্তাহের চেয়ে এগিয়েছ ↑' : ''}`;
  }
  // Line-art study things (24 x 24, stroke only) sprinkled on the card and lined up along its foot.
  const ICONS = {
    book: 'M3 5.5c3-1.6 6-1.6 9 0v14c-3-1.6-6-1.6-9 0z M12 5.5c3-1.6 6-1.6 9 0v14c-3-1.6-6-1.6-9 0z M5.5 9h4 M5.5 12h4 M14.5 9h4 M14.5 12h4',
    pencil: 'M4 20l1.2-4.2L15.6 5.4a2 2 0 0 1 2.8 0l.2.2a2 2 0 0 1 0 2.8L8.2 18.8z M14 7l3 3 M5.2 15.8l3 3',
    ruler: 'M2.5 15.5L15.5 2.5l6 6-13 13z M6 12l2 2 M8.5 9.5l1.5 1.5 M11 7l2 2 M13.5 4.5l1.5 1.5',
    globe: 'M12 3a7 7 0 1 0 0 14a7 7 0 1 0 0-14 M5 10h14 M12 3c2.5 2 2.5 12 0 14 M12 3c-2.5 2-2.5 12 0 14 M12 17v3 M8 21h8',
    atom: 'M12 12m-1.2 0a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0 M3 12c0-2.2 4-4 9-4s9 1.8 9 4-4 4-9 4-9-1.8-9-4z M7.5 4.2c1.9-1.1 5.4 1.5 7.9 5.8s2.9 8.7 1.1 9.8-5.4-1.5-7.9-5.8-2.9-8.7-1.1-9.8z M16.5 4.2c1.9 1.1 1.4 5.5-1.1 9.8s-6 6.9-7.9 5.8-1.4-5.5 1.1-9.8 6-6.9 7.9-5.8z',
    bulb: 'M9 18h6 M10 21h4 M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.6 1 2.5h6c0-.9.2-1.7 1-2.5A6 6 0 0 0 12 3z M12 7v4 M10.5 9.5L12 11l1.5-1.5',
    calc: 'M6 2.5h12a1 1 0 0 1 1 1v17a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-17a1 1 0 0 1 1-1z M8 5.5h8v4H8z M8.5 13h.01 M12 13h.01 M15.5 13h.01 M8.5 16.5h.01 M12 16.5h.01 M15.5 16.5h.01',
    flask: 'M9 3h6 M10 3v6l-5.5 9.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3 M7.2 15h9.6 M11 17.5h.01 M13.5 18.5h.01',
    cap: 'M2 9.5l10-5 10 5-10 5z M6 11.5v4.5c3.5 2.5 8.5 2.5 12 0v-4.5 M22 9.5v5.5',
    compass: 'M12 3a1.6 1.6 0 1 0 0 3.2a1.6 1.6 0 1 0 0-3.2 M11.2 6l-5.2 15 M12.8 6l5.2 15 M8.4 14.5h7.2',
    star: 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z',
    abc: 'M3 18l3.5-10L10 18 M4.3 14.5h4.4 M13 8v10h3.2a2.5 2.5 0 0 0 0-5H13 M13 8h2.8a2.5 2.5 0 0 1 0 5',
  };
  const doodle = (n, style = '', white = false) => `<svg style="${style}" viewBox="0 0 24 24" fill="none" stroke="${white ? '#fff' : '#000'}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[n]}"/></svg>`;
  let logoUri = null;   // logo as a data URI so the print window and the shared picture both carry it
  const LOGO = () => logoUri || (location.origin + '/logo.svg');
  async function loadLogo() { if (logoUri) return; try { const t = await (await fetch('logo.svg')).text(); logoUri = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(t))); } catch {} }
  // Black and white only, with line-art study things. Designed on a 794 x 561 px (A5 landscape) card;
  // two make one A4 sheet.
  const CSS = `*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body{font-family:'Noto Sans Bengali','Hind Siliguri',sans-serif;color:#000;margin:0;background:#fff;font-size:12px;font-weight:600}
    .pc{width:210mm;height:148.5mm;padding:7mm;background:#fff}
    .tk{height:100%;display:flex;flex-direction:column;border:1.8px solid #000;border-radius:14px;overflow:hidden;position:relative;background:#fff}
    .wm{position:absolute;right:-30px;bottom:-26px;height:300px;opacity:.07;filter:brightness(0);pointer-events:none}
    .gp{flex:1;min-height:0;overflow:hidden;display:flex;justify-content:space-around;align-items:center;opacity:.5}.gp svg{flex:none}
    .bar{background:#fff;color:#000;display:flex;align-items:center;gap:11px;padding:5px 16px 4px;flex:none;border-bottom:4.5px double #000}
    .bar img{height:40px;filter:brightness(0)}.bt{flex:1;display:flex;flex-direction:column;gap:1px}.bt b{font-size:19px;line-height:1.35}.bt span{font-size:9.5px;letter-spacing:1.8px;opacity:1}
    .bi{display:flex;gap:7px}.bi svg{width:17px;height:17px}
    .kd{background:#000;color:#fff;border-radius:20px;padding:3px 13px;font-size:11px;font-weight:700;white-space:nowrap}
    .fs{display:flex;padding:5px 16px 3px;border-bottom:1.2px solid #000;position:relative}
    .fd small{display:block;font-size:9.5px;letter-spacing:.5px;color:#000}.fd b{font-size:13px;white-space:nowrap}.fd em{font-style:normal;font-size:9.5px;font-weight:600}
    .fs .fd{padding:0 12px;border-left:.6px solid #000}.fs .fd:first-child{padding-left:0;border-left:0}.fs .nm{flex:1;min-width:0}.fs .nm b{font-size:20px;line-height:1.45;display:block;overflow:hidden;text-overflow:ellipsis;margin-top:-2px}.fs .pd b{font-size:11px}
    .bd{display:flex;gap:16px;padding:8px 16px 0;flex:1;min-height:0;position:relative}
    .lc{flex:1;display:flex;flex-direction:column;gap:8px}.bd{overflow:hidden}
    .d1 td{padding:1.3px 5px;font-size:11.5px}.d1 th{padding:2px 5px}.d2 td{padding:.6px 5px;font-size:10.5px}.d2 th{padding:1px 5px}.d2 .sx .fd b{font-size:13px}.d1 .gp,.d2 .gp{display:none}
    table{border-collapse:collapse;width:100%}
    th{font-size:9.5px;font-weight:700;letter-spacing:.4px;text-align:center;padding:3px 5px;border-bottom:1.2px solid #000}
    td{text-align:center;padding:3.8px 5px;border-bottom:.7px solid #000;font-size:12px}th:first-child,td:first-child{text-align:left}
    td small{font-size:9.5px}td.ob,td.gr{font-weight:700}td.pv{font-size:10.5px;color:#000}td i{font-weight:600;font-size:9.5px}
    tr.tot td{border-top:1.2px solid #000;border-bottom:0;font-weight:700;padding-top:5px}
    .sx{display:flex;gap:8px;margin-top:auto}.sx .fd{flex:1;border:1px solid #000;border-radius:8px;padding:3px 10px;background:#fff}.sx .fd b{font-size:15px}
    .sd{width:150px;display:flex;flex-direction:column;align-items:center;gap:12px}
    .rk{width:100%;border:1.4px solid #000;border-radius:12px;text-align:center;padding:5px 4px 6px;background:#fff}.rk small{display:block;font-size:10px}.rk b{display:block;font-size:36px;line-height:1.25}.rk span{font-size:10px}
    .rk em{display:block;font-style:normal;font-weight:700;font-size:10.5px;margin-top:3px;border-top:.6px solid #000;padding-top:2px}
    .stp{width:86px;height:86px;border-radius:50%;border:2px solid #000;outline:1px solid #000;outline-offset:3px;display:flex;flex-direction:column;align-items:center;justify-content:center;transform:rotate(-10deg);background:#fff}
    .stp small{font-size:10px;letter-spacing:1px}.stp b{font-size:30px;line-height:1}
    .ms{margin:5px 16px 0;padding:3px 10px;border-left:3px solid #000;font-size:11.5px;line-height:1.35;position:relative}
    .tn{margin:4px 16px 0;display:flex;align-items:flex-end;gap:8px;font-size:9.5px}.tn i{flex:1;border-bottom:1px dotted #000;height:15px}
    .sg{display:flex;justify-content:space-between;align-items:flex-end;padding:12px 26px 4px}.sg svg{width:24px;height:24px;opacity:.5;margin-bottom:2px}.sg span{border-top:1px solid #000;width:26%;text-align:center;font-size:9.5px;padding-top:2px}
    .ft{display:flex;align-items:center;justify-content:center;gap:7px;margin:0 16px;padding:3px 0 5px;border-top:.8px solid #000;font-size:10px;position:relative}.ft img{height:17px;filter:brightness(0)}.ft b{font-size:10.5px}.ft u{width:4px;height:4px;border-radius:50%;background:#000}.ft span{font-style:italic;letter-spacing:.3px}
    .rb{border:1px solid #000;border-radius:10px;padding:5px 12px 4px;display:flex;flex-direction:column;gap:3px;background:rgba(255,255,255,.9)}.rh{font-weight:700;font-size:11.5px}.rh small{font-size:9.5px}
    .rr{display:flex;align-items:center;gap:10px}.rr span{width:120px;font-size:11px}.rt{flex:1;height:10px;border:1.3px solid #000;border-radius:6px;overflow:hidden}.rt i{display:block;height:100%;background:#000}.rr b{width:52px;text-align:right;font-size:12.5px}.rr b small{font-size:9.5px}.rn{font-size:9.5px;text-align:right}
    .rb+.gp{display:none}.rb{padding:4px 12px 3px;gap:2px}.rr{gap:8px}.rr span{font-size:10.5px}.rt{height:9px}.rn{font-size:9px}`;
  // Two cards per A4 sheet (each card is one A5 half), with a cut line. The print dialog also offers "Save as PDF".
  async function printCards(cards, title, noRank = false) {
    if (noRank) cards = cards.map(c => ({ ...c, noRank: true }));
    const w = window.open('', '_blank');
    if (!w) return toast('পপআপ বন্ধ আছে, প্রিন্ট খোলা যায়নি');
    await loadLogo();
    const pages = chunks(cards, 2).map(p => `<section>${p.map(c => cardHtml(c, { print: true })).join('')}<div class="cut"><span>✂</span></div></section>`).join('');
    w.document.write(`<!doctype html><html lang="bn"><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:A4;margin:0}${CSS}
      section{page-break-after:always;height:297mm;position:relative}section:last-child{page-break-after:auto}
      .cut{position:absolute;left:0;right:0;top:148.5mm;border-top:1px dashed #000;height:0}.cut span{position:absolute;left:5mm;top:-9px;font-size:13px;background:#fff;padding:0 3px}
    </style></head><body>${pages}<script>onload=()=>{setTimeout(()=>print(),400)}<\/script></body></html>`);
    w.document.close();
  }
  // Send one card to a phone as a picture (WhatsApp, Messenger, …). Falls back to saving the picture.
  async function shareCard(c) {
    try {
      await loadLogo();
      const W = 794, H = 561, name = (c.data?.name || 'card') + '.png';
      const html = `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${W}px;height:${H}px;background:#fff"><style>${CSS}.pc{width:${W}px;height:${H}px}</style>${cardHtml(c, { print: true })}</div>`;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 2}" height="${H * 2}"><foreignObject width="${W}" height="${H}" transform="scale(2)">${html}</foreignObject></svg>`;
      const img = new Image();
      await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
      const cv = document.createElement('canvas'); cv.width = W * 2; cv.height = H * 2;
      const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0);
      const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
      const file = new File([blob], name, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: c.title || 'রিপোর্ট কার্ড' }); return; }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); toast('ছবি সেভ হয়েছে');
    } catch (e) { if (e?.name !== 'AbortError') toast('পাঠানো যায়নি, "প্রিন্ট / PDF" চেপে দেখুন'); }
  }

  // ---------- guardian / student: published cards ----------
  SCREENS.myreports = { title: 'রিপোর্ট কার্ড', render: async (el, sid) => {
    if (!sid && S.me.role === 'student') sid = (await sel('students', `select=id&profile_id=eq.${S.uid}&limit=1`))[0]?.id;
    if (!sid) { el.innerHTML = empty('document', 'এখনো কোনো রিপোর্ট কার্ড প্রকাশ হয়নি। প্রতি সপ্তাহের মডেল টেস্টের পর এখানে আসবে।'); return; }
    const cards = await sel('report_cards', `select=${COLS}&student_id=eq.${sid}&order=period_to.desc&limit=40`);
    if (!cards.length) { el.innerHTML = empty('document', 'এখনো কোনো রিপোর্ট কার্ড প্রকাশ হয়নি। প্রতি সপ্তাহের মডেল টেস্টের পর এখানে আসবে।'); return; }
    el.innerHTML = cards.map(c => cardHtml(c) + `<div class="chips" style="margin:-4px 0 12px">${c.seen_at ? pill('✓ দেখেছেন (' + fmtDate(c.seen_at) + ')', 'teal') : S.me.role === 'guardian' ? `<button class="pill sun" data-seen="${c.id}">দেখেছি</button>` : ''}<button class="pill" data-pdf="${c.id}">প্রিন্ট / PDF</button><button class="pill teal" data-share="${c.id}">মোবাইলে পাঠান</button></div>`).join('');
    el.querySelectorAll('[data-seen]').forEach(b => b.onclick = async () => { b.disabled = true; try { await rpc('mark_report_seen', { p_id: b.dataset.seen }); render(); } catch { b.disabled = false; toast('পাঠানো যায়নি'); } });
    el.querySelectorAll('[data-share]').forEach(b => b.onclick = () => shareCard(cards.find(x => x.id === b.dataset.share)));
    el.querySelectorAll('[data-pdf]').forEach(b => b.onclick = () => { const c = cards.find(x => x.id === b.dataset.pdf); printCards([c], c.title || 'রিপোর্ট কার্ড'); });
  } };

  if (typeof T === 'undefined') return; // the rest is for staff only

  // ---------- staff: build drafts, print, publish (ReportsAdminScreen) ----------
  // Scores, ranks and awards come from SQL (compute_report_scores). The app assembles the card lines
  // from the marks, saves drafts (save_report_drafts) and shows what the server stored.
  const RP = { kind: 'weekly', cls: 6, fri: null, from: null, to: null };
  async function loadPeriod(cls, from, to) {
    const studs = T.sortRoster((await T.allStudents()).filter(s => s.class_level === cls));
    const ids = studs.map(s => s.id);
    const exams = await sel('exams', `select=id,title,exam_date,full_marks,subject:subjects(name,name_bn)&class_level=eq.${cls}&exam_date=gte.${from}&exam_date=lte.${to}&order=exam_date&limit=300`);
    const marks = exams.length ? await sel('marks', `select=exam_id,student_id,obtained&exam_id=${inList(exams.map(e => e.id))}&limit=20000`) : [];
    const em = exams.map(e => ({ exam: e, subject: e.subject?.name_bn || e.subject?.name || '', marks: Object.fromEntries(marks.filter(m => m.exam_id === e.id).map(m => [m.student_id, m.obtained == null ? null : +m.obtained])) }));
    let ratings = [];
    for (const part of chunks(ids, 150)) {
      ratings = ratings.concat(await sel('class_ratings', `select=student_id,behavior,homework,performance&day=gte.${from}&day=lte.${to}&student_id=${inList(part)}&limit=5000`));
    }
    return { studs, exams: em, ratings };
  }
  // Card lines and names from the marks (data only, no score). Same shape as the rows the server stores.
  function draftRows(kind, from, to, cls, d, prev) {
    const rBy = d.ratings.reduce((m, x) => ((m[x.student_id] ||= []).push(x), m), {});
    const prevSub = {}; (prev?.exams || []).forEach(e => { if (!(e.subject in prevSub)) prevSub[e.subject] = e; });
    const sorted = d.exams.slice().sort((a, b) => (a.exam.exam_date || '').localeCompare(b.exam.exam_date || '') || a.subject.localeCompare(b.subject));
    return d.studs.map(s => {
      const rs = rBy[s.id] || [];
      const lines = sorted.map(e => { const p = kind === 'weekly' ? prevSub[e.subject] : null;
        return { s: e.subject || e.exam.title, d: e.exam.exam_date, f: +e.exam.full_marks, o: e.marks[s.id] ?? null, p: p ? p.marks[s.id] ?? null : null, pf: p ? +p.exam.full_marks : null }; });
      return { student_id: s.id, kind, title: KIND[kind], period_from: from, period_to: to, class_level: cls,
        data: { name: T.nameOf(s), roll: s.roll || '', batch: shiftBn(s.batch?.shift), lines,
          b: avg(rs.map(r => +r.behavior)), h: avg(rs.map(r => +r.homework)), pe: avg(rs.map(r => +r.performance)) } };
    });
  }

  SCREENS['a.reports'] = { title: 'রিপোর্ট কার্ড', sub: 'সাপ্তাহিক ও মডেল টেস্ট সিরিজ', render: async (el) => {
    RP.fri ||= lastFriday(); RP.from ||= monthStart(); RP.to ||= dhakaToday();
    const weekly = RP.kind === 'weekly';
    const from = weekly ? addDays(RP.fri, -6) : RP.from, to = weekly ? RP.fri : RP.to, cls = RP.cls;
    let h = chipRow([['weekly', 'সাপ্তাহিক'], ['series', 'মডেল টেস্ট সিরিজ']], RP.kind, 'data-kind') + chipRow(CLASSES.map(c => [c, 'ক্লাস ' + bn(c)]), cls, 'data-cls');
    h += weekly ? `<div class="mute small">কোন সপ্তাহ (শনি – শুক্র)</div>${chipRow([0, 1, 2, 3, 4, 5].map(i => { const f = addDays(lastFriday(), -7 * i); return [f, fmtDate(f)]; }), RP.fri, 'data-fri')}`
      : `<div class="formrow"><div><label>শুরু</label><input type="date" id="rf" value="${RP.from}"></div><div><label>শেষ</label><input type="date" id="rt" value="${RP.to}"></div></div>`;
    h += `<div class="mute small">${range(from, to)} · নিয়ম: নম্বর ৬০% + রেটিং ৪০%</div>`;
    el.innerHTML = h + skel(3);
    const [d, rows] = await Promise.all([
      loadPeriod(cls, from, to),
      sel('report_cards', `select=${COLS}&class_level=eq.${cls}&kind=eq.${RP.kind}&period_from=eq.${from}&period_to=eq.${to}&limit=500`).catch(() => []),
    ]);
    const drafts = rows.filter(r => r.status === 'draft'), pubd = rows.filter(r => r.status === 'published');
    const sorted = rows.slice().sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || (a.data?.name || '').localeCompare(b.data?.name || ''));
    const gaps = d.exams.map(e => [e.subject || e.exam.title, d.studs.filter(s => !(s.id in e.marks)).length]).filter(g => g[1] > 0);
    h += `<div class="card ${gaps.length || !d.exams.length ? 'sun' : 'teal'}">${!d.exams.length ? `এই সময়ে ক্লাস ${bn(cls)} এর কোনো পরীক্ষা পাওয়া যায়নি। কার্ড শুধু রেটিং দিয়ে হবে। পরীক্ষা যোগ করতে: নম্বর ইনপুট।`
      : `<div>পরীক্ষা ${bn(d.exams.length)} টি: ${esc(d.exams.map(e => e.subject || e.exam.title).join(', '))}</div>${gaps.length ? gaps.map(([s, n]) => `<div>• ${esc(s)}: ${bn(n)} জনের নম্বর এখনো দেওয়া হয়নি</div>`).join('') : '<div>সব নম্বর দেওয়া আছে।</div>'}`}</div>`;
    if (rows.length) h += `<div class="card ${drafts.length ? 'sun' : 'teal'}">${drafts.length ? `খসড়া ${bn(drafts.length)} টি কার্ড, এখনো অভিভাবকদের কাছে যায়নি। দেখে নিয়ে প্রকাশ করুন।` : `সব ${bn(pubd.length)} টি কার্ড প্রকাশিত।`}</div>`;
    h += `<button class="btn ghost" id="build">${rows.length ? 'খসড়া হালনাগাদ করুন (প্রকাশিত কার্ড বদলাবে না)' : 'খসড়া কার্ড তৈরি করুন'}</button>
      <button class="btn" id="pall" ${rows.length ? '' : 'disabled'}>ক্লাসে অবস্থানসহ প্রিন্ট করুন (এক পাতায় ২টি)</button>
      <button class="btn ghost" id="pall2" ${rows.length ? '' : 'disabled'}>ক্লাসে অবস্থান ছাড়া প্রিন্ট করুন (এক পাতায় ২টি)</button>
      ${isAdmin() ? `<button class="btn sun" id="pub" ${drafts.length ? '' : 'disabled'}>অভিভাবকদের অ্যাপে প্রকাশ করুন</button>` : ''}`;
    if (pubd.length) { const seen = pubd.filter(p => p.seen_at); h += `<div class="card"><h3>অভিভাবক দেখেছেন: ${bn(seen.length)} / ${bn(pubd.length)} জন</h3>${pubd.length > seen.length ? `<div class="mute small">এখনো দেখেননি: ${esc(pubd.filter(p => !p.seen_at).map(p => p.data?.name || '').join(', '))}</div>` : ''}</div>`; }
    if (isAdmin()) h += '<div id="rem"></div>';
    h += `<button class="btn ghost" id="oldb">আগের প্রকাশিত রিপোর্ট দেখুন (ক্লাস ${bn(cls)})</button><div id="old"></div>`;
    h += section('ক্লাসে অবস্থান') + (sorted.map(c => { const x = c.data || {}, lines = x.lines || []; return `<div class="card" style="display:flex;gap:10px;align-items:center"><b style="min-width:42px">${c.rank ? rankBn(c.rank) : '—'}</b><div style="flex:1"><h3>${esc(x.name || '')}${c.status === 'draft' ? ' <span class="mute small">(খসড়া)</span>' : ''}</h3>
      <div class="mute small">নম্বর ${num(lines.reduce((s, l) => s + (l.o || 0), 0))}/${num(lines.reduce((s, l) => s + l.f, 0))} · রেটিং ${x.rating == null ? '—' : d1(x.rating)} · উপস্থিত ${bn(x.present || 0)}/${bn(x.days || 0)}</div>
      ${c.award === 'topper' ? pill('★ ক্লাস টপার', 'sun') : c.award === 'improved' ? pill('↑ সবচেয়ে উন্নতি', 'teal') : ''}
      ${isAdmin() && c.status === 'published' ? `<div class="chips"><button class="pill" data-fix="${c.id}">সংশোধন</button></div>` : ''}</div><b>${x.score == null ? '—' : d1(x.score)}</b></div>`; }).join('') || empty('school', 'এই ক্লাসে কোনো শিক্ষার্থী নেই।'));
    el.innerHTML = h;
    el.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => { RP.kind = b.dataset.kind; render(); });
    el.querySelectorAll('[data-cls]').forEach(b => b.onclick = () => { RP.cls = +b.dataset.cls; render(); });
    el.querySelectorAll('[data-fri]').forEach(b => b.onclick = () => { RP.fri = b.dataset.fri; render(); });
    const rf = el.querySelector('#rf'), rt = el.querySelector('#rt');
    if (rf) rf.onchange = () => { if (rf.value) { RP.from = rf.value; render(); } };
    if (rt) rt.onchange = () => { if (rt.value) { RP.to = rt.value; render(); } };
    const bb = el.querySelector('#build');
    bb.onclick = async () => {
      bb.disabled = true; bb.textContent = 'তৈরি হচ্ছে…';
      try {
        const [cur, prev] = await Promise.all([loadPeriod(cls, from, to), weekly ? loadPeriod(cls, addDays(from, -7), addDays(to, -7)) : null]);
        await rpc('save_report_drafts', { p_rows: draftRows(RP.kind, from, to, cls, cur, prev) });
        // Ranks and scores are computed by the server; only the admin may run it.
        if (isAdmin()) {
          const one = (await sel('report_cards', `select=id&class_level=eq.${cls}&kind=eq.${RP.kind}&period_from=eq.${from}&period_to=eq.${to}&limit=1`))[0];
          if (one) await rpc('compute_report_scores', { p_report_id: one.id });
        }
        toast('খসড়া তৈরি হয়েছে। প্রকাশের আগে দেখে নিন।'); render();
      } catch { toast('খসড়া তৈরি করা যায়নি। আবার চেষ্টা করুন।'); bb.disabled = false; bb.textContent = rows.length ? 'খসড়া হালনাগাদ করুন (প্রকাশিত কার্ড বদলাবে না)' : 'খসড়া কার্ড তৈরি করুন'; }
    };
    el.querySelector('#pall').onclick = () => printCards(sorted, 'রিপোর্ট কার্ড · ক্লাস ' + bn(cls));
    el.querySelector('#pall2').onclick = () => printCards(sorted, 'রিপোর্ট কার্ড · ক্লাস ' + bn(cls), true);
    // Admin only: correct the marks on a published card. The DB trigger (20-report-status) queues the guardian notice.
    el.querySelectorAll('[data-fix]').forEach(b => b.onclick = () => {
      const c = rows.find(x => x.id === b.dataset.fix), lines = c?.data?.lines || [];
      sheet(`<h2>সংশোধন · ${esc(c?.data?.name || '')}</h2><div class="mute small">প্রকাশিত কার্ডের নম্বর বদলালে অভিভাবকের কাছে সংশোধনের বার্তা যাবে।</div>
        ${lines.map((l, i) => `<label>${esc(l.s)} (পূর্ণমান ${num(l.f)})</label><input id="fx${i}" inputmode="numeric" value="${l.o == null ? '' : esc(l.o)}">`).join('') || '<div class="mute">এই কার্ডে বিষয় নেই।</div>'}
        <button class="btn" id="fxok">সংরক্ষণ করুন</button><button class="link" data-close>বাতিল</button>`, (s, close) => {
        s.querySelector('#fxok').onclick = async () => {
          const next = lines.map((l, i) => { const v = ascii(s.querySelector('#fx' + i).value).trim(); return { ...l, o: v === '' ? null : +v }; });
          if (next.some(l => l.o != null && (!Number.isFinite(l.o) || l.o < 0 || l.o > l.f))) return toast('নম্বর ঠিক নেই');
          if (JSON.stringify(next) === JSON.stringify(lines)) return close();
          try {
            await raw('PATCH', `/rest/v1/report_cards?id=eq.${c.id}&status=eq.published`, { data: { ...c.data, lines: next } }, { prefer: 'return=minimal' });
            close(); toast('সংশোধন হয়েছে। অভিভাবকদের জানানো হবে।'); render();
          } catch { toast('সংশোধন করা যায়নি। আবার চেষ্টা করুন।'); }
        };
      });
    });
    const pb = el.querySelector('#pub');
    if (pb) pb.onclick = async () => {
      pb.disabled = true; pb.textContent = 'প্রকাশ হচ্ছে…';
      try {
        await raw('PATCH', `/rest/v1/report_cards?class_level=eq.${cls}&kind=eq.${RP.kind}&period_from=eq.${from}&period_to=eq.${to}&status=eq.draft`,
          { status: 'published', published_by: S.uid, published_at: new Date().toISOString() }, { prefer: 'return=minimal' });
        toast('প্রকাশ হয়ে গেছে। অভিভাবকরা কার্ড দেখে "দেখেছি" চাপবেন।'); render();
      } catch { toast('প্রকাশ করা যায়নি। আবার চেষ্টা করুন।'); pb.disabled = false; pb.textContent = 'অভিভাবকদের অ্যাপে প্রকাশ করুন'; }
    };
    el.querySelector('#oldb').onclick = async () => {
      const box = el.querySelector('#old'); box.innerHTML = skel(2);
      const rows = await sel('report_cards', `select=kind,period_from,period_to,seen_at&class_level=eq.${cls}&status=eq.published&order=period_to.desc&limit=5000`).catch(() => []);
      const per = {}; rows.forEach(r => { const k = `${r.kind}|${r.period_from}|${r.period_to}`; const x = per[k] ||= { kind: r.kind, from: r.period_from, to: r.period_to, n: 0, seen: 0 }; x.n++; if (r.seen_at) x.seen++; });
      const list = Object.values(per);
      box.innerHTML = section(`আগের প্রকাশিত রিপোর্ট · ক্লাস ${bn(cls)}`) + (list.map(p => `<div class="card"><div class="mute small">${KIND[p.kind]} · দেখেছেন ${bn(p.seen)}/${bn(p.n)}</div><h3>${range(p.from, p.to)}</h3>
        <div class="chips"><button class="pill teal" data-open="${p.kind}|${p.from}|${p.to}">খুলুন</button><button class="pill" data-reprint="${p.kind}|${p.from}|${p.to}">আবার প্রিন্ট</button><button class="pill" data-reprint2="${p.kind}|${p.from}|${p.to}">অবস্থান ছাড়া প্রিন্ট</button></div></div>`).join('') || empty('document', 'এই ক্লাসের কোনো রিপোর্ট এখনো প্রকাশ হয়নি।'));
      box.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { const [k, f, t] = b.dataset.open.split('|'); RP.kind = k; if (k === 'weekly') RP.fri = t; else { RP.from = f; RP.to = t; } render(); });
      box.querySelectorAll('[data-reprint],[data-reprint2]').forEach(b => b.onclick = async () => {
        const [k, f, t] = (b.dataset.reprint || b.dataset.reprint2).split('|');
        const cs = await sel('report_cards', `select=${COLS}&class_level=eq.${cls}&kind=eq.${k}&period_from=eq.${f}&period_to=eq.${t}&status=eq.published&limit=500`).catch(() => []);
        printCards(cs.sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9)), 'রিপোর্ট কার্ড · ক্লাস ' + bn(cls), 'reprint2' in b.dataset);
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
          toast('সংরক্ষণ হয়ে গেছে।'); st.open = false; draw();
        } catch { toast('সংরক্ষণ হয়নি।'); }
      };
    };
    draw();
  }
})();

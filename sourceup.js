'use strict';
// Teacher file upload → questions. A PDF (split in the browser with pdf-lib), images or text become parts. Per part:
// the storage object first, then its source_jobs row. The extract-source worker turns each job into pending questions
// (source_items), which the approval screen (qapprove.js) handles. Screens: t.sourceup (form, progress, result) and
// t.sourceup.list (recent sources, run the worker, delete). Pure helpers are on window.SU for a Node test.
(function () {
  const PART_CHARS = 30000;                                  // text per part (text_body limit is 100000)
  const PDF_CHUNK = 3, PDF_KEEP = 12 * 1024 * 1024;          // pages per chunk; a bigger chunk is retried as 2, then 1 page
  const PDF_WARN = 40 * 1024 * 1024, PDF_MAX = 60 * 1024 * 1024;
  const IMG_MAX = 40, IMG_SIDE = 2000, IMG_Q = 0.82, IMG_KEEP = 12 * 1024 * 1024, STORE_MAX = 20 * 1024 * 1024;
  const TEXT_MAX = 300000;                                    // characters per source (keeps strings and requests sane)
  const STALE_MS = 30 * 60e3;
  const TOAST_ERR = 'হয়নি, আবার চেষ্টা করুন';
  const LIB_ERR = 'PDF সাপোর্ট লোড হয়নি; নেট দেখে আবার চেষ্টা করুন';
  const DOCX_MSG = 'ওয়ার্ড (docx) ফাইল এখনো সমর্থিত নয়; লেখা কপি করে পেস্ট করুন বা PDF করে দিন।';
  const PII_LABEL = 'এই ফাইলে কোনো ছাত্রের নাম, ফোন নম্বর বা নম্বরপত্র নেই — এটি পাঠ্যবই, গাইড বা প্রশ্নপত্র।';
  const WARN = 'ফাইল ফ্রি Gemini API-তে পাঠানো হয় এবং Google তা সেবার উন্নয়নে ব্যবহার করতে পারে। ছাত্রের ব্যক্তিগত তথ্য থাকলে আপলোড করবেন না।';
  const QUOTA_MSG = 'আজকের ফ্রি সীমা শেষ। কাল আবার চালু হবে, পাতাটি খুলে \'চালু করুন\' চাপুন।';
  const SU_STAT = { uploading: 'আপলোড হচ্ছে', queued: 'অপেক্ষায়', processing: 'চলছে', done: 'সম্পন্ন', partial: 'আংশিক', failed: 'ব্যর্থ', retracted: 'প্রত্যাহার করা' };
  const JOB_STAT = { queued: 'অপেক্ষায়', extracting: 'চলছে / পরে আবার চেষ্টা হবে', done: 'সম্পন্ন', partial: 'আংশিক', failed: 'ব্যর্থ', quota_wait: 'ফ্রি সীমা শেষ' };
  // the server deletes the chunk file after these final outcomes: no retry, only delete and upload again
  const NO_RETRY = ['personal_data', 'bad_type', 'too_large', 'max_attempts', 'file_removed'];
  const canRetry = j => j.status === 'failed' && (+j.attempts || 0) < 3 && !NO_RETRY.includes(j.error_code);
  const RETRY_MSG = 'সাময়িক সমস্যা, কয়েক মিনিট পরে আবার চেষ্টা হবে। পাতাটি খুলে "চালু করুন" চাপুন।';
  const KIND_BN = { pdf: 'PDF', image: 'ছবি', text: 'লেখা', docx: 'ওয়ার্ড', youtube: 'ভিডিও', typed_paper: 'টাইপ করা প্রশ্নপত্র' };
  const ERRTXT = { too_large: 'ফাইলের অংশটি খুব বড়', bad_type: 'ফাইলের ধরন সমর্থিত নয়', blocked: 'AI এই অংশ পড়তে চায়নি', truncated: 'উত্তর অসম্পূর্ণ এল, আবার চেষ্টা করুন', bad_json: 'AI-এর উত্তর বোঝা যায়নি', ai_error: 'AI সেবায় সমস্যা', personal_data: 'এই অংশে ছাত্রের ব্যক্তিগত তথ্য পাওয়া গেছে, তাই বাদ দেওয়া হয়েছে', lease_lost: 'অন্য একটি কাজ এই অংশ নিয়ে নিয়েছে', timeout: 'সময় শেষ', quota: 'ফ্রি সীমা শেষ', max_attempts: 'তিনবার চেষ্টা করেও হয়নি', file_removed: 'ফাইলটি আগেই মুছে ফেলা হয়েছে; আবার আপলোড করুন', ai_transient: 'সাময়িক সমস্যা' };

  // ---------- pure helpers (no DOM; Node test uses these) ----------
  /** 1-based inclusive page ranges from..to, each of up to size pages; a range shares its last page with the next one (size 1: no sharing). */
  const planRanges = (from, to, size) => {
    const out = [], step = size > 1 ? size - 1 : 1;
    for (let s = from; ;) { const e = Math.min(s + size - 1, to); out.push({ a: s, b: e }); if (e >= to) break; s += step; }
    return out;
  };
  /** PDF chunk plan: 3 pages, 1 page overlap, optional range. 25 pages -> 1-3, 3-5, ..., 23-25; 4 pages -> 1-3, 3-4. */
  const planPages = (total, from, to) => planRanges(from || 1, to || total, PDF_CHUNK);
  /** Minutes shown before the teacher submits: 40 s per part on average, at least 1. */
  const estMinutes = n => Math.max(1, Math.ceil(n * 40 / 60));
  /** Milliseconds as mm:ss (ASCII digits; the screen shows them in Bangla). */
  const mmss = ms => { const s = Math.floor(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  /** Splits text into parts of at most max characters, cut only between paragraphs (a longer paragraph between lines, a longer line by characters). */
  function splitText(text, max = PART_CHARS) {
    const units = [];                                       // [joiner before, text]
    const paras = String(text ?? '').replace(/\r\n?/g, '\n').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    for (const p of paras) {
      if (p.length <= max) { units.push(['\n\n', p]); continue; }
      let first = true;
      for (const line of p.split('\n').map(l => l.trim()).filter(Boolean)) {
        for (let k = 0; k < line.length; k += max) { units.push([k ? '' : first ? '\n\n' : '\n', line.slice(k, k + max)]); first = false; }
      }
    }
    const out = []; let cur = null;
    for (const [j, t] of units) {
      if (cur === null) cur = t;
      else if (cur.length + j.length + t.length <= max) cur += j + t;
      else { out.push(cur); cur = t; }
    }
    if (cur !== null) out.push(cur);
    return out;
  }
  /** Storage object path: <coaching_id>/<source_id>/<part_no>.<ext>. */
  function storagePath(coaching, source, part, ext) {
    if (!['pdf', 'jpg', 'png', 'webp'].includes(ext)) throw new Error('bad ext ' + ext);
    return `${coaching}/${source}/${part}.${ext}`;
  }
  /** A page number typed with Bangla or ASCII digits, or null. */
  const pageNo = v => { const s = ascii(v).trim(); return /^\d{1,5}$/.test(s) ? +s : null; };
  /** The chosen range {from, to} of a PDF with `total` pages; blank = the whole side; null when not valid. */
  function pageRange(fromRaw, toRaw, total) {
    const f = String(fromRaw ?? '').trim() === '' ? 1 : pageNo(fromRaw);
    const t = String(toRaw ?? '').trim() === '' ? total : pageNo(toRaw);
    if (f == null || t == null || f < 1 || t > total || f > t) return null;
    return { from: f, to: t };
  }
  window.SU = { planRanges, planPages, splitText, storagePath, pageNo, pageRange, estMinutes, mmss };

  // ---------- shared run state (module level: a run goes on while the teacher moves between the two screens) ----------
  const RUN = { busy: false, host: null, html: '', snap: null, refresh: null };   // refresh: the form's refresh of the screen open now
  const alive = () => RUN.busy && !!S.me;                   // the worker loop goes on while a run is busy and someone is signed in
  const bnErr = msg => Object.assign(new Error(msg), { su: true });
  const msgOf = e => e.su ? e.message : e.status === 401 ? 'আবার লগইন করুন' : e.status ? 'সার্ভার সাড়া দেয়নি, আবার চেষ্টা করুন' : 'ইন্টারনেট সংযোগ দেখুন';
  const tick = () => new Promise(r => setTimeout(r, 0));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const runHtml = (line, frac, extra = '') => line ? `<div class="card su-run"><h3>${esc(line)}</h3>${bar(Math.min(1, frac || 0))}${extra}</div>` : '';
  /** Shows RUN.html in the run host. bind=false when the app's render() binds the [data-go] buttons after attaching the screen. */
  function drawRun(bind = true) { const h = RUN.host; if (!h) return; h.innerHTML = RUN.html; if (bind) h.querySelectorAll('[data-go]').forEach(bindGo); }
  function setRun(line, frac, extra = '') { RUN.html = runHtml(line, frac, extra); drawRun(); }
  /** The worker progress line; while a worker call is in flight it also shows that call's elapsed time (mm:ss), once a second. */
  const CLK = { line: '', frac: 0, t0: 0, timer: 0 };
  function clockOff() { clearInterval(CLK.timer); CLK.timer = 0; CLK.t0 = 0; }
  function paintProgress() {
    RUN.html = runHtml(CLK.t0 ? `${CLK.line} · ${bn(mmss(Date.now() - CLK.t0))}` : CLK.line, CLK.frac);
    if (!RUN.host?.isConnected) return clockOff();          // the screen was left: no timer runs for it (the run goes on)
    drawRun();
  }
  function progress(line, frac) { CLK.line = line; CLK.frac = frac; paintProgress(); }
  function clockOn() { clockOff(); CLK.t0 = Date.now(); CLK.timer = setInterval(paintProgress, 1000); paintProgress(); }

  // ---------- browser side: files, PDF, images, text, hashes ----------
  const KIND_OF = f => {
    const n = (f.name || '').toLowerCase(), t = f.type || '';
    if (n.endsWith('.docx')) return 'docx';
    if (t === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
    if (t.startsWith('image/')) return 'image';
    if (n.endsWith('.txt') || n.endsWith('.md') || t === 'text/plain' || t === 'text/markdown') return 'text';
    return null;
  };
  let libP = null;
  /** pdf-lib (vendor/pdf-lib.min.js, 1.17.1) is loaded the first time a PDF is chosen; not in the service worker shell. */
  function pdfLib() {
    if (window.PDFLib) return Promise.resolve(window.PDFLib);
    return libP ||= new Promise((ok, no) => {
      const s = document.createElement('script');
      s.src = 'vendor/pdf-lib.min.js';
      s.onload = () => { if (window.PDFLib) ok(window.PDFLib); else { libP = null; no(bnErr(LIB_ERR)); } };
      s.onerror = () => { libP = null; s.remove(); no(bnErr(LIB_ERR)); };
      document.head.appendChild(s);
    });
  }
  async function loadPdf(file) {
    const L = await pdfLib();
    const buf = await file.arrayBuffer(), hash = await digestHex(buf);     // the file is read once: the hash and the parse use the same bytes
    const doc = await L.PDFDocument.load(buf, { updateMetadata: false });
    return { doc, pages: doc.getPageCount(), hash };
  }
  /** Pages a..b of the original PDF as a new PDF (Uint8Array). */
  async function pdfBytes(doc, a, b) {
    const L = await pdfLib(), out = await L.PDFDocument.create();
    const idx = []; for (let p = a; p <= b; p++) idx.push(p - 1);
    (await out.copyPages(doc, idx)).forEach(pg => out.addPage(pg));
    return out.save({ useObjectStreams: true });
  }
  /** One range as a PDF piece; too big -> 2-page pieces, then 1-page pieces, then a Bangla error. One piece in memory at a time. */
  async function* pdfPieces(doc, r, level) {
    await tick();
    const bytes = await pdfBytes(doc, r.a, r.b);
    if (bytes.byteLength <= PDF_KEEP) { yield { a: r.a, b: r.b, bytes }; return; }
    if (level >= 2) throw bnErr('PDF-এর একটি পৃষ্ঠা খুব বড়; ফাইলটি ছোট করে আবার দিন');
    for (const s of planRanges(r.a, r.b, level === 0 ? 2 : 1)) yield* pdfPieces(doc, s, level + 1);
  }
  /** Images: kept as they are when JPEG/PNG/WEBP, small and under 2000 px; otherwise a JPEG resized so the long side is 2000 px. */
  async function imagePart(file) {
    const keep = { 'image/jpeg': ['image/jpeg', 'jpg'], 'image/png': ['image/png', 'png'], 'image/webp': ['image/webp', 'webp'] }[file.type];
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }   // phone photos: the EXIF rotation is applied
    catch { try { bmp = await createImageBitmap(file); } catch { throw bnErr('ছবিটি খোলা যায়নি'); } }
    try {
      const long = Math.max(bmp.width, bmp.height);
      // a JPEG always goes through the canvas (that bakes the rotation in); other kinds are kept as they are when small enough
      if (keep && file.type !== 'image/jpeg' && long <= IMG_SIDE && file.size <= IMG_KEEP) return { blob: file, type: keep[0], ext: keep[1] };
      const k = Math.min(1, IMG_SIDE / long), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise((ok, no) => c.toBlob(b => b ? ok(b) : no(bnErr('ছবি তৈরি করা যায়নি')), 'image/jpeg', IMG_Q));
      c.width = c.height = 0;
      if (blob.size > STORE_MAX) throw bnErr('একটি ছবি খুব বড়; ছোট করে আবার দিন');
      return { blob, type: 'image/jpeg', ext: 'jpg' };
    } finally { bmp.close?.(); }
  }
  const readText = f => new Promise((ok, no) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result || ''));
    r.onerror = () => no(bnErr('ফাইলটি পড়া যায়নি'));
    r.readAsText(f, 'UTF-8');
  });
  const digestHex = async buf => [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map(b => b.toString(16).padStart(2, '0')).join('');
  /** SHA-256 hex of the original bytes; several images: of the concatenated image digests; text: of the text. */
  async function hashOf(snap) {
    if (snap.kind === 'pdf') return snap.pdf.hash;
    if (snap.kind === 'text') return digestHex(new TextEncoder().encode(snap.full));
    if (snap.files.length === 1) return digestHex(await snap.files[0].arrayBuffer());
    const all = new Uint8Array(snap.files.length * 32);
    for (let i = 0; i < snap.files.length; i++) all.set(new Uint8Array(await crypto.subtle.digest('SHA-256', await snap.files[i].arrayBuffer())), i * 32);
    return digestHex(all);
  }
  /** Every part of a source, in order, one at a time: {no, kind, ...}. The PDF plan is decided by the sizes it meets. */
  async function* partsOf(snap) {
    let no = 0;
    if (snap.kind === 'pdf') {
      const { doc, pages } = snap.pdf;
      for (const r of planPages(pages, snap.range.from, snap.range.to)) {
        for await (const p of pdfPieces(doc, r, 0)) yield { no: ++no, kind: 'pdf', type: 'application/pdf', ext: 'pdf', from: p.a, to: p.b, bytes: p.bytes };
      }
    } else if (snap.kind === 'image') {
      for (const f of snap.files) { const im = await imagePart(f); yield { no: ++no, kind: 'image', ...im }; }
    } else {
      for (const t of splitText(snap.full)) yield { no: ++no, kind: 'text', text: t };
    }
  }
  /** Storage object first (upsert: a retry may find it there), then the job row. */
  async function sendPart(snap, p, sid, coach) {
    const row = { coaching_id: coach, source_id: sid, part_no: p.no, status: 'queued' };
    if (p.kind === 'text') row.text_body = p.text;
    else {
      const path = storagePath(coach, sid, p.no, p.ext);
      await upload('sources', path, p.blob || new Blob([p.bytes], { type: p.type }), p.type, true);
      row.storage_path = path;
      p.bytes = null; p.blob = null;
    }
    if (p.from) { row.page_from = p.from; row.page_to = p.to; }
    await ins('source_jobs', row, 'select=id');
  }
  async function existingParts(sid) {
    const rows = await sel('source_jobs', `select=part_no&source_id=eq.${enc(sid)}&limit=1000`);
    return new Set(rows.map(r => r.part_no));
  }

  // ---------- the worker loop (shared by both screens) ----------
  /** Calls the worker one job at a time until nothing is due, the quota is out, 3 errors in a row, or the screen changed. */
  const CALL_MS = 170000;                                   // one worker call; a longer one counts as an error
  const withTimeout = (p, ms) => { let t; return Promise.race([p, new Promise((_, no) => { t = setTimeout(() => no(new Error('timeout')), ms); })]).finally(() => clearTimeout(t)); };
  /** Holds a screen wake lock while the worker runs (best effort: not every browser has it). */
  async function runWorker(onEvent, alive) {
    let lock = null, done = false;
    navigator.wakeLock?.request('screen').then(l => { if (done) l.release().catch(() => {}); else lock = l; }).catch(() => {});
    try { return await workerLoop(onEvent, alive); }
    finally { done = true; clockOff(); lock?.release().catch(() => {}); }
  }
  /** Calls the worker one job at a time until nothing is due, the quota is out, 3 errors in a row, or the run is over. */
  async function workerLoop(onEvent, alive) {
    let fails = 0;
    for (let i = 0; i < 500; i++) {
      if (!alive()) return { stop: 'gone' };
      let r;
      clockOn();                                              // the elapsed time of this call is shown while it is in flight
      try { r = await withTimeout(fn('extract-source', { action: 'process' }), CALL_MS); fails = 0; }
      catch (e) {
        clockOff();
        if (e.status === 401) return { stop: 'auth' };
        if (++fails >= 3) return { stop: 'error', err: e };
        await sleep(2000);
        continue;
      }
      clockOff();
      const waiting = +(r?.waiting_jobs) || 0;                  // parts that are not due yet
      if (!r || r.state !== 'processed') return { stop: 'idle', waiting };
      onEvent(r);
      if (r.status === 'quota_wait') return { stop: 'quota', waiting };
      if (r.status === 'retry_later') return { stop: 'retry_later', waiting };   // the job keeps its lease; not called again at once
      if (!(+r.due_jobs > 0)) return { stop: 'done', waiting };
    }
    return { stop: 'limit', waiting: 0 };
  }
  /** The end of a run: quota, errors and the failed parts of this source (sid), with the buttons to the approval page. */
  async function finishRun(res, sid, again) {
    if (res.stop === 'gone') return setRun('কাজ থেমেছে', 0, '<button class="link" data-go="t.sourceup.list">জমা দেওয়া ফাইল দেখুন</button>');
    const lines = [];
    if (res.stop === 'quota') lines.push(QUOTA_MSG);
    if (res.stop === 'auth') lines.push('আবার লগইন করুন');
    if (res.stop === 'retry_later') lines.push(RETRY_MSG);
    if (res.stop === 'error') lines.push('নেট বা সার্ভারে সমস্যা হয়েছে। পাতাটি খুলে আবার \'চালু করুন\' চাপুন।');
    if (res.waiting > 0 && (res.stop === 'idle' || res.stop === 'done')) lines.push('কিছু অংশ পরে আবার চেষ্টা হবে; "চালু করুন" চাপুন');
    let items = 0;
    if (sid) {
      const jobs = await sel('source_jobs', `select=part_no,status,error_code,items_found&source_id=eq.${enc(sid)}&limit=1000`).catch(() => []);
      items = jobs.reduce((a, j) => a + (+j.items_found || 0), 0);
      jobs.filter(j => j.status !== 'done' && j.status !== 'queued').forEach(j => lines.push(`অংশ ${bn(j.part_no)}: ${ERRTXT[j.error_code] || JOB_STAT[j.status] || 'হয়নি'}`));
    }
    const head = res.stop === 'quota' ? 'আজকের কাজ থামানো হয়েছে' : 'প্রশ্ন তোলা শেষ';
    const html = (sid ? `<div class="mute">মোট <b>${esc(bn(items))}</b> টি প্রশ্ন পাওয়া গেছে</div>` : '') +
      lines.map(l => `<div class="attwarn">${esc(l)}</div>`).join('') +
      `<div class="su-acts" style="margin-top:8px"><button class="btn" data-go="t.qapprove">অনুমোদনের পাতায় যান</button>${again ? '<button class="link" data-su="again">আরও ফাইল দিন</button>' : ''}</div>`;
    setRun(head, 1, html);
  }

  // ---------- screen 1: the upload form ----------
  SCREENS['t.sourceup'] = { title: 'প্রশ্ন জমা দিন', sub: 'ফাইল থেকে প্রশ্ন', render: async (el) => {
    const st = { cls: null, subj: '', title: '', titleUser: false, kind: null, files: [], pdf: null, range: null, text: '', pii: false, loading: false, tk: 0 };
    el.innerHTML = `<div class="su-acts"><button class="link" data-go="t.sourceup.list">জমা দেওয়া ফাইল দেখুন</button></div>
      <div class="su-form">
        <div class="card"><h3>কোন ক্লাসের?</h3><div id="su-chips"></div>
          <label>বিষয়</label><select id="su-subj"><option value="">আগে ক্লাস বাছুন</option></select>
          <label>শিরোনাম</label><input id="su-title" maxlength="200" placeholder="যেমন: ষষ্ঠ শ্রেণি · গণিত · মাসিক পরীক্ষা">
        </div>
        <div class="card"><h3>ফাইল বা লেখা</h3>
          <div class="mute small">একটি PDF, অথবা কয়েকটি ছবি, অথবা .txt/.md ফাইল। নিচে লেখাও পেস্ট করা যাবে।</div>
          <div class="su-acts" style="margin-top:8px"><button class="btn ghost" id="su-pick">ফাইল বাছুন</button></div>
          <input type="file" id="su-file" accept=".pdf,image/*,.txt,.md" multiple hidden>
          <div class="mute small" id="su-info"></div>
          <div class="err" id="su-note"></div>
          <div id="su-pr" hidden><label>পাতার পরিসর (ঐচ্ছিক)</label><div class="formrow"><div><label>থেকে</label><input id="su-from" inputmode="numeric" placeholder="১"></div><div><label>পর্যন্ত</label><input id="su-to" inputmode="numeric" placeholder="শেষ পাতা"></div></div><div class="mute small" id="su-est"></div><div class="attwarn" id="su-est2" hidden></div></div>
          <label>লেখা পেস্ট করুন</label><textarea id="su-paste"></textarea>
        </div>
        <div class="card sun"><div class="attwarn">${esc(WARN)}</div></div>
        <label class="su-chk"><input type="checkbox" id="su-pii"><span>${esc(PII_LABEL)}</span></label>
        <div class="mute small" id="su-hint"></div>
        <button class="btn" id="su-go" disabled>জমা দিন ও প্রশ্ন তুলুন</button>
      </div>
      <div id="su-run"></div>`;
    const $$ = s => el.querySelector(s);
    const chipsEl = $$('#su-chips'), subjEl = $$('#su-subj'), titleEl = $$('#su-title'), fileEl = $$('#su-file'), pasteEl = $$('#su-paste');
    const prEl = $$('#su-pr'), fromEl = $$('#su-from'), toEl = $$('#su-to'), infoEl = $$('#su-info'), noteEl = $$('#su-note');
    const estEl = $$('#su-est'), est2El = $$('#su-est2');
    const piiEl = $$('#su-pii'), hintEl = $$('#su-hint'), goEl = $$('#su-go');
    RUN.host = $$('#su-run'); drawRun(false);

    const paintChips = () => { chipsEl.innerHTML = chipRow(CLASSES.map(c => [c, 'ক্লাস ' + bn(c)]), st.cls ?? '', 'data-suc'); };
    const setAutoTitle = name => { if (!st.titleUser) { st.title = name.replace(/\.[^.]+$/, '').slice(0, 200); titleEl.value = st.title; } };
    /** The first thing missing before the form can be sent ('' = ready). */
    const problem = pasted => {
      if (!st.cls) return 'ক্লাস বাছুন';
      if (!st.subj) return 'বিষয় বাছুন';
      if (!st.title.trim()) return 'শিরোনাম দিন';
      if (st.files.length && pasted) return 'ফাইল অথবা লেখা — একটি বাছুন';
      if (!st.files.length && !pasted) return 'ফাইল বাছুন অথবা লেখা পেস্ট করুন';
      if (st.loading) return 'ফাইল পড়া হচ্ছে…';
      if (st.kind === 'pdf' && !st.range) return 'পাতার পরিসর ঠিক করুন';
      if (!st.pii) return 'নিশ্চিত করুন যে ফাইলে ছাত্রের তথ্য নেই';
      return '';
    };
    const refresh = () => {
      const pasted = pasteEl.value.trim();
      if (st.kind === 'pdf' && st.pdf) {
        st.range = pageRange(fromEl.value, toEl.value, st.pdf.pages);
        const n = st.range ? planPages(st.pdf.pages, st.range.from, st.range.to).length : 0;
        infoEl.textContent = `PDF · ${bn(st.pdf.pages)} পৃষ্ঠা` + (st.range ? ` · ${bn(n)}টি অংশ হবে` : ' · পাতার পরিসর ঠিক নয়');
        estEl.textContent = st.range ? `আনুমানিক ${bn(n)} টি অংশ · প্রায় ${bn(estMinutes(n))} মিনিট — এই সময় পাতাটি খোলা রাখুন` : '';
        est2El.hidden = !(st.range && n > 60);
        est2El.textContent = st.range && n > 60 ? 'অনেক পাতা: ফ্রি সীমার কারণে কাজ একাধিক দিনে হতে পারে। পাতার পরিসর দিয়ে শুধু দরকারি অংশ (যেমন অনুশীলনী) বাছুন।' : '';
      } else if (st.kind === 'image') infoEl.textContent = `${bn(st.files.length)}টি ছবি · প্রতিটি ছবি একটি অংশ`;
      else if (st.kind === 'text' && st.files.length) infoEl.textContent = `লেখা · ${bn(st.text.length)} অক্ষর`;
      else infoEl.textContent = '';
      if (!(st.kind === 'pdf' && st.pdf && st.range)) { estEl.textContent = ''; est2El.hidden = true; est2El.textContent = ''; }
      el.querySelectorAll('.su-form input, .su-form select, .su-form textarea, .su-form button').forEach(x => { x.disabled = RUN.busy; });
      const msg = problem(pasted);
      hintEl.textContent = RUN.busy ? 'জমা দেওয়া চলছে…' : msg;
      hintEl.hidden = !(RUN.busy || msg);
      goEl.disabled = !!msg || RUN.busy;
    };
    RUN.refresh = refresh;                                  // the run ends on this screen even if the teacher left and came back
    /** Replaces the file choice: validates kinds, sizes and the PDF page count; a bad choice clears the selection. */
    async function pickFiles(list) {
      const tk = ++st.tk;
      Object.assign(st, { files: [], kind: null, pdf: null, range: null, text: '', loading: false });
      noteEl.textContent = ''; prEl.hidden = true; fromEl.value = ''; toEl.value = '';
      if (!list.length) return refresh();
      const fail = msg => { if (tk !== st.tk) return; Object.assign(st, { files: [], kind: null, pdf: null, range: null, loading: false }); fileEl.value = ''; noteEl.textContent = msg; refresh(); };
      const kinds = list.map(KIND_OF);
      if (kinds.includes('docx')) return fail(DOCX_MSG);
      if (kinds.some(k => !k)) return fail('এই ধরনের ফাইল সমর্থিত নয়। PDF, ছবি বা .txt/.md দিন।');
      if (new Set(kinds).size > 1) return fail('একবারে একই ধরনের ফাইল দিন (PDF, ছবি, অথবা লেখা)।');
      const kind = kinds[0];
      if (kind === 'pdf' && list.length > 1) return fail('একবারে একটি PDF দিন।');
      if (kind === 'image' && list.length > IMG_MAX) return fail(`একবারে সবচেয়ে বেশি ${bn(IMG_MAX)}টি ছবি দেওয়া যাবে।`);
      if (kind === 'pdf') {
        const f = list[0];
        if (f.size > PDF_MAX) return fail('ফাইল ৬০ MB-এর বেশি; কম্পিউটার থেকে তুলুন বা অংশ করে নিন');
        if (f.size > PDF_WARN && !await confirmSheet('বড় ফাইল', `ফাইলটি ${bn((f.size / 1048576).toFixed(0))} MB। এই ফোনে ধীরে চলতে পারে। চালিয়ে যাবেন?`, 'চালিয়ে যান')) return fail('');
        if (tk !== st.tk) return;
        Object.assign(st, { files: list, kind: 'pdf', loading: true }); refresh();
        try {
          const pdf = await loadPdf(f);
          if (tk !== st.tk) return;
          Object.assign(st, { pdf, loading: false }); prEl.hidden = false; setAutoTitle(f.name); refresh();
        } catch (e) { fail(e.su ? e.message : 'PDF খোলা যায়নি; পাসওয়ার্ড দেওয়া বা নষ্ট ফাইল হতে পারে'); }
        return;
      }
      if (kind === 'image') { Object.assign(st, { files: list, kind: 'image' }); setAutoTitle(list[0].name); return refresh(); }
      // text files: read all, then one text (kept under TEXT_MAX)
      Object.assign(st, { files: list, kind: 'text', loading: true }); refresh();
      try {
        const texts = [];
        for (const f of list) texts.push(await readText(f));
        if (tk !== st.tk) return;
        const text = texts.join('\n\n');
        if (text.length > TEXT_MAX) return fail('লেখা খুব বড়; ভাগ করে দিন');
        Object.assign(st, { text, loading: false }); setAutoTitle(list[0].name); refresh();
      } catch (e) { fail(e.su ? e.message : TOAST_ERR); }
    }
    async function loadSubjects() {
      const cls = st.cls;
      subjEl.innerHTML = '<option value="">লোড হচ্ছে…</option>';
      try {
        const rows = await sel('subjects', `select=id,name,name_bn&class_level=eq.${enc(cls)}&order=name`);
        if (cls !== st.cls) return;
        subjEl.innerHTML = '<option value="">বিষয় বাছুন</option>' + rows.map(s => `<option value="${esc(s.id)}">${esc(s.name_bn || s.name)}</option>`).join('') + '<option value="none">বিষয় নেই / অন্য</option>';
      } catch { if (cls === st.cls) { subjEl.innerHTML = '<option value="">বিষয় আনা যায়নি</option>'; toast(TOAST_ERR); } }
      refresh();
    }
    async function submit() {
      const pasted = pasteEl.value.trim(), msg = problem(pasted);
      if (msg) return toast(msg);
      if (!navigator.onLine) return toast('ইন্টারনেট লাগবে');
      const kind = st.files.length ? st.kind : 'text';
      const full = kind === 'text' ? (st.files.length ? st.text : pasted) : '';
      if (full.length > TEXT_MAX) return toast('লেখা খুব বড়; ভাগ করে দিন');
      if (kind === 'pdf' && !st.pdf) return toast('ফাইলটি আবার বাছুন');
      const snap = {
        kind, cls: st.cls, subj: st.subj === 'none' ? null : st.subj, title: st.title.trim(),
        url: st.files.length ? st.files.map(f => f.name).join(', ').slice(0, 300) : null,
        files: st.files, pdf: st.pdf, range: st.range, full, sourceId: null, hash: null, at: 0,
        estimate: kind === 'pdf' ? planPages(st.pdf.pages, st.range.from, st.range.to).length : kind === 'image' ? st.files.length : splitText(full).length,
      };
      st.pdf = null;                                        // the parsed PDF now belongs to the run (kept for a retry, released after the upload)
      if (!snap.estimate) return toast('লেখা খালি');
      runSubmit(snap, RUN.refresh);
    }

    paintChips(); refresh();
    el.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b || !el.contains(b) || b.disabled) return;
      if (b.dataset.suc !== undefined) { st.cls = +b.dataset.suc; st.subj = ''; paintChips(); loadSubjects(); return refresh(); }
      if (b.id === 'su-pick') return fileEl.click();
      if (b.id === 'su-go') return submit();
      if (b.dataset.su === 'retry') return retryRun();
      if (b.dataset.su === 'again') { RUN.html = ''; RUN.snap = null; return nav.replace('t.sourceup'); }
    });
    el.addEventListener('change', e => {
      if (e.target === fileEl) pickFiles([...fileEl.files]);
      else if (e.target === subjEl) st.subj = subjEl.value;
      else if (e.target === piiEl) st.pii = piiEl.checked;
      refresh();
    });
    el.addEventListener('input', e => {
      if (e.target === titleEl) { st.titleUser = true; st.title = titleEl.value; }
      refresh();
    });
  } };

  /** The whole upload: sources row (uploading), each part (storage, then job row), then queued and the worker loop. */
  async function runSubmit(snap, refresh) {
    if (RUN.busy) return toast('আরেকটি কাজ চলছে');
    RUN.busy = true; RUN.snap = snap;
    const coach = S.me.coaching_id;
    refresh?.();
    try {
      setRun('ফাইলের তথ্য তৈরি হচ্ছে…', 0);
      snap.hash ||= await hashOf(snap);
      if (!snap.sourceId) {
        try {
          const [row] = await ins('sources', {
            coaching_id: coach, kind: snap.kind, title: snap.title, class_level: snap.cls, subject_id: snap.subj, chapter_id: null,
            file_hash: snap.hash, url: snap.url, parts_total: snap.estimate, pii_ack: true, status: 'uploading',
          }, 'select=id');
          snap.sourceId = row.id;
        } catch (e) {
          if (!(e.status === 409 || /23505/.test(e.body || ''))) throw e;
          // the same file is already there: an unfinished upload (the app was closed) goes on, a finished one is only shown
          const [ex] = await sel('sources', `select=id,status&coaching_id=eq.${enc(coach)}&file_hash=eq.${enc(snap.hash)}&limit=1`);
          if (ex?.status !== 'uploading') {
            RUN.snap = null;
            return setRun('এই ফাইল আগেই জমা দেওয়া হয়েছে', 0, '<button class="link" data-go="t.sourceup.list">জমা দেওয়া ফাইল দেখুন</button>');
          }
          snap.sourceId = ex.id;
        }
      }
      const sid = snap.sourceId;
      if (!snap.uploaded) {                                 // a retry after the upload skips this part
        const have = await existingParts(sid);
        let total = 0;
        for await (const p of partsOf(snap)) {
          total = p.no; snap.at = p.no;
          if (have.has(p.no)) { p.bytes = null; p.blob = null; continue; }
          setRun(`ফাইল পাঠানো হচ্ছে — ${bn(p.no)} নম্বর অংশ`, (p.no - 1) / snap.estimate);
          await sendPart(snap, p, sid, coach);
        }
        if (!total) throw bnErr('ফাইলে পড়ার মতো কিছু পাওয়া যায়নি');
        snap.total = total; snap.uploaded = true; snap.pdf = null;   // every part is up: the parsed PDF is released
      }
      const r = await upd('sources', `id=eq.${enc(sid)}`, { parts_total: snap.total, status: 'queued' });
      if (!r?.length) throw bnErr('অবস্থা বদলানো যায়নি');
      await resetFailed([sid]);                             // a retry: only the failed parts that still have attempts left
      RUN.snap = null; snap.at = 0;
      await processRun(sid, snap.total);
    } catch (e) {
      const at = snap.at ? `${bn(snap.at)} নম্বর অংশ জমা হয়নি। ` : 'জমা দেওয়া হয়নি। ';
      setRun(at + msgOf(e), snap.at ? (snap.at - 1) / snap.estimate : 0, '<div class="su-acts" style="margin-top:8px"><button class="btn" data-su="retry">আবার চেষ্টা</button></div>');
    } finally {
      RUN.busy = false;
      RUN.refresh?.();
    }
  }
  /** Runs the worker for this run's source and shows the result. */
  async function processRun(sid, total) {
    let seen = 0;
    progress(`প্রশ্ন তোলা হচ্ছে — ০/${bn(total)} অংশ`, 0);
    const res = await runWorker(r => {
      if (r.job?.source_id !== sid) return;
      seen++; progress(`প্রশ্ন তোলা হচ্ছে — ${bn(seen)}/${bn(total)} অংশ`, seen / total);
    }, alive);
    await finishRun(res, sid, true);
  }
  /** Failed parts of these sources that still have attempts left go back to the queue (NO_RETRY codes stay failed). Returns how many. */
  async function resetFailed(ids) {
    const old = (await sel('source_jobs', `select=id,attempts,error_code&status=eq.failed&source_id=${inList(ids.map(enc))}&limit=1000`)).filter(canRetry);
    if (old.length) await upd('source_jobs', `id=${inList(old.map(j => enc(j.id)))}`, { status: 'queued', attempts: 0, next_run_at: new Date().toISOString(), error_code: null });
    return old.length;
  }
  /** The retry button of a failed run (on either screen): the same snapshot goes on from where it stopped. */
  function retryRun() { if (!RUN.busy && RUN.snap) runSubmit(RUN.snap, RUN.refresh); }

  // ---------- screen 2: the sources and their state ----------
  /** Every page of a query (1000 rows at a time, like qapprove.js). */
  async function pagedRows(table, q) {
    const out = [];
    for (let off = 0; off < 50000; off += 1000) {
      const page = await sel(table, `${q}&limit=1000&offset=${off}`);
      out.push(...page);
      if (page.length < 1000) break;
    }
    return out;
  }
  /** Removes the stored files of a source (every part under <coaching>/<source>/). A failure leaves the files behind. */
  async function rmFiles(id) {
    const pre = `${S.me.coaching_id}/${id}`;
    const objs = await raw('POST', '/storage/v1/object/list/sources', { prefix: pre, limit: 1000, offset: 0 });
    const names = (objs || []).filter(o => o.name).map(o => `${pre}/${o.name}`);
    if (names.length) await raw('DELETE', '/storage/v1/object/sources', { prefixes: names });
  }
  async function delSource(id) {
    if (!await confirmSheet('মুছবেন?', 'ফাইলটি ও এর অপেক্ষার প্রশ্নগুলো মুছে যাবে। এটি ফেরানো যাবে না।', 'মুছুন', true)) return;
    try { await rmFiles(id).catch(() => {}); await del('sources', `id=eq.${enc(id)}`); toast('মুছে গেছে'); render(); }
    catch { toast(TOAST_ERR); }
  }
  /** The "চালু করুন" button: failed parts with 3 attempts are reset after a confirm, then the worker runs for every due job. */
  async function startWorker(ids) {
    if (RUN.busy) return toast('আরেকটি কাজ চলছে');
    if (!navigator.onLine) return toast('ইন্টারনেট লাগবে');
    RUN.busy = true;
    try {
      const idq = inList(ids.map(enc));
      // only failed parts that still have attempts left and whose file still exists (not the no-retry codes)
      const old = (await sel('source_jobs', `select=id,attempts,error_code&status=eq.failed&source_id=${idq}&limit=1000`)).filter(canRetry);
      if (old.length && !await confirmSheet('আবার চেষ্টা', `${bn(old.length)}টি ব্যর্থ অংশ আবার চেষ্টা হবে।`, 'আবার চেষ্টা')) return;
      if (old.length) await upd('source_jobs', `id=${inList(old.map(j => enc(j.id)))}`, { status: 'queued', attempts: 0, next_run_at: new Date().toISOString(), error_code: null });
      let seen = 0;
      progress('প্রশ্ন তোলা শুরু হচ্ছে…', 0);
      const res = await runWorker(r => { seen++; progress(`প্রশ্ন তোলা হচ্ছে — ${bn(seen)}টি অংশ শেষ`, 0.5); }, alive);
      await finishRun(res, null, false);
      render();
    } catch (e) { setRun(msgOf(e), 0); }
    finally { RUN.busy = false; }
  }
  SCREENS['t.sourceup.list'] = { title: 'জমা দেওয়া ফাইল', sub: 'প্রশ্ন তোলার অবস্থা', render: async (el) => {
    const srcs = await sel('sources', `select=id,title,kind,class_level,status,parts_total,created_at&coaching_id=eq.${enc(S.me.coaching_id)}&order=created_at.desc&limit=30`);
    const ids = srcs.map(s => s.id), q = `source_id=${inList(ids.map(enc))}`;
    const [jobs, pend] = ids.length ? await Promise.all([
      sel('source_jobs', `select=id,source_id,part_no,status,attempts,error_code,items_found&${q}&limit=1000`),
      pagedRows('source_items', `select=source_id&${q}&status=eq.pending`),
    ]) : [[], []];
    const jm = {}, pm = {};
    jobs.forEach(j => (jm[j.source_id] ||= []).push(j));
    pend.forEach(r => { pm[r.source_id] = (pm[r.source_id] || 0) + 1; });
    if (!srcs.length) { el.innerHTML = empty('inbox', 'এখনো কোনো ফাইল জমা দেওয়া হয়নি।') + '<button class="btn" data-go="t.sourceup">নতুন ফাইল দিন</button>'; return; }
    el.innerHTML = `<div class="card"><div class="su-acts"><button class="btn" id="su-start">চালু করুন</button><button class="link" data-go="t.sourceup">নতুন ফাইল</button></div>
        <div class="mute small">প্রশ্ন তোলা বাকি থাকলে এখান থেকে চালু করুন। ব্যর্থ অংশ আবার চেষ্টা করতে হলে নিশ্চিত করতে হবে।</div></div>
      <div id="su-run"></div>` + srcs.map(s => {
      const js = jm[s.id] || [], n = pm[s.id] || 0;
      const stale = s.status === 'uploading' && Date.now() - Date.parse(s.created_at) > STALE_MS;
      const done = js.filter(j => j.status === 'done').length;
      const label = stale ? 'অসম্পূর্ণ আপলোড' : (SU_STAT[s.status] || s.status);
      const tone = stale || s.status === 'failed' ? 'bad' : s.status === 'done' ? 'good' : s.status === 'partial' ? 'sun' : '';
      const errs = stale ? '' : js.filter(j => ['failed', 'partial', 'quota_wait', 'extracting'].includes(j.status))
        .map(j => {
          const hint = j.status === 'failed' && !canRetry(j) ? ' · আবার আপলোড করুন' : '';
          return `<div class="attwarn">অংশ ${esc(bn(j.part_no))}: ${esc((ERRTXT[j.error_code] || JOB_STAT[j.status]) + hint)}</div>`;
        }).join('');
      return `<div class="card su-card" data-sid="${esc(s.id)}">
        <h3>${esc(s.title || 'নামহীন ফাইল')}</h3>
        <div class="mute small">${esc(KIND_BN[s.kind] || s.kind)} · ক্লাস ${esc(bn(s.class_level ?? '—'))}</div>
        <div class="row" style="border:0;padding:6px 0 0"><span class="pill ${tone}">${esc(label)}</span>${stale ? '' : `<span class="mute small">অংশ: ✓ ${esc(bn(done))} / ${esc(bn(s.parts_total ?? 0))}</span>`}</div>
        ${errs}
        <div class="su-acts">${!stale && n ? `<button class="pill teal" data-go="t.qapprove.src:${esc(s.id)}">অপেক্ষায় ${esc(bn(n))} টি প্রশ্ন</button>` : ''}<button class="link" data-su="del" data-id="${esc(s.id)}">মুছুন</button></div>
      </div>`;
    }).join('');
    RUN.host = el.querySelector('#su-run'); drawRun(false);
    el.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b || !el.contains(b)) return;
      if (b.id === 'su-start') return startWorker(ids);
      if (b.dataset.su === 'retry') return retryRun();
      if (b.dataset.su === 'del') return delSource(b.dataset.id);
    });
  } };
})();

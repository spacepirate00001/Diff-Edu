'use strict';
// Teacher question approval: pending questions from a source (source_items) go to the question bank.
// List = one card per source with pending items (light query: source_id, qtype only). Source screen = the items, with
// approve / edit / reject, a bulk approve for the safe ones, and the chapter and visibility choice. Writes: rpc + upd.
(function () {
  const QT = { mcq: 'বহুনির্বাচনী', short: 'সংক্ষিপ্ত', creative: 'সৃজনশীল', math: 'গণিত (ধরন বাছুন)', other: 'অন্যান্য (ধরন বাছুন)' };
  const QS = { mcq: 'বহুনির্বাচনী', short: 'সংক্ষিপ্ত', creative: 'সৃজনশীল', math: 'গণিত', other: 'অন্যান্য' };
  const QEDIT = { mcq: 'বহুনির্বাচনী', short: 'সংক্ষিপ্ত', creative: 'সৃজনশীল' };
  const VIS_HINT = { reserved: 'শুধু শিক্ষকরা দেখবেন', practice: 'ছাত্ররাও অনুশীলনে পাবে' };
  const LAB = ['ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ', 'ঝ', 'ঞ'];
  const REASON = {
    not_pending: 'আগেই নিষ্পত্তি হয়েছে', no_class: 'সোর্সে শ্রেণি নেই', no_subject: 'বিষয় দিন', bad_type: 'ধরন বাছুন (সম্পাদনা)',
    body_too_long: 'প্রশ্ন খুব বড়', mcq_options: 'অন্তত দুটি অপশন দিন', chapter_class_mismatch: 'অধ্যায়টি অন্য শ্রেণির', not_found: 'পাওয়া যায়নি',
    bank_conflict: 'প্রশ্নটি ব্যাংকে আগে থেকেই আছে',
  };
  const ERR = 'হয়নি, আবার চেষ্টা করুন';
  /** MCQ whose answer is empty or not exactly one of its options. */
  const mcqBad = it => it.qtype === 'mcq' && !(it.options || []).includes(String(it.answer ?? ''));
  const review = it => !!(it.review_note || it.needs_figure || it.qtype === 'math' || it.qtype === 'other' || mcqBad(it));
  const subjText = s => s ? (s.name_bn || s.name || '') : '';
  const subjLabel = s => subjText(s) || 'বিষয় নেই';
  const norm = s => String(s ?? '').replace(/\s+/g, ' ').trim();
  /** The AI readings in a review note: "AI-র পড়া উত্তর: <text> — ...", several joined with ' · '. */
  const SUG_RE = /AI-র পড়া উত্তর: (.+?) — /g;
  /** The option an MCQ's AI reading points at ({ idx, letter, text }), or null: not an mcq, answer already set, or no reading equal to an option. */
  function suggestOf(it) {
    if (it.qtype !== 'mcq' || norm(it.answer) !== '') return null;
    const opts = (it.options || []).map(String);
    for (const m of String(it.review_note ?? '').matchAll(SUG_RE)) {
      const idx = opts.findIndex(o => norm(o) === norm(m[1]));
      if (idx >= 0 && LAB[idx]) return { idx, letter: LAB[idx], text: opts[idx] };
    }
    return null;
  }
  window.qaSuggestOf = suggestOf;   // for the scratch tests
  /** The note as shown: the reading that has a button becomes one short line; other notes stay in full. */
  const noteShown = it => {
    const sug = suggestOf(it);
    if (!sug) return it.review_note || '';
    return String(it.review_note).split(' · ').map(part => [...part.matchAll(SUG_RE)].some(m => norm(m[1]) === norm(sug.text))
      ? `AI-র পরামর্শ: ${sug.text} — পাতার সাথে মিলিয়ে নিন` : part).join(' · ');
  };

  const cardHtml = it => {
    const opts = it.options || [], ans = String(it.answer ?? '');
    const inOpts = ans !== '' && opts.includes(ans);
    const id = esc(it.id), sug = suggestOf(it);
    const ansLine = inOpts ? '' : (ans ? `<div class="mute">উত্তর: ${esc(ans)}</div>` : '') + (mcqBad(it) ? '<div class="mute small">উত্তর নেই বা অপশনের সাথে মিলছে না</div>' : ans ? '' : '<div class="mute small">উত্তর নেই</div>');
    return `<div class="card qa-card" data-card="${id}">
      <div class="mute small">${esc(QT[it.qtype] || it.qtype)}${it.marks != null ? ' · মান ' + esc(bn(it.marks)) : ''}</div>
      ${it.needs_figure || it.has_table ? `<div class="chips" style="margin-top:6px">${it.needs_figure ? '<span class="pill sun">চিত্র লাগবে</span>' : ''}${it.has_table ? '<span class="pill">ছক</span>' : ''}</div>` : ''}
      ${it.chapter_hint ? `<div class="mute small">অধ্যায়ের ইঙ্গিত: ${esc(it.chapter_hint)}</div>` : ''}
      ${it.topic_suggestion ? `<div class="mute small">বিষয়বস্তু: ${esc(it.topic_suggestion)}</div>` : ''}
      ${it.review_note ? `<div class="attwarn">${esc(noteShown(it))}</div>` : ''}
      <div class="qa-body" data-no-override>${esc(it.body)}</div>
      ${opts.length ? `<ol class="qa-opts" data-no-override>${opts.map((o, i) => `<li${sug && sug.idx === i ? ' class="qa-sug"' : ''}><span class="qa-lab">${LAB[i] || esc(bn(i + 1))}</span><span>${ans !== '' && o === ans ? `<b>${esc(o)} ✓</b>` : esc(o)}</span></li>`).join('')}</ol>` : ''}
      ${ansLine}
      ${it.source_ref ? `<div class="mute small">${esc(it.source_ref)}</div>` : ''}
      <div class="qa-acts">${sug ? `<button class="btn ghost" data-a="sug" data-id="${id}">AI-র উত্তর নিন (${sug.letter})</button>` : ''}<button class="btn good" data-a="ok" data-id="${id}">অনুমোদন</button><button class="link" data-a="edit" data-id="${id}">সম্পাদনা</button><button class="link" data-a="rej" data-id="${id}">বাতিল</button></div>
    </div>`;
  };
  const reasonsSheet = skipped => {
    const by = {};
    skipped.forEach(s => { by[s.reason] = (by[s.reason] || 0) + 1; });
    sheet(`<h2>কিছু প্রশ্ন অনুমোদন হয়নি</h2>${Object.entries(by).map(([r, n]) => `<div class="row"><span>${esc(REASON[r] || 'অজানা কারণ')}</span><b>${esc(bn(n))}টি</b></div>`).join('')}<button class="link" data-close>ঠিক আছে</button>`);
  };
  /** Pending rows of every source, 1000 at a time (only source_id and qtype are read). */
  async function pendingRows() {
    const out = [];
    for (let off = 0; off < 50000; off += 1000) {
      const page = await sel('source_items', `select=source_id,qtype&status=eq.pending&order=id&limit=1000&offset=${off}`);
      out.push(...page);
      if (page.length < 1000) break;
    }
    return out;
  }

  // ---------- screen 1: sources with pending questions ----------
  SCREENS['t.qapprove'] = { title: 'প্রশ্ন অনুমোদন', sub: 'অপেক্ষার তালিকা', render: async (el) => {
    const rows = await pendingRows();
    const cnt = {};
    rows.forEach(r => { const c = (cnt[r.source_id] ||= { n: 0 }); c.n++; c[r.qtype] = (c[r.qtype] || 0) + 1; });
    const ids = Object.keys(cnt);
    const [srcs, subs] = ids.length ? await Promise.all([
      sel('sources', `select=id,title,kind,class_level,subject_id&id=in.(${ids.map(enc).join(',')})`),
      sel('subjects', 'select=id,name,name_bn'),
    ]) : [[], []];
    const sm = Object.fromEntries(srcs.map(s => [s.id, s])), bm = Object.fromEntries(subs.map(s => [s.id, s]));
    const list = ids.map(id => ({ id, s: sm[id] || {}, c: cnt[id] }))
      .sort((a, b) => (a.s.class_level || 0) - (b.s.class_level || 0) || String(a.s.title || '').localeCompare(String(b.s.title || ''), 'bn'));
    if (!list.length) { el.innerHTML = empty('check_list', 'অনুমোদনের অপেক্ষায় কোনো প্রশ্ন নেই।'); return; }
    el.innerHTML = `<div class="mute">মোট ${esc(bn(rows.length))}টি প্রশ্ন, ${esc(bn(list.length))}টি সোর্সে অপেক্ষায়</div>` + list.map(({ id, s, c }) => {
      const kinds = Object.keys(QS).filter(k => c[k]).map(k => `${QS[k]} ${bn(c[k])}`).join(' · ');
      return `<div class="card tap" data-go="t.qapprove.src:${esc(id)}">
        <h3>${esc(s.title || 'নামহীন সোর্স')}</h3>
        <div class="mute small">ক্লাস ${esc(bn(s.class_level ?? '—'))} · ${esc(subjLabel(bm[s.subject_id]))}</div>
        <div class="row" style="border:0;padding:6px 0 0"><b>অপেক্ষায় ${esc(bn(c.n))} টি</b><span class="mute small">${esc(kinds)}</span></div>
      </div>`;
    }).join('');
  } };

  // ---------- screen 2: the pending questions of one source ----------
  SCREENS['t.qapprove.src'] = { title: 'প্রশ্ন অনুমোদন', sub: 'সোর্স', render: async (el, id) => {
    const [src] = await sel('sources', `select=id,title,kind,class_level,subject_id&id=eq.${enc(id)}`);
    if (!src) { el.innerHTML = empty('question', 'এই সোর্সটি পাওয়া যায়নি।'); return; }
    if (cur().r === 't.qapprove.src' && cur().p === id) setSub(src.title || 'নামহীন সোর্স');
    const [subj, rows] = await Promise.all([
      src.subject_id ? sel('subjects', `select=id,name,name_bn&id=eq.${enc(src.subject_id)}`).then(r => r[0] || null) : null,
      sel('source_items', `select=id,item_idx,qtype,body,options,answer,marks,chapter_hint,topic_suggestion,needs_figure,has_table,review_note,source_ref&source_id=eq.${enc(id)}&status=eq.pending&order=item_idx&limit=1000`),
    ]);
    let items = rows.map(r => ({ ...r, options: Array.isArray(r.options) ? r.options.map(String) : null }));
    let f = 'all', ch = '', chId = '', chapters = [], vis = src.kind === 'typed_paper' ? 'reserved' : 'practice';
    let subjIn = null, bulkBusy = false;
    const busy = new Set();

    el.innerHTML = `<div class="mute" id="qa-info"></div>
      <div class="card"><h3>কোথায় যাবে</h3>
        <div class="seg" id="qa-vis" style="margin-top:8px">
          <button data-qv="reserved" class="${vis === 'reserved' ? 'on' : ''}"><b>পরীক্ষার জন্য সংরক্ষিত</b></button>
          <button data-qv="practice" class="${vis === 'practice' ? 'on' : ''}"><b>অনুশীলনের জন্য খোলা</b></button>
        </div>
        <div class="mute small" id="qa-vhint" style="margin-top:6px">${VIS_HINT[vis]}</div>
        ${subj ? '' : '<label>বিষয়</label><input id="qa-subj" maxlength="60" placeholder="বিষয়ের নাম">'}
        <label>অধ্যায়</label><select id="qa-ch"></select>
      </div>
      <div id="qa-chips"></div>
      <button class="btn good" id="qa-bulk"></button>
      <div id="qa-list"></div>`;
    const infoEl = el.querySelector('#qa-info'), chipsEl = el.querySelector('#qa-chips'), bulkBtn = el.querySelector('#qa-bulk');
    const listEl = el.querySelector('#qa-list'), chSel = el.querySelector('#qa-ch'), vhint = el.querySelector('#qa-vhint');
    subjIn = el.querySelector('#qa-subj');

    const subjectText = () => subj ? subjText(subj).trim() : (subjIn?.value || '').trim();
    const shown = () => items.filter(it => (f === 'all' || (f === 'review' ? review(it) : f === 'sug' ? !!suggestOf(it) : it.qtype === f)) && (!ch || it.chapter_hint === ch));
    const paintCh = () => {
      chSel.innerHTML = '<option value="">অধ্যায় ছাড়া (ইঙ্গিত অনুযায়ী)</option>' +
        chapters.map(c => `<option value="${esc(c.id)}">${esc(bn(c.number))}. ${esc(c.title)}</option>`).join('') +
        '<option value="__new">+ নতুন অধ্যায়</option>';
      chSel.value = chId;
    };
    const loadChapters = async () => {
      const sj = subjectText();
      chapters = src.class_level && sj ? await sel('chapters', `select=id,number,title&coaching_id=eq.${enc(S.me.coaching_id)}&class_level=eq.${enc(src.class_level)}&subject=eq.${enc(sj)}&order=number`) : [];
      if (!chapters.some(c => c.id === chId)) chId = '';
      paintCh();
    };
    const refresh = () => {
      const hints = [...new Set(items.map(it => it.chapter_hint).filter(Boolean))];
      if (ch && !hints.includes(ch)) ch = '';
      const sh = shown(), safe = sh.filter(it => !review(it)).length, nSug = items.filter(it => suggestOf(it)).length;
      infoEl.textContent = `ক্লাস ${src.class_level ? bn(src.class_level) : '—'} · ${subjectText() || 'বিষয় নেই'} · অপেক্ষায় ${bn(items.length)} টি`;
      chipsEl.innerHTML = chipRow([['all', 'সব'], ['mcq', 'বহুনির্বাচনী'], ['short', 'সংক্ষিপ্ত'], ['creative', 'সৃজনশীল'], ['review', 'যাচাই দরকার'],
        ...(nSug || f === 'sug' ? [['sug', `AI উত্তরের পরামর্শ (${bn(nSug)})`]] : [])], f, 'data-qf') +
        (hints.length > 1 ? chipRow([['', 'সব অধ্যায়'], ...hints.map(h => [h, 'অধ্যায় ' + h])], ch, 'data-qch') : '');
      bulkBtn.textContent = `দেখানো সব অনুমোদন (${bn(safe)})`;
      bulkBtn.disabled = bulkBusy || !safe;
      el.querySelectorAll('[data-qv]').forEach(x => { x.disabled = bulkBusy; });
      chSel.disabled = bulkBusy;
      listEl.innerHTML = sh.length ? sh.map(cardHtml).join('') : empty('check_list', items.length ? 'এই ফিল্টারে কোনো প্রশ্ন নেই।' : 'এই সোর্সে আর অপেক্ষার প্রশ্ন নেই।');
    };
    /** Items that left the queue (approved, or already decided elsewhere) leave the list; the rest stay. */
    let leaving = false;
    const drop = ids => {
      const s = new Set(ids); items = items.filter(it => !s.has(it.id)); refresh();
      if (!items.length && !leaving) {   // last pending item gone: show the empty state, then back to the list
        leaving = true;
        setTimeout(() => { if (cur().r === 't.qapprove.src' && cur().p === id) nav.back(); }, 800);
      }
    };
    /** The visibility, chapter and subject a run approves with. Bulk takes this once and reuses it for every chunk. */
    const currentPick = () => ({ vis, ch: chId || null, subj: subj ? null : (subjIn?.value || '').trim() || null });
    /** One approve call. Ids not in skipped were approved; not_pending / not_found ones are gone from the queue too. */
    const approveChunk = async (ids, pick = currentPick()) => {
      const r = await rpc('approve_source_items', { p_ids: ids, p_visibility: pick.vis, p_chapter_id: pick.ch, p_subject: pick.subj });
      if (!r || typeof r.approved !== 'number') throw new Error('bad rpc');
      const skipped = r.skipped || [];
      const bad = new Set(skipped.map(s => s.id));
      const gone = new Set(skipped.filter(s => s.reason === 'not_pending' || s.reason === 'not_found').map(s => s.id));
      return { approved: r.approved, skipped, done: ids.filter(i => !bad.has(i) || gone.has(i)) };
    };
    const reportApprove = (approved, skipped) => {
      toast(skipped.length ? `${bn(approved)}টি অনুমোদিত, ${bn(skipped.length)}টি বাদ` : `${bn(approved)}টি অনুমোদিত`);
      if (skipped.length) reasonsSheet(skipped);
    };
    const doApprove = async (ids, btn) => {
      ids.forEach(i => busy.add(i)); if (btn) btn.disabled = true;
      try { const r = await approveChunk(ids); drop(r.done); reportApprove(r.approved, r.skipped); }
      catch { toast(ERR); if (btn) btn.disabled = false; }
      finally { ids.forEach(i => busy.delete(i)); }
    };
    /** Single approve; an MCQ without a matching answer asks first. */
    const approveOne = async (it, btn) => {
      if (!mcqBad(it)) return doApprove([it.id], btn);
      busy.add(it.id);
      const ok = await confirmSheet('উত্তর ছাড়া অনুমোদন?', 'এই প্রশ্নের সঠিক উত্তর দেওয়া নেই। উত্তরপত্রে এটি ফাঁকা থাকবে।', 'অনুমোদন');
      busy.delete(it.id);
      if (ok) doApprove([it.id], btn);
    };
    /** The AI reading button: PATCH the answer (not from the source), then approve that one item through doApprove. */
    const approveSuggested = async (it, btn, sug) => {
      const card = btn.closest('.qa-card'), cardBtns = card ? [...card.querySelectorAll('button')] : [btn];
      busy.add(it.id); cardBtns.forEach(x => { x.disabled = true; });
      let r;
      try { r = await upd('source_items', `id=eq.${enc(it.id)}&status=eq.pending`, { answer: sug.text, answer_in_source: false }); }
      catch { busy.delete(it.id); cardBtns.forEach(x => { x.disabled = false; }); return toast(ERR); }
      busy.delete(it.id);
      if (!r?.length) { drop([it.id]); return toast('প্রশ্নটি আগেই নিষ্পত্তি হয়েছে'); }
      Object.assign(it, { answer: sug.text, answer_in_source: false });
      refresh();   // the card now shows the stored answer; its buttons are new, so the approve button is looked up again
      await doApprove([it.id], [...listEl.querySelectorAll('[data-a="ok"]')].find(x => x.dataset.id === it.id) || null);
    };
    const doReject = async (id, btn) => {
      busy.add(id);   // taken before the confirm, so a second tap cannot open another one
      if (!await confirmSheet('বাতিল করবেন?', 'প্রশ্নটি বাতিল হবে এবং অনুমোদনের তালিকা থেকে সরে যাবে।', 'বাতিল করুন', true)) { busy.delete(id); return; }
      if (btn) btn.disabled = true;
      try { const n = await rpc('reject_source_items', { p_ids: [id] }); drop([id]); toast(`${bn(n ?? 0)}টি বাতিল`); }
      catch { toast(ERR); if (btn) btn.disabled = false; }
      finally { busy.delete(id); }
    };
    const doBulk = async () => {
      const sh = shown(), cands = sh.filter(it => !review(it)), left = sh.length - cands.length;
      if (!cands.length) return toast('এখানে নিরাপদে অনুমোদনযোগ্য প্রশ্ন নেই');
      if (!await confirmSheet('দেখানো সব অনুমোদন?', `${bn(cands.length)}টি প্রশ্ন অনুমোদিত হবে।${left ? ` ${bn(left)}টি প্রশ্ন (যাচাই দরকার, চিত্র বা ধরন বাকি) বাদ থাকবে, সেগুলো আলাদাভাবে দেখে অনুমোদন দিন।` : ''}`, 'অনুমোদন')) return;
      if (bulkBusy) return;
      bulkBusy = true; refresh();
      const pick = currentPick();   // one visibility, chapter and subject for every chunk
      const ids = cands.map(it => it.id), skipped = []; let approved = 0;
      try {
        for (let k = 0; k < ids.length; k += 200) {
          const r = await approveChunk(ids.slice(k, k + 200), pick);
          approved += r.approved; skipped.push(...r.skipped); drop(r.done);
        }
      } catch { toast('কিছু অনুমোদন হয়নি, তালিকা নতুন করে আনা হচ্ছে'); bulkBusy = false; return render(); }
      bulkBusy = false; refresh();
      if (approved || skipped.length) reportApprove(approved, skipped);
    };
    const openNewChapter = () => {
      const sj = subjectText();
      if (!src.class_level) return toast('সোর্সে শ্রেণি নেই');
      if (!sj) return toast('আগে বিষয় দিন');
      sheet(`<h2>নতুন অধ্যায়</h2><div class="mute">ক্লাস ${esc(bn(src.class_level))} · ${esc(sj)}</div>
        <label>অধ্যায় নম্বর (০–৯৯)</label><input id="cn" inputmode="numeric" maxlength="2">
        <label>শিরোনাম</label><input id="ct" maxlength="200">
        <button class="btn" id="cs">যোগ করুন</button><button class="link" data-close>বাতিল</button>`, (s, close) => {
        s.querySelector('#cs').onclick = async () => {
          const nraw = ascii(s.querySelector('#cn').value).trim(), title = s.querySelector('#ct').value.trim();
          if (!/^\d{1,2}$/.test(nraw) || +nraw > 99) return toast('অধ্যায় নম্বর ০ থেকে ৯৯ এর মধ্যে দিন');
          if (!title) return toast('অধ্যায়ের শিরোনাম দিন');
          const go = s.querySelector('#cs'); go.disabled = true;
          try {
            const [row] = await ins('chapters', { coaching_id: S.me.coaching_id, class_level: src.class_level, subject: sj, number: +nraw, title }, 'select=id,number,title');
            chapters = chapters.concat([row]).sort((a, b) => a.number - b.number); chId = row.id; paintCh(); close(); toast('অধ্যায় যোগ হয়েছে');
          } catch (e) { toast(/23505/.test(e.body || '') ? 'এই নম্বরের অধ্যায় আগে থেকেই আছে' : ERR); go.disabled = false; }
        };
      });
    };
    const openEdit = it => {
      const opts = it.options || [];
      sheet(`<h2>সম্পাদনা</h2>
        <label>ধরন</label><select id="ee-t">${QEDIT[it.qtype] ? '' : '<option value="" selected disabled>ধরন বাছুন</option>'}${Object.keys(QEDIT).map(k => `<option value="${k}" ${k === it.qtype ? 'selected' : ''}>${QEDIT[k]}</option>`).join('')}</select>
        <label>প্রশ্ন</label><textarea id="ee-b" maxlength="4000" style="min-height:180px">${esc(it.body)}</textarea>
        <label>অপশন (বহুনির্বাচনী হলে, প্রতি লাইনে একটি)</label><textarea id="ee-o">${esc(opts.join('\n'))}</textarea>
        <label>উত্তর</label><input id="ee-a" maxlength="500" value="${esc(it.answer ?? '')}">
        <label>মান (ঐচ্ছিক)</label><input id="ee-m" inputmode="decimal" value="${esc(it.marks ?? '')}">
        <button class="btn" id="ee-go">সংরক্ষণ</button><button class="link" data-close>বাতিল</button>`, (s, close) => {
        s.querySelector('#ee-go').onclick = async () => {
          const q = sel2 => s.querySelector(sel2);
          const qtype = q('#ee-t').value, body = q('#ee-b').value.trim();
          const options = qtype === 'mcq' ? q('#ee-o').value.split('\n').map(x => x.trim()).filter(Boolean) : null;
          const answer = q('#ee-a').value.trim() || null;
          const mraw = ascii(q('#ee-m').value).trim(), marks = mraw === '' ? null : +mraw;
          if (!qtype) return toast('ধরন বাছুন');
          if (!body) return toast('প্রশ্ন লিখুন');
          if (mraw !== '' && !/^\d{1,3}(\.\d)?$/.test(mraw)) return toast('মান একটি সংখ্যা হতে হবে');
          if (qtype === 'mcq' && (options.length < 2 || new Set(options).size !== options.length)) return toast('অন্তত দুটি আলাদা অপশন দিন');
          if (qtype === 'mcq' && answer && !options.includes(answer)) return toast('উত্তরটি অপশনের একটির সাথে হুবহু মিলতে হবে');
          const patch = { qtype, body, options, answer, marks };
          const go = q('#ee-go'); busy.add(it.id); go.disabled = true;
          try {
            const r = await upd('source_items', `id=eq.${enc(it.id)}&status=eq.pending`, patch);
            close();
            if (!r?.length) { drop([it.id]); return toast('প্রশ্নটি আগেই নিষ্পত্তি হয়েছে'); }
            Object.assign(it, patch); refresh(); toast('সংরক্ষিত হয়েছে');
          } catch { toast(ERR); go.disabled = false; }
          finally { busy.delete(it.id); }
        };
      });
    };

    el.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b || !el.contains(b)) return;
      if (b.dataset.qf !== undefined) { f = b.dataset.qf; return refresh(); }
      if (b.dataset.qch !== undefined) { ch = b.dataset.qch; return refresh(); }
      if (b.dataset.qv !== undefined) {
        vis = b.dataset.qv; el.querySelectorAll('[data-qv]').forEach(x => x.classList.toggle('on', x === b));
        vhint.textContent = VIS_HINT[vis]; return;
      }
      if (b === bulkBtn) return doBulk();
      const id = b.dataset.id;
      if (!id || busy.has(id)) return;
      const it = items.find(x => x.id === id);
      if (!it) return;
      if (b.dataset.a === 'ok') return approveOne(it, b);
      if (b.dataset.a === 'sug') { const sug = suggestOf(it); return sug && approveSuggested(it, b, sug); }
      if (b.dataset.a === 'rej') return doReject(id, b);
      if (b.dataset.a === 'edit') return openEdit(it);
    });
    el.addEventListener('change', async e => {
      if (e.target === chSel) {
        if (chSel.value === '__new') { chSel.value = chId; return openNewChapter(); }
        if (bulkBusy) return;
        chId = chSel.value;
      } else if (e.target === subjIn) {
        refresh();
        try { await loadChapters(); } catch { toast(ERR); }
      }
    });

    paintCh();
    await loadChapters().catch(() => toast(ERR));
    refresh();
  } };
})();

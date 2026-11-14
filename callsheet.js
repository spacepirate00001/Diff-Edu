// Guardian call sheet: used by the shift list call button (teacher.js t.shift) and the absent rows (t.att).
// guardianCallSheet(student, guardians): guardians = [{ id, name, relation, phone }] (T.contacts() shape).
// Always three slots, in this order: বাবা, মা, অন্য কেউ. Every slot shows its people, or "নম্বর নেই".
(function () {
  const SLOTS = ['বাবা', 'মা', 'অন্য কেউ'];
  const OWNERS = ['মা', 'বাবা', 'নানা/নানি', 'দাদা/দাদী', 'অন্য'];
  const NUM_OK = /^01[3-9]\d{8}$/;
  const NUM_ERR = 'সঠিক নম্বর দিন (০১ দিয়ে শুরু, ১১ সংখ্যা)';
  const telOf = p => 'tel:' + ascii(p).replace(/[^\d+]/g, '');
  const digitsOf = v => ascii(v).replace(/\D/g, '');
  const slotOf = g => { const r = String(g.relation || '').trim(); return r === 'বাবা' ? 'বাবা' : r === 'মা' ? 'মা' : 'অন্য কেউ'; };

  window.guardianCallSheet = function guardianCallSheet(student, guardians) {
    const sid = student.id;
    const gs = (guardians || []).filter(g => g && g.id && g.phone);
    const name = student.profile?.full_name || 'শিক্ষার্থী';
    const st = { status: 'loading', reported: new Set(), form: null, added: new Set() };
    let body = null, shut = null;

    // "নম্বর ভুল?" links wait for the pending-report lookup; "reported" is what this sheet knows is waiting.
    const personRow = g => {
      const isForm = st.form?.type === 'rep' && st.form.gid === g.id;
      let x = `<div class="gcs-item"><div class="gcs-row"><div class="gcs-info"><b>${esc(g.relation || 'অন্য কেউ')}</b>`
        + (g.name ? `<span class="mute small">${esc(g.name)}</span>` : '')
        + `<span class="gcs-num">${esc(bn(g.phone))}</span>`;
      if (st.reported.has(g.id)) x += '<span class="small gcs-rep">ভুল নম্বর জানানো হয়েছে · অ্যাডমিনের অনুমোদনের অপেক্ষায়</span>';
      else if (st.status === 'ok' && !isForm) x += `<button class="link" data-rep="${esc(g.id)}">নম্বর ভুল? জানান</button>`;
      x += `</div><a class="callb" href="${esc(telOf(g.phone))}" aria-label="কল করুন">${I('phone')}</a></div>`;
      if (isForm) x += `<div class="gcs-form">
        <label for="gcs-np">সঠিক নম্বর (জানা থাকলে)</label>
        <input id="gcs-np" inputmode="tel" maxlength="14" placeholder="01XXXXXXXXX" autocomplete="off">
        <label for="gcs-own">কার নম্বর</label>
        <div class="gcs-owners">${OWNERS.map(o => `<button class="pill" type="button" data-own="${esc(o)}">${esc(o)}</button>`).join('')}</div>
        <input id="gcs-own" maxlength="40" placeholder="যেমন: মা, বাবা, বা নাম" value="${esc(g.relation || '')}" autocomplete="off">
        <label for="gcs-nn">মন্তব্য (ঐচ্ছিক)</label>
        <input id="gcs-nn" maxlength="200" autocomplete="off">
        <div class="err" id="gcs-err"></div>
        <button class="btn" id="gcs-send">অ্যাডমিনকে পাঠান</button>
        <button class="link" type="button" data-cancel>বাতিল</button></div>`;
      return x + '</div>';
    };

    const noneRow = slot => {
      const isForm = st.form?.type === 'add' && st.form.key === slot;
      const added = st.added.has(slot);
      let x = `<div class="gcs-item"><div class="gcs-row none"><div class="gcs-info"><b>${esc(slot)} — নম্বর নেই</b>`
        + (added ? '<span class="small gcs-rep">অ্যাডমিনকে জানানো হয়েছে।</span>'
          : (!isForm ? `<button class="link" data-add="${esc(slot)}">নম্বর যোগ করতে জানান</button>` : ''))
        + `</div><span class="callb off" aria-hidden="true">${I('phone')}</span></div>`;
      if (isForm) x += `<div class="gcs-form">
        <label for="gcs-an">ফোন নম্বর (জানা থাকলে)</label>
        <input id="gcs-an" inputmode="tel" maxlength="14" placeholder="01XXXXXXXXX" autocomplete="off">
        <div class="err" id="gcs-err"></div>
        <button class="btn" id="gcs-asend">পাঠান</button>
        <button class="link" type="button" data-cancel>বাতিল</button></div>`;
      return x + '</div>';
    };

    const html = () => {
      let h = '';
      if (st.status === 'loading') h += '<div class="mute small">নম্বর আনা হচ্ছে…</div>';
      else if (st.status === 'failed') h += '<button class="link" id="gcs-retry">নম্বর আনা যায়নি। আবার চেষ্টা করুন।</button>';
      for (const slot of SLOTS) {
        const people = gs.filter(g => slotOf(g) === slot);
        h += people.length ? people.map(personRow).join('') : noneRow(slot);
      }
      return h;
    };

    const render = () => { if (!body) return; body.innerHTML = html(); bind(); };

    const bind = () => {
      body.querySelectorAll('[data-rep]').forEach(b => b.addEventListener('click', () => { st.form = { type: 'rep', gid: b.dataset.rep }; render(); }));
      body.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => { st.form = { type: 'add', key: b.dataset.add }; render(); }));
      body.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', () => { st.form = null; render(); }));
      body.querySelectorAll('[data-own]').forEach(b => b.addEventListener('click', () => {
        body.querySelector('#gcs-own').value = b.dataset.own === 'অন্য' ? '' : b.dataset.own;
      }));
      const retry = body.querySelector('#gcs-retry'); if (retry) retry.addEventListener('click', load);
      const send = body.querySelector('#gcs-send'); if (send) send.addEventListener('click', () => sendReport(send));
      const asend = body.querySelector('#gcs-asend'); if (asend) asend.addEventListener('click', () => sendAdd(asend));
    };

    // Wrong number: phone_change_requests row (same fields as the admin's phone-requests screen).
    async function sendReport(btn) {
      const g = gs.find(x => x.id === st.form?.gid);
      if (!g) return;
      const err = body.querySelector('#gcs-err');
      const np = digitsOf(body.querySelector('#gcs-np').value);
      if (np && !NUM_OK.test(np)) { err.textContent = NUM_ERR; return; }
      const owner = body.querySelector('#gcs-own').value.trim().slice(0, 40);
      const note = body.querySelector('#gcs-nn').value.trim().slice(0, 200);
      btn.disabled = true; err.textContent = '';
      try {
        await ins('phone_change_requests', { coaching_id: S.me.coaching_id, student_id: sid, guardian_id: g.id, old_phone: g.phone, new_phone: np || null, owner, note, reported_by: S.uid }, 'select=id');
        st.reported.add(g.id); st.form = null; render(); toast('অ্যাডমিনকে জানানো হয়েছে');
      } catch (e) {
        if (/23505|duplicate/.test(e.body || '')) { st.reported.add(g.id); st.form = null; render(); toast('আগেই জানানো হয়েছে'); }
        else { btn.disabled = false; err.textContent = 'পাঠানো যায়নি। আবার চেষ্টা করুন।'; }
      }
    }

    // Missing number: a plain student change request (note only; the admin adds the number).
    async function sendAdd(btn) {
      const key = st.form?.key;
      if (!key) return;
      const err = body.querySelector('#gcs-err');
      const np = digitsOf(body.querySelector('#gcs-an').value);
      if (np && !NUM_OK.test(np)) { err.textContent = NUM_ERR; return; }
      btn.disabled = true; err.textContent = '';
      try {
        await ins('student_change_requests', { coaching_id: S.me.coaching_id, student_id: sid, requested_by: S.uid, status: 'pending', note: `${key}-এর ফোন নম্বর যোগ করা দরকার` + (np ? ` · ${np}` : '') }, 'select=id');
        st.added.add(key); st.form = null; render();
      } catch (e) {
        btn.disabled = false; err.textContent = 'পাঠানো যায়নি। আবার চেষ্টা করুন।';
      }
    }

    async function load() {
      st.status = 'loading'; render();
      try {
        const rows = await sel('phone_change_requests', `select=guardian_id&student_id=eq.${encodeURIComponent(sid)}&status=eq.pending&limit=200`);
        st.reported = new Set(rows.map(r => r.guardian_id));
        st.status = 'ok';
      } catch { st.status = 'failed'; }
      render();
    }

    shut = sheet(`<h2>কাকে ফোন করবেন?</h2><div class="mute small">${esc(name)} · ক্লাস ${esc(bn(student.class_level))} · রোল ${esc(bn(student.roll || '—'))}</div>
      <div id="gcs-body" class="gcs"></div><button class="btn" data-close>ঠিক আছে</button>`, root => {
      body = root.querySelector('#gcs-body');
    });
    render();
    load();
    return shut;
  };
})();

'use strict';
// P5-T4: online exam screen with basic anti-cheat (tab-switch log, per-attempt shuffle).
// Loaded by index.html before app.js. No tab opens it yet: the learner role comes with P5-T1 and P5-T2.
// Server calls (assumed until app/supabase/next/52-online-exam.sql exists; P5-T3 must match them):
//   start_exam(p_exam)                       -> { attempt_id, title, questions: [{ id, text, options: [{ id, text }] }] }
//                                               must never send the correct answers
//   log_exam_event(p_attempt, p_kind, p_at)  -> appends the switch to exam_attempts
//   submit_exam(p_attempt, p_answers)        -> once per attempt; p_answers = [{ question_id, option_id }]
// Switches go through the caller's offline queue, so a switch made offline is logged when the network returns.
(function () {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const bn = n => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
  const DEDUPE_MS = 1000; // one switch often fires two events (visibility and blur): log it once

  // Fisher-Yates. rnd is injectable for tests.
  function shuffle(list, rnd = Math.random) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  // Question order and option order, different for each attempt.
  const arrange = (questions, rnd) => shuffle(questions, rnd).map(q => ({ ...q, options: shuffle(q.options, rnd) }));
  // Rows for submit_exam: answered questions only.
  const answerRows = (questions, picks) =>
    questions.filter(q => picks[q.id] != null).map(q => ({ question_id: q.id, option_id: picks[q.id] }));
  const eventArgs = (attemptId, kind, at) => ({ p_attempt: attemptId, p_kind: kind, p_at: new Date(at).toISOString() });

  // Rendered from state (questions, picks), so a failed submit can redraw the form with the answers kept.
  function examHtml(title, questions, picks, notice) {
    const qs = questions.map((q, i) => `<fieldset class="card q"><legend>${bn(i + 1)}. ${esc(q.text)}</legend>${
      q.options.map(o => `<label class="opt"><input type="radio" name="q-${esc(q.id)}" value="${esc(o.id)}" data-q="${esc(q.id)}"${
        picks[q.id] === o.id ? ' checked' : ''}><span>${esc(o.text)}</span></label>`).join('')}</fieldset>`).join('');
    return `<h2>${esc(title)}</h2>
      <form id="exam-form" novalidate>${qs}
        ${notice ? `<p class="notice" role="alert">${esc(notice)}</p>` : ''}
        <button class="btn" type="submit">জমা দিন</button>
      </form>`;
  }

  // Shows the exam in root and logs tab switches until the answers are submitted.
  // opts: root, examId, call(method, path, body) -> JSON, queue(method, path, body), doc, win, now, rnd (last four: tests).
  async function open({ root, examId, call, queue, doc = document, win = window, now = Date.now, rnd = Math.random }) {
    const msg = text => { root.innerHTML = `<section class="card empty"><p>${esc(text)}</p></section>`; };
    msg('পরীক্ষা লোড হচ্ছে…');
    let ex;
    try { ex = await call('POST', '/rest/v1/rpc/start_exam', { p_exam: examId }); }
    catch { return msg('পরীক্ষা এখন খোলা যাচ্ছে না। ইন্টারনেট দেখে আবার চেষ্টা করুন।'); }

    const questions = arrange(ex.questions, rnd);
    const picks = {};
    let last = -Infinity, submitting = false, done = false;
    root.innerHTML = examHtml(ex.title, questions, picks, '');

    const logSwitch = kind => {
      const t = now();
      if (done || t - last < DEDUPE_MS) return;
      last = t;
      queue('POST', '/rest/v1/rpc/log_exam_event', eventArgs(ex.attempt_id, kind, t));
    };
    const onHidden = () => { if (doc.hidden) logSwitch('tab_hidden'); };
    const onBlur = () => logSwitch('window_blur');
    doc.addEventListener('visibilitychange', onHidden);
    win.addEventListener('blur', onBlur);
    const stop = () => { doc.removeEventListener('visibilitychange', onHidden); win.removeEventListener('blur', onBlur); };

    root.addEventListener('change', e => {
      const q = e.target.dataset?.q;
      if (q) picks[q] = e.target.value;
    });
    root.addEventListener('submit', async e => {
      if (e.target.id !== 'exam-form') return;
      e.preventDefault();
      if (submitting || done) return;
      submitting = true;
      try {
        await call('POST', '/rest/v1/rpc/submit_exam', { p_attempt: ex.attempt_id, p_answers: answerRows(questions, picks) });
        done = true;
        stop();
        msg('উত্তর জমা হয়েছে। ধন্যবাদ।');
      } catch (err) {
        submitting = false;
        const refused = err.status >= 400 && err.status < 500;
        root.innerHTML = examHtml(ex.title, questions, picks, refused
          ? 'এই পরীক্ষা আগেই জমা হয়েছে বা এখন জমা নেওয়া যাচ্ছে না।'
          : 'জমা হয়নি। ইন্টারনেট দেখে আবার জমা দিন।');
      }
    });
  }

  globalThis.DeExam = { shuffle, arrange, answerRows, eventArgs, open };
})();

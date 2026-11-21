'use strict';
// Student-to-student chat (P4-T5, plan C10, decision D6): phrase and sticker picker only, no text input.
// The server enforces the rules (same class, class 5 and up, both guardians opted in). This screen only
// hides what the server would refuse.
// Server names assumed until app/supabase/next/40-*.sql and 41-*.sql exist (check them when they land):
//   table  phrases(id, kind 'phrase'|'sticker', text, sort, active)
//   rpc    chat_classmates()                          -> [{ id, full_name }]
//   rpc    chat_thread(p_peer)                        -> [{ id, mine, kind, text }]
//   rpc    send_chat_phrase(p_peer, p_phrase_id)
//   rpc    report_message(p_message_id)               (P4-T4)
(function () {
  const myStudent = async () => (await sel('students', `select=id,class_level&profile_id=eq.${S.uid}&limit=1`))[0];

  SCREENS['s.chat'] = { title: 'বন্ধুর সাথে চ্যাট', sub: 'শুধু তৈরি বাক্য ও স্টিকার', hdr: 'var(--plum400)', render: async (el, peerId) => {
    const me = await myStudent();
    if (!me || +me.class_level < 5) { el.innerHTML = empty('chat', 'বন্ধুর সাথে চ্যাট ক্লাস ৫ থেকে চালু হবে।'); return; }

    if (!peerId) {
      const peers = await rpc('chat_classmates').catch(() => []);
      el.innerHTML = peers.map(p => `<div class="card tap" data-go="s.chat:${esc(p.id)}" style="display:flex;gap:12px;align-items:center">${avatar(p.full_name)}<h3>${esc(p.full_name)}</h3></div>`).join('')
        || empty('chat', 'এখনো কোনো বন্ধু চ্যাটের জন্য চালু নেই। অভিভাবকের অনুমতি লাগবে।');
      el.querySelectorAll('[data-go]').forEach(bindGo);
      return;
    }

    const peer = (await rpc('chat_classmates').catch(() => [])).find(p => p.id === peerId);
    setSub(peer ? peer.full_name : '');
    const phrases = await cached('chatPhrases', () => sel('phrases', 'select=id,kind,text&active=is.true&order=sort'));
    const pick = (kind, title) => {
      const list = phrases.filter(p => p.kind === kind);
      return list.length ? `${section(title)}<div class="chips">${list.map(p => `<button class="chip-btn" data-phrase="${esc(p.id)}">${esc(p.text)}</button>`).join('')}</div>` : '';
    };

    const draw = async () => {
      const ms = await rpc('chat_thread', { p_peer: peerId }).catch(() => null);
      if (ms === null) { toast('বার্তা আনা যায়নি'); }
      el.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px">${(ms || []).map(m => `<div class="bubble ${m.mine ? 'me' : ''}">${esc(m.text)}${m.mine ? '' : ` <button class="pill" data-report="${esc(m.id)}" style="font-size:12px">রিপোর্ট</button>`}</div>`).join('')
        || empty('chat', 'এখনো কোনো বার্তা নেই। নিচ থেকে বাক্য বা স্টিকার বেছে নাও।')}</div>
        <div class="card" style="margin-top:12px">${pick('phrase', 'বাক্য')}${pick('sticker', 'স্টিকার')}</div>`;
      el.querySelectorAll('[data-phrase]').forEach(b => b.onclick = async () => {
        b.disabled = true;
        try { await rpc('send_chat_phrase', { p_peer: peerId, p_phrase_id: b.dataset.phrase }); await draw(); }
        catch { b.disabled = false; toast('পাঠানো যায়নি'); }
      });
      el.querySelectorAll('[data-report]').forEach(b => b.onclick = async () => {
        try { await rpc('report_message', { p_message_id: b.dataset.report }); b.remove(); toast('রিপোর্ট পাঠানো হয়েছে'); }
        catch { toast('রিপোর্ট পাঠানো যায়নি'); }
      });
    };
    await draw();
  } };
})();

'use strict';
// Student-to-student chat (P4-T5, plan C10, decision D6): phrase and sticker picker only, no text input.
// The server enforces the rules (same class, class 5 and up, opt-ins, batch and night hours, blocks).
// This screen only hides what the server would refuse. Server names: 40-chat-phrases.sql, 41-chat-reports.sql,
// 46-chat-client.sql:
//   table  chat_phrases(id, kind 'phrase'|'sticker', label, active, code)
//   rpc    chat_classmates()                 -> [{ peer_id, full_name, blocked }]
//   rpc    chat_thread(p_peer)               -> [{ message_id, mine, kind, label, sent_at }]
//   rpc    open_chat_thread(p_other)         -> thread id
//   rpc    send_chat_phrase(p_thread, p_phrase)
//   rpc    report_message(p_message, p_reason)   reason: rude | unsafe | personal_info | other
//   rpc    block_chat(p_other) / unblock_chat(p_other)
(function () {
  const REASONS = [['rude', 'খারাপ কথা'], ['unsafe', 'বিপজ্জনক'], ['personal_info', 'ব্যক্তিগত তথ্য'], ['other', 'অন্য']];
  const myStudent = async () => (await sel('students', `select=id,class_level&profile_id=eq.${S.uid}&limit=1`))[0];

  SCREENS['s.chat'] = { title: 'বন্ধুর সাথে চ্যাট', sub: 'শুধু তৈরি বাক্য ও স্টিকার', hdr: 'var(--plum400)', render: async (el, peerId) => {
    const me = await myStudent();
    if (!me || +me.class_level < 5) { el.innerHTML = empty('chat', 'বন্ধুর সাথে চ্যাট ক্লাস ৫ থেকে চালু হবে।'); return; }

    if (!peerId) {
      const peers = await rpc('chat_classmates').catch(() => []);
      el.innerHTML = peers.map(p => `<div class="card tap" data-go="s.chat:${esc(p.peer_id)}" style="display:flex;gap:12px;align-items:center">${avatar(p.full_name)}<h3>${esc(p.full_name)}</h3>${p.blocked ? '<span class="pill">ব্লক করা</span>' : ''}</div>`).join('')
        || empty('chat', 'এখনো কোনো বন্ধু চ্যাটের জন্য চালু নেই। অভিভাবকের অনুমতি লাগবে।');
      el.querySelectorAll('[data-go]').forEach(bindGo);
      return;
    }

    const peer = (await rpc('chat_classmates').catch(() => [])).find(p => p.peer_id === peerId);
    setSub(peer ? peer.full_name : '');
    const phrases = await cached('chatPhrases', () => sel('chat_phrases', 'select=id,kind,label&active=is.true&order=code'));
    const pick = (kind, title) => {
      const list = phrases.filter(p => p.kind === kind);
      return list.length ? `${section(title)}<div class="chips">${list.map(p => `<button class="chip-btn" data-phrase="${esc(p.id)}">${esc(p.label)}</button>`).join('')}</div>` : '';
    };

    const draw = async () => {
      const now = (await rpc('chat_classmates').catch(() => [])).find(p => p.peer_id === peerId);
      const blocked = !!(now && now.blocked);
      const ms = await rpc('chat_thread', { p_peer: peerId }).catch(() => null);
      if (ms === null) toast('বার্তা আনা যায়নি');
      const bubbles = (ms || []).map(m => `<div class="bubble ${m.mine ? 'me' : ''}">${esc(m.label)}${m.mine ? '' : ` <button class="pill" data-report="${esc(m.message_id)}" style="font-size:12px">রিপোর্ট</button>`}</div>`).join('');
      const blockBar = `<div style="text-align:right"><button class="pill" data-block="${blocked ? 'off' : 'on'}" style="font-size:12px">${blocked ? 'আনব্লক করুন' : 'ব্লক করুন'}</button></div>`;
      el.innerHTML = `${blockBar}<div style="display:flex;flex-direction:column;gap:8px">${bubbles || empty('chat', 'এখনো কোনো বার্তা নেই। নিচ থেকে বাক্য বা স্টিকার বেছে নাও।')}</div>`
        + (blocked
          ? `<div class="card" style="margin-top:12px">এই বন্ধুকে ব্লক করা আছে। ব্লক সরালে আবার চ্যাট করা যাবে।</div>`
          : `<div class="card" style="margin-top:12px">${pick('phrase', 'বাক্য')}${pick('sticker', 'স্টিকার')}</div>`);

      el.querySelectorAll('[data-phrase]').forEach(b => b.onclick = async () => {
        b.disabled = true;
        try {
          const thread = await rpc('open_chat_thread', { p_other: peerId });
          await rpc('send_chat_phrase', { p_thread: thread, p_phrase: b.dataset.phrase });
          await draw();
        } catch { b.disabled = false; toast('পাঠানো যায়নি'); }
      });
      el.querySelectorAll('[data-report]').forEach(b => b.onclick = () => {
        b.parentElement.insertAdjacentHTML('beforeend', `<div class="chips" style="margin-top:6px">${REASONS.map(([code, label]) => `<button class="chip-btn" data-reason="${code}" data-msg="${b.dataset.report}">${label}</button>`).join('')}</div>`);
        b.remove();
        el.querySelectorAll('[data-reason]').forEach(r => r.onclick = async () => {
          try { await rpc('report_message', { p_message: r.dataset.msg, p_reason: r.dataset.reason }); toast('রিপোর্ট পাঠানো হয়েছে'); }
          catch { toast('রিপোর্ট পাঠানো যায়নি'); }
          await draw();
        });
      });
      el.querySelector('[data-block]').onclick = async (ev) => {
        const b = ev.currentTarget;
        if (b.dataset.block === 'on' && !confirm('এই বন্ধুকে ব্লক করবে? ব্লক করলে চ্যাট বন্ধ থাকবে।')) return;
        try {
          await rpc(b.dataset.block === 'on' ? 'block_chat' : 'unblock_chat', { p_other: peerId });
          toast(b.dataset.block === 'on' ? 'ব্লক করা হয়েছে' : 'ব্লক সরানো হয়েছে');
        } catch { toast('হয়নি'); }
        await draw();
      };
    };
    await draw();
  } };
})();

'use strict';
// Phase 4 (P4-T9) — five learning games for students: ম্যাথ রেস, শব্দ মিলানো, বানান বি, জোড়া কার্ড,
// সঠিক ক্রমে সাজানো. Rules are one line each in GAME_RULES. GameLogic holds the pure rules and is
// self-checked by tools/next/games-logic-test.mjs. The server (app/supabase/next/44-games.sql) recomputes
// the score, caps play at 30 minutes a Dhaka day and refuses play from 22:00.
(function () {
  const CLOSE_HOUR = 22;            // games off from 22:00 Dhaka time
  const DAILY_SECONDS = 1800;       // 30 minutes a day, all games together
  const ROUND_SECONDS = 60;         // ম্যাথ রেস length
  const MAX_SECONDS = 300;          // one session, as the server accepts it

  const GAME_RULES = {
    math_race:    ['ম্যাথ রেস', '৬০ সেকেন্ডে যত পারো যোগ-বিয়োগ করো।'],
    word_match:   ['শব্দ মিলানো', 'বাংলা শব্দের ইংরেজি অর্থ বেছে নাও।'],
    spelling_b:   ['বানান বি', 'বাংলা অর্থ দেখে ঠিক বানানটি বেছে নাও।'],
    memory_pairs: ['জোড়া কার্ড', 'দুটি করে কার্ড উল্টে একই ছবির জোড়া মেলাও।'],
    sequence:     ['সঠিক ক্রমে সাজানো', 'কথাগুলো ঠিক ক্রমে একের পর এক ট্যাপ করো।'],
  };
  const WORDS = [['বই', 'book'], ['জল', 'water'], ['আকাশ', 'sky'], ['গাছ', 'tree'], ['মাছ', 'fish'], ['ফুল', 'flower']];
  const SPELL = [['বই', 'book', ['buk', 'bok']], ['জল', 'water', ['wator', 'watar']], ['স্কুল', 'school', ['scool', 'skool']],
    ['বন্ধু', 'friend', ['frend', 'freind']], ['আম', 'mango', ['mengo', 'manggo']], ['আপেল', 'apple', ['aple', 'appel']]];
  const SEQUENCES = [['সকাল', 'দুপুর', 'বিকেল', 'রাত'], ['বীজ', 'চারা', 'গাছ', 'ফল'], ['ডিম', 'বাচ্চা', 'বড় মুরগি', 'ডিম পাড়া']];
  const EMOJI = ['🐶', '🐱', '🐼', '🦊'];

  // Pure rules. rnd() returns a number in [0, 1).
  const GameLogic = {
    // 10 per right answer, +20 for a perfect round. The same formula is in 44-games.sql.
    points(correct, total) { return correct * 10 + (total > 0 && correct === total ? 20 : 0); },
    // Games are open before 22:00 Dhaka time.
    isOpen(dhakaHour) { return dhakaHour < CLOSE_HOUR; },
    secondsLeft(usedToday) { return Math.max(0, DAILY_SECONDS - usedToday); },
    // A session's seconds as the server takes them: whole seconds, 1..300.
    clampSeconds(ms) { return Math.min(MAX_SECONDS, Math.max(1, Math.round(ms / 1000))); },
    // Add or subtract, both numbers 2..20, the answer never negative.
    mathQuestion(rnd) {
      let a = 2 + Math.floor(rnd() * 19), b = 2 + Math.floor(rnd() * 19);
      if (rnd() < 0.5) return { a, b, op: '+', ans: a + b };
      if (b > a) [a, b] = [b, a];
      return { a, b, op: '−', ans: a - b };
    },
    // How many positions were given right. expected and given are equal-length arrays.
    countRight(expected, given) { return expected.reduce((n, x, i) => n + (given[i] === x ? 1 : 0), 0); },
    // Two memory cards are a pair when they are different cards with the same picture.
    isPair(deck, i, j) { return i !== j && deck[i] === deck[j]; },
    // Fisher-Yates on a copy.
    shuffle(arr, rnd) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    },
  };
  window.GameLogic = GameLogic;

  const dhakaHour = () => new Date(Date.now() + 6 * 3600e3).getUTCHours();
  const me = async () => (await sel('students', `select=id,class_level&profile_id=eq.${S.uid}&limit=1`))[0];
  const todayUsed = async (id) => (await sel('game_sessions', `select=seconds&student_id=eq.${id}&played_on=eq.${dhakaToday()}`))
    .reduce((n, r) => n + (r.seconds || 0), 0);
  const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
  const options = (rnd, right, pool) => GameLogic.shuffle([right, ...GameLogic.shuffle(pool.filter(x => x !== right), rnd).slice(0, 3)], rnd);

  // Each game: run(el, done). done({correct, total, seconds}) when the round ends.
  const GAMES = {
    math_race(el, done) {
      const t0 = Date.now(); let correct = 0, total = 0, q, over = false, timer;
      const end = () => { if (over) return; over = true; clearTimeout(timer); done({ correct, total, seconds: GameLogic.clampSeconds(Date.now() - t0) }); };
      const ask = () => {
        q = GameLogic.mathQuestion(Math.random);
        el.innerHTML = `<div class="mute small center" id="tl">${bn(ROUND_SECONDS)} সেকেন্ড · ${bn(correct)} সঠিক</div>
          <div class="card center"><div style="font-size:44px;font-weight:800">${bn(q.a)} ${q.op} ${bn(q.b)} = ?</div></div>
          <input id="ga" inputmode="numeric" autocomplete="off" class="input" style="text-align:center;font-size:24px"><button class="btn" id="gok">উত্তর দাও</button>`;
        const inp = el.querySelector('#ga'); inp.focus();
        const go = () => { if (over || inp.value.trim() === '') return; total++; if (+ascii(inp.value) === q.ans) correct++; ask(); };
        el.querySelector('#gok').onclick = go; inp.onkeydown = e => { if (e.key === 'Enter') go(); };
      };
      timer = setTimeout(end, ROUND_SECONDS * 1000);
      ask();
    },
    word_match(el, done) {
      const rnd = Math.random; const qs = GameLogic.shuffle(WORDS, rnd).slice(0, 5); const given = []; let i = 0;
      const step = () => {
        const [bnw, en] = qs[i];
        const opts = options(rnd, en, WORDS.map(w => w[1]));
        el.innerHTML = `${bar(i / qs.length, 'var(--teal)')}<div class="card center"><div class="mute small">${bn(i + 1)}/${bn(qs.length)}</div><div style="font-size:34px;font-weight:800">${esc(bnw)}</div></div>
          ${grid2(opts.map(o => `<button class="fun t-white" data-o="${esc(o)}">${esc(o)}</button>`))}`;
        el.querySelectorAll('[data-o]').forEach(b => b.onclick = () => {
          given.push(b.dataset.o); i++;
          if (i < qs.length) step();
          else done({ correct: GameLogic.countRight(qs.map(q => q[1]), given), total: qs.length, seconds: GameLogic.clampSeconds(Date.now() - t0) });
        });
      };
      const t0 = Date.now(); step();
    },
    spelling_b(el, done) {
      const rnd = Math.random; const qs = GameLogic.shuffle(SPELL, rnd); const t0 = Date.now(); let correct = 0, i = 0;
      const step = () => {
        const [clue, good, bad] = qs[i];
        const opts = GameLogic.shuffle([good, ...bad], rnd);
        el.innerHTML = `${bar(i / qs.length, 'var(--teal)')}<div class="card center"><div class="mute small">${bn(i + 1)}/${bn(qs.length)} · ${esc(clue)}</div><div class="small">ঠিক বানানটি কোনটি?</div></div>
          ${grid2(opts.map(o => `<button class="fun t-white" data-o="${esc(o)}">${esc(o)}</button>`))}`;
        el.querySelectorAll('[data-o]').forEach(b => b.onclick = () => {
          correct += GameLogic.countRight([good], [b.dataset.o]); i++;
          i < qs.length ? step() : done({ correct, total: qs.length, seconds: GameLogic.clampSeconds(Date.now() - t0) });
        });
      };
      step();
    },
    memory_pairs(el, done) {
      const rnd = Math.random; const deck = GameLogic.shuffle([...EMOJI, ...EMOJI], rnd); const t0 = Date.now();
      let open = [], gone = new Set(), busy = false, correct = 0;
      const draw = () => {
        el.innerHTML = `<div class="mute small center">${bn(correct)}/${bn(EMOJI.length)} জোড়া</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${deck.map((e, i) =>
            `<button class="card center" data-i="${i}" style="font-size:30px;padding:14px 0" ${gone.has(i) ? 'disabled' : ''}>${open.includes(i) || gone.has(i) ? e : '?'}</button>`).join('')}</div>`;
        el.querySelectorAll('[data-i]').forEach(b => b.onclick = () => {
          const i = +b.dataset.i;
          if (busy || gone.has(i) || open.includes(i)) return;
          open.push(i); draw();
          if (open.length < 2) return;
          busy = true;
          const [a, c] = open;
          if (GameLogic.isPair(deck, a, c)) {
            gone.add(a); gone.add(c); correct++; open = []; busy = false;
            if (correct === EMOJI.length) return done({ correct, total: EMOJI.length, seconds: GameLogic.clampSeconds(Date.now() - t0) });
            draw();
          } else setTimeout(() => { open = []; busy = false; draw(); }, 800);
        });
      };
      draw();
    },
    sequence(el, done) {
      const rnd = Math.random; const ordered = pick(rnd, SEQUENCES); const tiles = GameLogic.shuffle(ordered, rnd);
      const t0 = Date.now(); let tapped = [];
      const draw = () => {
        el.innerHTML = `<div class="mute small center">${bn(tapped.length)}/${bn(ordered.length)} ঠিক ক্রমে ট্যাপ করো</div>
          ${grid2(tiles.map((t, i) => `<button class="fun t-white" data-i="${i}" ${tapped.includes(i) ? 'disabled' : ''}>${esc(t)}</button>`))}
          <button class="btn ghost" id="rst">আবার</button>`;
        el.querySelectorAll('[data-i]').forEach(b => b.onclick = () => {
          tapped.push(+b.dataset.i);
          if (tapped.length < ordered.length) return draw();
          const given = tapped.map(i => tiles[i]);
          done({ correct: GameLogic.countRight(ordered, given), total: ordered.length, seconds: GameLogic.clampSeconds(Date.now() - t0) });
        });
        el.querySelector('#rst').onclick = () => { tapped = []; draw(); };
      };
      draw();
    },
  };

  SCREENS['s.learn'] = { title: 'শেখার খেলা', sub: 'সময়ে যোগ-বিয়োগ, শব্দ, বানান, জোড়া, ক্রম', render: async (el) => {
    const st = await me();
    if (!st) return;
    if (!GameLogic.isOpen(dhakaHour())) {
      el.innerHTML = empty('moon', 'খেলা রাত ১০টার পর বন্ধ থাকে। কাল আবার খেলো।');
      return;
    }
    const left = GameLogic.secondsLeft(await todayUsed(st.id).catch(() => 0));
    if (left <= 0) { el.innerHTML = empty('clock', 'আজকের খেলার সময় (৩০ মিনিট) শেষ। কাল আবার খেলো।'); return; }
    el.innerHTML = `<div class="card sun center"><div class="mute small">আজ আরও খেলা যাবে</div><div class="big">${bn(Math.floor(left / 60))} মিনিট</div></div>`
      + grid2(Object.keys(GAMES).map(k => `<button class="fun t-white" data-g="${k}">${chip('gamepad')}<b>${esc(GAME_RULES[k][0])}</b><span class="small">${esc(GAME_RULES[k][1])}</span></button>`));
    el.querySelectorAll('[data-g]').forEach(b => b.onclick = () => {
      const g = b.dataset.g;
      GAMES[g](el, async ({ correct, total, seconds }) => {
        el.innerHTML = skel(1);
        try {
          const left2 = await rpc('submit_game_session', { p_student_id: st.id, p_game: g, p_correct: correct, p_total: total, p_seconds: seconds });
          el.innerHTML = `<div class="card teal center">${empty('party', `${bn(correct)}/${bn(total)} সঠিক! ${bn(GameLogic.points(correct, total))} পয়েন্ট`)}</div>
            <div class="mute small center">আজ আরও ${bn(Math.floor(left2 / 60))} মিনিট খেলা যাবে</div><button class="btn" id="again">অন্য খেলা</button>`;
          el.querySelector('#again').onclick = () => render();
        } catch (e) {
          const m = `${e?.body || ''} ${e?.message || ''}`;
          el.innerHTML = empty('wifi_off', /games_closed/.test(m) ? 'রাত ১০টার পর খেলা বন্ধ।'
            : /daily_limit/.test(m) ? 'আজকের খেলার সময় শেষ।'
            : 'স্কোর জমা দেওয়া যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করো।');
        }
      });
    });
  } };
})();

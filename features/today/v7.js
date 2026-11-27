// ডিফ এডু: the approved v7 "আজ" screen (design-system/today-guardian-v7.js), changed only so that features/today/today.js can mount it.
// Data, cache, child choice, clock and weather come from window.DeToday / window.DeSky; the ask-ডিফি sheet is features/diffy/diffy-chat.js (button and bubble show only when window.DeToday.askDiffy is set).
(function () {
  "use strict";

  var CACHE_KEY = "tg-cache";
  var CHILD_KEY = "tg-child";
  var SERVER_DELAY_MS = 600;
  var SVG_NS = "http://www.w3.org/2000/svg";
  var BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  var CHEVRON = " ▾";
  var DEFAULT_MAX = 10;
  var RETRY_TEXT = "নেট সংযোগ দেখে আবার চেষ্টা করুন।";

  /*
   * DATA CONTRACT (what the server sends; the fake sample below follows it exactly)
   * {
   *   children: [{ id, name, initials, class_label,
   *                photo_url?: string|null,      // optional; if missing or it fails to load, initials show
   *                guardian_call: string }],     // how we greet the guardian, e.g. "তাসনিমের আম্মু"
   *   date_label: string, unread_messages: number,
   *   by_child: { <child id>: {
   *     today:   { status: "present"|"absent"|"holiday"|"none", arrived_at: "৩:০৫"|null,
   *                score: number|null, score_max: number|null, teacher_note: {text, by}|null },
   *     week:    [ 7 x { day, state: "present"|"absent"|"none", is_today } ],
   *     streak_days: number,                      // consecutive present class days up to today
   *     trend:   [ 7 x { day, score: number|null, score_max: number, is_today } ],  // last 7 days; null = no score that day
   *     next_class: { subject, teacher, time_label, period_label, room } | null,    // e.g. "৪:০০", "বিকাল"
   *     latest_notice: { id, text, when_label } | null,                              // newest one only
   *     homework: [{ subject, title, due_label }],
   *     nudges: [{ kind: "homework"|"streak"|"test", text }]   // optional, shown max 3. Built by SERVER RULES, never by AI,
   *                                  // only from data the student, guardian and teacher can all already see:
   *                                  //   homework due tomorrow, streak within 3 days of a milestone, a test in the next 3 days.
   *                                  // Kind and encouraging only, no scores or absences. Empty/missing: the card is hidden.
   *     fee: { month_label, amount, due_label, status: "paid"|"due" } | null } }
   * }
   * Every newer field may be missing: its card is then simply not shown.
   * Test the greeting at any hour with ?hour=0-23.
   */
  var ui = {
    mode: "ok",
    debug: false,
    childId: null,
    data: null,
    notice: null,
    firstMs: null,
    dataMs: null
  };

  // ---- helpers ----

  function bn(value) {
    return String(value).replace(/[0-9]/g, function (d) {
      return BN_DIGITS[Number(d)];
    });
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  // Every card: friendly rounded corners, a soft outline in the weather's tint.
  function mkCard(cls, tag) {
    return el(tag || "div", "v6-card" + (cls ? " " + cls : ""));
  }

  function icon(id) {
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "de-icon");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    var use = document.createElementNS(SVG_NS, "use");
    use.setAttribute("href", "#" + id);
    svg.appendChild(use);
    return svg;
  }

  var MOTION = !window.matchMedia || !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var HELLO = {
    cheering: "ইয়ে! আজ দারুণ একটা দিন!",
    happy: "আজকের দিনটা ভালোই কাটছে!",
    encouraging: "একটু কঠিন ছিল? কাল আবার, আমি আছি!",
    sleepy: "সব ঠিক আছে তো? শিগগির দেখা হবে!"
  };
  // greeting by phase of the sun (weather.js decides the phase)
  var HI = { dawn: "শুভ সকাল", morning: "শুভ সকাল", noon: "শুভ দুপুর", afternoon: "শুভ অপরাহ্ন", dusk: "শুভ সন্ধ্যা", twilight: "শুভ সন্ধ্যা", night: "শুভ রাত্রি" };
  var WX_BN = { clear: "পরিষ্কার আকাশ", partly: "আংশিক মেঘলা", overcast: "মেঘলা", fog: "কুয়াশা", drizzle: "গুঁড়ি গুঁড়ি বৃষ্টি", rain: "বৃষ্টি", storm: "ঝড়-বৃষ্টি", hot: "প্রচণ্ড গরম", cool: "শীতল আবহাওয়া" };
  var WX_TIP = { drizzle: "ছাতা সঙ্গে রেখো", rain: "ছাতা নিয়ে এসো", storm: "সাবধানে এসো, ভিজো না", fog: "সাবধানে এসো", hot: "পানি খেয়ো", cool: "গরম কাপড় পরে এসো" };
  // built-in sample day for Kushtia (the product reads one server row instead, SPEC 4kh)
  var FAKE_WEATHER = { weather_code: 2, temperature_c: 26, cloud_cover_pct: 40, precipitation_mm: 0, sunrise: "06:27", sunset: "17:08" };
  var NIGHT_HELLO = "রাত হয়েছে, আজ ভালো ঘুম হোক!";
  var ARC = 56;   // arc height in px; the stage is 132px tall, see today-guardian-v7.css (.v7-stage)
  var STREAK_MILESTONES = [7, 10, 14, 21, 30, 50, 100];

  function copy(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function isUsable(data) {
    return !!data && Array.isArray(data.children) && data.children.length > 0 && !!data.by_child;
  }

  // ---- storage (every access guarded) ----

  function readCache() { var d = window.DeToday.cached(); return isUsable(d) ? d : null; }
  function writeCache(data) { window.DeToday.store(data); }
  function readChildId() { return window.DeToday.childId(); }

  // ---- data: the app (features/today/today.js) answers; this file only draws ----
  function load() { return window.DeToday.load().then(applyAnswer); }
  function retry() {
    if (!ui.data) { resetAppbar("লোড হচ্ছে…"); renderSkeleton(); }
    load();
  }

  function applyAnswer(answer) {
    if (!document.getElementById("tg-cards")) return;   // the screen was left while the answer was on its way
    ui.dataMs = performance.now();

    if (answer.kind === "ok") {
      if (!isUsable(answer.data)) {
        ui.data = null;
        ui.notice = null;
        renderNoChildren();
        return;
      }
      ui.data = answer.data;
      ui.notice = null;
      writeCache(answer.data);
      renderLoaded();
      return;
    }

    var offline = answer.kind === "offline";

    if (ui.data) {
      ui.notice = offline
        ? { title: "নেট নেই", text: "শেষ জমানো তথ্য দেখানো হচ্ছে।" }
        : { title: "নতুন তথ্য আনা যায়নি", text: "আগের তথ্য দেখানো হচ্ছে।" };
      renderLoaded();
      return;
    }

    ui.notice = null;
    resetAppbar("আজ");
    updateBadge(0);
    if (offline) {
      renderEmpty("ইশ, নেট হারিয়ে গেছে", RETRY_TEXT, retry);
    } else {
      renderEmpty("ইশ, তথ্য আনা যায়নি", RETRY_TEXT, retry);
    }
  }

  // ---- child selection ----

  function currentChild() {
    var list = ui.data.children;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === ui.childId) return list[i];
    }
    ui.childId = list[0].id;
    return list[0];
  }

  // ---- app bar and nav badge ----

  function setAppbar(child, dateLabel) {
    var many = ui.data.children.length > 1;
    setAvatar(child);
    var nameButton = document.getElementById("tg-child");
    nameButton.textContent = many ? child.name + CHEVRON : child.name;
    nameButton.disabled = !many;
    document.getElementById("tg-sub").textContent = bn(child.class_label + " · " + dateLabel);
  }

  // Photo if the child has one and it loads, otherwise initials.
  function setAvatar(child) {
    var box = document.getElementById("tg-avatar");
    box.textContent = child.initials || "";
    if (!child.photo_url) return;
    var img = document.createElement("img");
    img.alt = "";
    img.addEventListener("load", function () {
      box.textContent = "";
      box.appendChild(img);
    });
    img.src = child.photo_url;
  }

  function resetAppbar(name) {
    document.getElementById("tg-avatar").textContent = "";
    var nameButton = document.getElementById("tg-child");
    nameButton.textContent = name;
    nameButton.disabled = true;
    document.getElementById("tg-sub").textContent = "";
  }

  function updateBadge(count) {
    var n = Number(count) || 0;
    if (window.DeToday.unread) window.DeToday.unread(n);
  }

  // ---- body rendering ----

  function renderBody(nodes) {
    var body = document.getElementById("tg-cards");
    if (ui.firstMs === null) ui.firstMs = performance.now();
    while (body.firstChild) body.removeChild(body.firstChild);
    nodes.forEach(function (node) {
      body.appendChild(node);
    });
    if (ui.debug) body.appendChild(debugLine());
  }

  function debugLine() {
    var first = ui.firstMs === null ? "—" : bn(Math.round(ui.firstMs)) + " ms";
    var data = ui.dataMs === null ? "—" : bn(Math.round(ui.dataMs)) + " ms";
    return el("span", "de-row__sub", "প্রথম ছবি: " + first + " · তথ্য: " + data);
  }

  function renderSkeleton() {
    var nodes = [];
    for (var i = 0; i < 3; i++) {
      var block = el("span", "de-skeleton de-skeleton--card");
      block.setAttribute("aria-hidden", "true");
      nodes.push(block);
    }
    renderBody(nodes);
  }

  function renderEmpty(title, text, onRetry) {
    var box = el("div", "de-empty");
    box.appendChild(window.Diffy.make(onRetry ? "oops" : "happy"));
    box.appendChild(el("span", "de-empty__title", title));
    box.appendChild(el("span", "de-empty__text", text));
    if (onRetry) {
      var button = el("button", "de-btn de-btn--primary", "আবার চেষ্টা করুন");
      button.type = "button";
      button.addEventListener("click", onRetry);
      box.appendChild(button);
    }
    renderBody([box]);
  }

  function renderNoChildren() {
    resetAppbar("আজ");
    updateBadge(0);
    renderEmpty("কোনো শিক্ষার্থী যুক্ত নেই", "কোচিং অফিসে যোগাযোগ করুন।", null);
    var box = document.querySelector("#tg-cards .de-empty");
    if (box) { var call = el("a", "de-btn de-btn--primary", "অফিসে ফোন করুন"); call.href = "tel:" + window.DeToday.officePhone; box.appendChild(call); }
  }

  function noticeBanner(notice) {
    var box = el("div", "de-banner de-banner--warn");
    box.appendChild(el("span", "de-banner__title", notice.title));
    box.appendChild(el("span", "de-banner__text", notice.text));
    return box;
  }

  function renderLoaded() {
    var data = ui.data;
    var child = currentChild();
    var info = (data.by_child && data.by_child[child.id]) || {};

    setAppbar(child, data.date_label);
    updateBadge(data.unread_messages);

    var nodes = [];

    var mood = info.today ? moodFor(info.today, info.streak_days) : "happy";
    setScene(child);
    var hero = heroCard(info.today, info.streak_days, mood);
    if (hero) nodes.push(hero);
    if (ui.notice) nodes.push(noticeBanner(ui.notice));
    var row = stickerRow(info);
    if (row) nodes.push(row);

    if (info.latest_notice) nodes.push(noticeStrip(info.latest_notice));
    if (info.next_class) nodes.push(nextClassCard(info.next_class));
    if (info.nudges && info.nudges.length) nodes.push(nudgeCard(info.nudges.slice(0, 3)));
    if (info.week && info.week.length) nodes.push(weekCard(info.week, info.streak_days));
    if (info.trend && info.trend.length) nodes.push(trendCard(info.trend));

    (info.homework ? homeworkNodes(info.homework) : []).forEach(function (node) {
      nodes.push(node);
    });

    if (info.fee) nodes.push(feeCard(info.fee));
    if (window.DeToday.askDiffy) nodes.push(askButton());

    nodes.forEach(function (node, i) {
      if (node.classList.contains("de-banner")) return;
      node.classList.add("de-enter");
      node.style.setProperty("--i", i);
    });
    renderBody(nodes);
    var t = info.today;
    if (t && t.status === "present" && t.score !== null && t.score !== undefined && t.score / (t.score_max || DEFAULT_MAX) >= 0.8 && ui.confettiFor !== child.id) {
      ui.confettiFor = child.id;   // once per child per visit
      confetti();
    }
  }

  // One burst of 28 pieces (gold, plum, mint, coral). Skipped when motion is reduced.
  function confetti() {
    if (!MOTION) return;
    var colors = ["--de-accent", "--de-brand", "--de-fun-mint", "--de-fun-coral"];
    var box = el("div", "de-confetti");
    box.setAttribute("aria-hidden", "true");
    for (var i = 0; i < 28; i++) {
      var piece = document.createElement("i");
      piece.style.setProperty("--x", Math.round(Math.random() * 100));
      piece.style.setProperty("--dx", Math.round(Math.random() * 120 - 60) + "px");
      piece.style.setProperty("--r", Math.round(Math.random() * 720 - 360) + "deg");
      piece.style.setProperty("--w", Math.round(Math.random() * 400) + "ms");
      piece.style.setProperty("--c", "var(" + colors[i % 4] + ")");
      box.appendChild(piece);
    }
    document.body.appendChild(box);
    setTimeout(function () { box.remove(); }, 3200);
  }

  // Score counts up from 0. Plain text at the end, so reduced motion simply shows the number.
  function countUp(node, to) {
    if (!MOTION) return;
    var t0 = null;
    node.textContent = bn(0);
    function frame(t) {
      if (t0 === null) t0 = t;
      var p = Math.min(1, (t - t0) / 800);
      node.textContent = bn(p < 1 ? Math.round(to * (1 - Math.pow(1 - p, 3))) : to);
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function stars(score, max) {
    var on = Math.max(0, Math.min(5, Math.round(score / (max || DEFAULT_MAX) * 5)));
    var row = el("span", "de-stars");
    row.setAttribute("role", "img");
    row.setAttribute("aria-label", bn("৫টির মধ্যে " + on + "টি তারা"));
    for (var i = 0; i < 5; i++) {
      var star = el("i", "de-star" + (i < on ? " de-star--on" : ""));
      star.style.setProperty("--k", i);
      row.appendChild(star);
    }
    return row;
  }

  function sticker(text, color, glyph, wiggle) {
    var tag = el("span", "de-sticker" + (color ? " de-sticker--" + color : ""));
    tag.appendChild(el("i", glyph === "star" ? "de-star" : "de-diamond" + (wiggle ? " de-wiggle" : "")));
    tag.appendChild(document.createTextNode(bn(text)));
    return tag;
  }

  function moodFor(today, streak) {
    var m = moodBase(today, streak);
    var h = hourNow();
    return (h >= 21 || h < 5) && m !== "cheering" ? "sleepy" : m;
  }

  function moodBase(today, streak) {
    if (today.status === "absent" || today.status === "holiday") return "sleepy";
    if (today.status !== "present") return "happy";
    if (STREAK_MILESTONES.indexOf(streak) >= 0) return "cheering";
    if (today.score === null || today.score === undefined) return "happy";
    var ratio = today.score / (today.score_max || DEFAULT_MAX);
    return ratio >= 0.8 ? "cheering" : ratio < 0.5 ? "encouraging" : "happy";
  }

  // The mascot perches on the hero's top edge; its taps change the bubble line, the bubble opens the ask sheet.
  function funRow(mood) {
    var row = el("div", "de-today__fun");
    var ask = el(window.DeToday.askDiffy ? "button" : "p", "de-bubble");
    if (window.DeToday.askDiffy) { ask.type = "button"; ask.setAttribute("aria-haspopup", "dialog"); ask.addEventListener("click", function () { window.DeToday.askDiffy(ask); }); }
    var h = hourNow();
    ask.textContent = (h >= 21 || h < 5) && mood === "sleepy" ? NIGHT_HELLO : HELLO[mood];
    row.appendChild(ask);
    return { row: row, bubble: ask };
  }

  function perch(mood, bubble) {
    var face = window.Diffy.make(mood);
    addExtra(face);
    var button = el("button", "de-mascot-btn v7-dfy");
    button.type = "button";
    button.setAttribute("aria-label", "ডিফি, চাপ দিলে নতুন কথা বলবে");
    button.appendChild(face);
    window.Diffy.attachTap(button, bubble, face);
    return button;
  }

  // ---- cards ----

  function qs(name) { return window.DeSky.qs(name); }

  function nowMinutes() { return window.DeSky.minutes(); }

  function hourNow() {
    return Math.floor(nowMinutes() / 60) % 24;
  }

  function prefTheme() { return window.DeSky.pref(); }
  function weatherInput() { return window.DeSky.input(); }

  // Sky, colours, sun/moon, greeting: all from weather.js. Called at start, every minute, and when the phone's theme changes.
  function applyTheme() {
    var W = window.Weather, root = document.documentElement, sky = document.getElementById("v6-sky");
    var w = weatherInput(), t = W.theme(w, prefTheme()), vars = t.vars;
    Object.keys(vars).forEach(function (k) { root.style.setProperty(k, vars[k]); });
    root.setAttribute("data-theme", t.dark ? "dark" : "light");
    var key = t.cls + (t.day ? "d" : "n"), changed = root.getAttribute("data-wx") !== key;
    root.setAttribute("data-wx", key);
    sky.setAttribute("data-phase", t.phase);
    sky.setAttribute("data-wx", t.cls);
    sky.setAttribute("data-rain", t.look.rain || 0);
    sky.setAttribute("data-fog", t.look.fog || 0);
    sky.setAttribute("data-flash", t.look.flash || 0);
    sky.style.setProperty("--stars", t.stars.toFixed(2));
    [].forEach.call(sky.querySelectorAll(".v6-cloud"), function (c, i) { c.hidden = i >= t.look.cl; });
    [["v6-sun", t.sun], ["v6-moon", t.moon]].forEach(function (o) {
      var node = document.getElementById(o[0]);
      node.style.left = (10 + 80 * o[1].f).toFixed(1) + "%";   // fraction along the day (or night) -> the arc
      node.style.setProperty("--oy", (ARC * Math.sin(Math.PI * o[1].f)).toFixed(1) + "px");
      node.style.opacity = o[1].op.toFixed(2);
    });
    ui.theme = t;
    var greet = document.getElementById("v6-greet");
    greet.textContent = "";
    greet.appendChild(el("span", "v6-greet__hi", window.DeSky.greet(HI[t.phase])));
    greet.appendChild(document.createTextNode(ui.greetCall ? ", " + ui.greetCall : ""));
    document.getElementById("v6-wx").textContent = !window.DeSky.hasReal() ? "" : bn(WX_BN[t.cls] + " · " + Math.round(w.temperature_c) + "°সে.") + (WX_TIP[t.cls] ? " · " + WX_TIP[t.cls] : "");
    if (changed) [].forEach.call(document.querySelectorAll(".v7-dfy .de-mascot"), addExtra);
    return t;
  }

  // ডিফির ছোট সাজ: umbrella in rain, sunglasses when hot, scarf when cool (assets/diffy-weather.svg, a second svg laid over the face)
  var wxSprite = null;
  function loadWx() {
    if (!wxSprite) {
      wxSprite = fetch("ui/assets/diffy-weather.svg").then(function (r) { return r.text(); }).then(function (t) {
        return new DOMParser().parseFromString(t, "image/svg+xml");
      }).catch(function () { return null; });
    }
    return wxSprite;
  }

  function addExtra(box) {
    var old = box.querySelector(".v6-extra");
    if (old) old.remove();
    var t = ui.theme, id = !t ? null : /^(drizzle|rain|storm)$/.test(t.cls) ? "dw-umbrella" : t.cls === "hot" && t.day ? "dw-sunglasses" : t.cls === "cool" ? "dw-scarf" : null;
    if (!id) return;
    loadWx().then(function (doc) {
      var sym = doc && doc.querySelector('[id="' + id + '"]');
      if (!sym || box.querySelector(".v6-extra")) return;
      var svg = document.createElementNS(SVG_NS, "svg");
      svg.setAttribute("viewBox", "0 0 64 64");
      svg.setAttribute("class", "v6-extra");
      svg.setAttribute("focusable", "false");
      for (var n = sym.firstChild; n; n = n.nextSibling) svg.appendChild(document.importNode(n, true));
      box.appendChild(svg);
    });
  }

  function setScene(child) {
    ui.greetCall = child && child.guardian_call ? child.guardian_call : "";
    return applyTheme();
  }

  // Encouraging line for a score. Never blames: a low score gets "we are with you".
  function scoreWords(score, max) {
    var ratio = score / (max || DEFAULT_MAX);
    if (ratio >= 0.8) return "আজ তো আগুন! স্কোর দারুণ হয়েছে।";
    if (ratio >= 0.5) return "ভালো এগোচ্ছে।";
    return "চেষ্টা চলছে, আমরা পাশে আছি।";
  }

  function askButton() {
    var b = el("button", "de-btn de-btn--secondary de-btn--ask v6-ask");
    b.type = "button";
    b.setAttribute("aria-haspopup", "dialog");
    b.appendChild(window.Diffy.make("happy", "de-mascot--sm"));
    b.appendChild(document.createTextNode("ডিফিকে জিজ্ঞেস করো"));
    b.addEventListener("click", function () { window.DeToday.askDiffy(b); });
    return b;
  }

  function nudgeCard(list) {
    var card = mkCard("de-nudge");
    var head = el("div", "de-nudge__head");
    head.appendChild(window.Diffy.make("happy", "de-mascot--sm"));
    head.appendChild(el("span", "de-row__title", "ডিফি কানে কানে বলছে:"));
    card.appendChild(head);
    var ul = el("ul", "de-nudge__list");
    list.forEach(function (n) {
      var li = el("li");
      li.appendChild(el("i", "de-diamond"));
      li.appendChild(el("span", "", bn(n.text)));
      ul.appendChild(li);
    });
    card.appendChild(ul);
    card.appendChild(el("span", "de-nudge__who", "এটা তুমি, অভিভাবক ও শিক্ষক দেখতে পাও"));
    return card;
  }

  function noticeStrip(notice) {
    var button = mkCard("de-notice v6-notice", "button");
    button.type = "button";
    button.appendChild(icon("i-bell"));
    button.appendChild(el("span", "de-notice__text", bn(notice.text)));
    return button;
  }

  function nextClassCard(next) {
    var card = mkCard("");
    var row = el("div", "de-next");
    var time = el("span", "de-next__time", bn(next.time_label));
    if (next.period_label) time.appendChild(el("span", "de-row__sub", next.period_label));
    var main = el("div", "de-next__main");
    main.appendChild(el("span", "de-row__sub", "পরের ক্লাস"));
    main.appendChild(el("span", "de-row__title", bn(next.subject)));
    main.appendChild(el("span", "de-row__sub", bn([next.teacher, next.room].filter(Boolean).join(" · "))));
    row.appendChild(time);
    row.appendChild(main);
    card.appendChild(row);
    return card;
  }

  function trendCard(trend) {
    var card = mkCard("");
    var scored = trend.filter(function (d) { return d.score !== null && d.score !== undefined; });
    card.appendChild(el("span", "de-row__title", "গত ৭ দিনের স্কোর"));
    var today = trend.filter(function (d) { return d.is_today; })[0];
    var others = scored.filter(function (d) { return !d.is_today; });
    var grid = el("div", "de-trend");
    grid.setAttribute("role", "img");
    grid.setAttribute("aria-label", "গত ৭ দিনের স্কোর: " + bn(trend.map(function (d) {
      return d.day + " " + (d.score === null || d.score === undefined ? "নেই" : d.score);
    }).join(", ")));
    trend.forEach(function (d) {
      var has = d.score !== null && d.score !== undefined;
      var col = el("span", "de-trend__col");
      col.appendChild(el("span", "de-trend__val" + (d.is_today ? " de-trend__val--hi" : ""), has ? bn(d.score) : "—"));
      var track = el("span", "de-trend__track");
      var bar = el("i", "de-trend__bar" + (d.is_today ? " de-trend__bar--hi" : "") + (has ? "" : " de-trend__bar--none"));
      if (has) bar.style.setProperty("--v", Math.round(d.score / (d.score_max || DEFAULT_MAX) * 100));
      track.appendChild(bar);
      col.appendChild(track);
      col.appendChild(document.createTextNode(d.day));
      grid.appendChild(col);
    });
    card.appendChild(grid);
    if (scored.length < 2) card.appendChild(el("span", "de-row__sub", "আরও কয়েক দিনে ছবিটা পরিষ্কার হবে।"));
    return card;
  }

  // ---- hero: three layouts, ?hero=a|b|c (default a). Same data, same ডিফি, same quote; only colours and places differ. ----
  var VARIANT = (function () { var h = new URLSearchParams(window.location.search).get("hero"); return h === "b" || h === "c" ? h : "a"; })();

  function scoreInfo(today) {
    if (today.status !== "present" || today.score === null || today.score === undefined) return null;
    var max = today.score_max === null || today.score_max === undefined ? DEFAULT_MAX : today.score_max;
    return { score: today.score, max: max, ratio: today.score / max, pct: Math.max(0, Math.min(100, Math.round(today.score / max * 100))) };
  }

  function statusChip(today, cls, extra) {
    var t = today.status;
    var text = t === "present" ? "আজ কোচিংয়ে এসেছে" : t === "absent" ? "আজ অনুপস্থিত" : t === "holiday" ? "আজ ছুটি" : "এখনো হাজিরা হয়নি";
    var kind = t === "present" ? "now" : t === "absent" ? "bad" : "plain";
    return el("span", "de-chip de-chip--" + kind + (cls ? " " + cls : "") + (extra && t !== "present" ? " " + extra : ""), text);
  }

  // the line under the chip: arrival time, or a kind note
  function statusCap(today) {
    var t = today.status;
    if (t === "present") return today.arrived_at ? el("span", "de-today__cap", bn(today.arrived_at) + "-এ পৌঁছেছে") : null;
    if (t === "absent") return el("span", "de-today__cap", "আজ আসতে পারেনি। সব ঠিক আছে তো?");
    if (t === "none") return el("span", "de-today__cap", "ক্লাস শুরু হলে এখানে দেখা যাবে");
    return null;
  }

  function scoreCap(sc, today) {
    if (today.status !== "present") return null;
    return el("span", "de-today__cap", sc ? "আজকের স্কোর · " + scoreWords(sc.score, sc.max) : "স্কোর এখনো আসেনি");
  }

  // number + "of max" inside a ring, sticker or row; the wrapper carries the label, the inside is hidden from screen readers
  function scoreFace(box, sc) {
    var n = el("span", "v7-big", sc ? bn(sc.score) : "—");
    n.setAttribute("aria-hidden", "true");
    box.appendChild(n);
    if (sc) { var of = el("span", "v7-of", bn("/" + sc.max)); of.setAttribute("aria-hidden", "true"); box.appendChild(of); countUp(n, sc.score); }
    box.setAttribute("role", "img");
    box.setAttribute("aria-label", sc ? bn("আজকের স্কোর " + sc.max + "-এর মধ্যে " + sc.score) : "স্কোর এখনো আসেনি");
    return box;
  }

  function say(mood) {
    var fun = funRow(mood), row = el("div", "v7-say");
    row.appendChild(perch(mood, fun.bubble));
    row.appendChild(fun.bubble);
    return row;
  }

  function heroCard(today, streak, mood) {
    if (!today) return null;
    var sc = scoreInfo(today), note = today.status === "present" && today.teacher_note ? today.teacher_note : null;
    var cap = statusCap(today), words = scoreCap(sc, today), hero;

    if (VARIANT === "b") {
      hero = el("div", "v7-hero v7-hero--b");
      var top = el("div", "v7-top v7-glow"), left = el("div", "tg-col");
      if (today.status === "present") {
        left.appendChild(scoreFace(el("div", "v7-numrow"), sc));
        if (sc) left.appendChild(stars(sc.score, sc.max));
      } else if (cap) {
        left.appendChild(cap);
        cap = null;
      }
      top.appendChild(left);
      if (cap || words) {
        var right = el("div", "tg-col tg-col--end");
        if (cap) right.appendChild(cap);
        if (words) right.appendChild(words);
        top.appendChild(right);
      }
      hero.appendChild(top);
      var bot = el("div", "v7-bot");
      bot.appendChild(statusChip(today, "v7-tab"));
      bot.appendChild(say(mood));
      if (note) bot.appendChild(noteQuote(note));
      hero.appendChild(bot);
    } else if (VARIANT === "c") {
      hero = el("div", "v7-hero v7-hero--c");
      hero.appendChild(el("span", "v7-corner", "আজকের হিসাব"));
      var row = el("div", "v7-row"), col = el("div", "tg-col v7-info");
      if (today.status === "present") {
        var tier = !sc ? "sky" : sc.ratio >= 0.8 ? "sunny" : sc.ratio >= 0.5 ? "mint" : "sky";
        var sticker = scoreFace(el("div", "v7-sticker"), sc);
        sticker.setAttribute("data-tier", tier);
        row.appendChild(sticker);
      }
      col.appendChild(statusChip(today, "v7-pill", "v7-pill--sky"));
      if (cap) col.appendChild(cap);
      if (sc) col.appendChild(stars(sc.score, sc.max));
      if (words) col.appendChild(words);
      row.appendChild(col);
      hero.appendChild(row);
      hero.appendChild(say(mood));
      if (note) hero.appendChild(noteQuote(note));
    } else {
      hero = el("div", "v7-hero v7-hero--a v7-glow");
      var rowA = el("div", "v7-row"), info = el("div", "tg-col v7-info");
      if (today.status === "present") {
        var ring = scoreFace(el("div", "v7-ring"), sc);
        ring.style.setProperty("--v7-p", sc ? sc.pct : 0);
        rowA.appendChild(ring);
      }
      info.appendChild(statusChip(today));
      if (cap) info.appendChild(cap);
      if (sc) info.appendChild(stars(sc.score, sc.max));
      if (words) info.appendChild(words);
      rowA.appendChild(info);
      hero.appendChild(rowA);
      hero.appendChild(say(mood));
      if (note) { var ribbon = el("div", "v7-ribbon"); ribbon.appendChild(noteQuote(note)); hero.appendChild(ribbon); }
    }
    hero.setAttribute("data-hero", VARIANT);
    return hero;
  }

  // Stickers under the hero: today's star and the best day of the week.
  function stickerRow(info) {
    var t = info.today, row = el("div", "v6-stickers");
    if (t && t.status === "present" && t.score !== null && t.score !== undefined && t.score / (t.score_max || DEFAULT_MAX) >= 0.8) {
      row.appendChild(sticker("আজকের তারা", "sunny", "star"));
    }
    var trend = info.trend || [];
    var scored = trend.filter(function (d) { return d.score !== null && d.score !== undefined; });
    var today = trend.filter(function (d) { return d.is_today; })[0];
    var others = scored.filter(function (d) { return !d.is_today; });
    if (today && scored.indexOf(today) >= 0 && others.length && others.every(function (d) { return d.score < today.score; })) {
      row.appendChild(sticker("সপ্তাহের সেরা দিন", "coral", "star"));
    }
    return row.firstChild ? row : null;
  }

  function noteQuote(note) {
    var quote = el("p", "de-today__quote tg-quote");
    quote.appendChild(document.createTextNode(bn("“" + note.text + "”")));
    if (note.by) {
      quote.appendChild(el("span", "de-today__cap tg-quote-by", bn(note.by)));
    }
    return quote;
  }

  function weekCard(week, streak) {
    var card = mkCard("");

    var presentCount = week.filter(function (day) {
      return day.state === "present";
    }).length;

    var head = el("div", "de-row");
    var main = el("div", "de-row__main");
    main.appendChild(el("span", "de-row__title", "এই সপ্তাহ"));
    head.appendChild(main);
    head.appendChild(el("span", "de-row__sub tg-caption-end", bn(presentCount) + " দিন উপস্থিত"));
    card.appendChild(head);

    var grid = el("div", "de-week");
    week.forEach(function (day) {
      var dotClass = "de-week__dot";
      var label;
      if (day.state === "present") {
        label = "উপস্থিত";
        if (day.is_today) dotClass += " de-week__dot--today";
      } else if (day.state === "absent") {
        label = "অনুপস্থিত";
        dotClass += " de-week__dot--absent";
      } else {
        label = "এখনো হয়নি";
        dotClass += " de-week__dot--none";
      }

      var dot = el("i", dotClass);
      dot.setAttribute("role", "img");
      dot.setAttribute("aria-label", day.day + ": " + label);

      var item = el("span", "de-week__day");
      item.appendChild(dot);
      item.appendChild(document.createTextNode(day.day));
      grid.appendChild(item);
    });
    card.appendChild(grid);

    if (streak !== undefined && streak !== null) {
      var line = el("div", "de-streak" + (streak >= 2 ? " de-streak--fun" : ""));
      if (streak >= 2) {
        line.appendChild(sticker("টানা " + streak + " দিন!", "sunny", "diamond", true));
        line.appendChild(el("span", "", "একদিনও কামাই নেই। 🔥"));
      } else {
        line.appendChild(el("i", "de-diamond"));
        line.appendChild(el("span", "", "নিয়মিত আসা বড় অভ্যাস। আজই শুরু হোক।"));
      }
      card.appendChild(line);
    }

    return card;
  }

  function infoCard(caption, text) {
    var card = mkCard("");
    card.appendChild(el("span", "de-row__sub", caption));
    card.appendChild(el("span", "de-row__title", text));
    return card;
  }

  function homeworkNodes(list) {
    if (!list.length) {
      return [infoCard("বাড়ির কাজ", "আজ বাড়ির কাজ নেই। একটু বিশ্রাম!")];
    }
    return list.map(function (item) {
      var card = mkCard("");
      card.appendChild(el("span", "de-row__sub", bn("বাড়ির কাজ · " + item.due_label)));
      card.appendChild(el("p", "tg-heading", bn(item.subject + ", " + item.title)));
      return card;
    });
  }

  function feeCard(fee) {
    var card = mkCard("");
    var row = el("div", "de-row");
    var main = el("div", "de-row__main");
    var paid = fee.status === "paid";
    var amount = "৳\u00A0" + bn(fee.amount);

    main.appendChild(el("span", "de-row__title", bn(fee.month_label)));
    main.appendChild(el("span", "de-row__sub", paid ? amount : amount + " · " + bn(fee.due_label)));
    row.appendChild(main);

    if (paid) {
      row.appendChild(el("span", "de-chip de-chip--good", "পরিশোধিত"));
    } else {
      row.appendChild(el("span", "de-chip de-chip--warn", "বাকি"));
    }
    card.appendChild(row);
    if (window.DeToday.openFees) {   // the whole card opens the fees page (history, receipts, pay)
      card.setAttribute("role", "button");
      card.tabIndex = 0;
      card.setAttribute("aria-label", bn(fee.month_label + ", " + amount + ", " + (paid ? "পরিশোধিত" : fee.due_label) + ". ফি-র পাতা খুলুন"));
      card.classList.add("v7-feecard");
      card.addEventListener("click", function () { window.DeToday.openFees(); });
      card.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); window.DeToday.openFees(); } });
      card.appendChild(el("span", "de-row__sub v7-feecard__go", paid ? "রসিদ ও ইতিহাস দেখুন" : "ফি-র পাতা খুলুন"));
    }
    return card;
  }

  // ---- start / stop (the app mounts the markup first, then calls start) ----
  function drawTrack() {
    var d = [];
    for (var k = 0; k <= 24; k++) d.push((k ? "L" : "M") + (10 + 80 * k / 24).toFixed(1) + " " + (132 - 51 - ARC * Math.sin(Math.PI * k / 24)).toFixed(1));   // 51 = centre of the orb above the stage floor
    var track = document.getElementById("v7-track");
    if (track) track.setAttribute("d", d.join(""));
  }
  var tick = null, unsub = null, mqHandler = null, mq = null;
  function start() {
    ui.data = null; ui.notice = null; ui.theme = null; ui.confettiFor = null; ui.firstMs = null; ui.dataMs = null;
    ui.childId = readChildId();
    document.getElementById("tg-child").addEventListener("click", function (e) {
      if (ui.data && ui.data.children.length > 1) window.DeToday.openSwitcher(e.currentTarget);
    });
    setScene(null);
    drawTrack();
    tick = window.setInterval(function () { if (document.getElementById("v6-sky")) applyTheme(); }, 60000);
    unsub = window.DeSky.subscribe(function () { if (document.getElementById("v6-sky")) applyTheme(); });
    if (window.matchMedia) { mq = window.matchMedia("(prefers-color-scheme: dark)"); mqHandler = function () { if (document.getElementById("v6-sky")) applyTheme(); }; if (mq.addEventListener) mq.addEventListener("change", mqHandler); }
    window.requestAnimationFrame(function () { window.requestAnimationFrame(function () { document.documentElement.classList.add("v6-ready"); }); });
    var cached = readCache();
    if (cached) { ui.data = cached; renderLoaded(); }
    else { resetAppbar("লোড হচ্ছে…"); renderSkeleton(); }
    load();
  }
  function stop() {
    if (tick) window.clearInterval(tick);
    if (unsub) unsub();
    if (mq && mqHandler && mq.removeEventListener) mq.removeEventListener("change", mqHandler);
    tick = unsub = mq = mqHandler = null;
  }
  window.TodayV7 = {
    start: start, stop: stop, reload: retry,
    setChild: function (id) { ui.childId = id; if (ui.data) renderLoaded(); },
    updateBadge: updateBadge,
    refresh: function () { if (ui.data) renderLoaded(); },
    paintSky: function (call) { ui.greetCall = call || ""; drawTrack(); return applyTheme(); }
  };
})();

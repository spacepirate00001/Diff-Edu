// Diff Edu PWA — installation guide (Bangla, shown before login).
// Opens on ?install=1 (the printed QR code) and ?guide=1. Not shown when the app already runs installed.
// A step-by-step wizard: one step per screen, big text, plain Bangla.
// Loaded before app.js: everything is inside one IIFE and only the global `window.DeGuide` is exported.
// It uses app.js globals at call time only (esc, bn, store, toast, CFG, APK_URL, deferredInstall).
(function () {
  'use strict';
  const UA = navigator.userAgent || '';
  const OFFICE_PHONE = '01404793202';

  const isStandaloneNow = () => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch { return false; } };
  const platform = () => /Android/i.test(UA) ? 'android' : /iPhone|iPad|iPod/i.test(UA) ? 'ios' : 'other';
  const isSafariIos = () => !/CriOS|FxiOS|EdgiOS|OPiOS/.test(UA);
  const pageAddress = () => location.origin + location.pathname;

  /** Does the guide open on this visit? (installed app: never) */
  function wanted() {
    if (isStandaloneNow()) return false;
    try {
      const q = new URLSearchParams(location.search);
      return q.get('install') === '1' || q.get('guide') === '1';
    } catch { return false; }
  }

  // ---------- pictures: small inline SVG. Phone outline in plum, the thing to tap ringed in gold. ----------
  const SVG = inner => `<svg viewBox="0 0 240 180" aria-hidden="true" focusable="false">${inner}</svg>`;
  const PHONE = inner => `<rect x="75" y="6" width="90" height="168" rx="16" fill="#3B1F42"/><rect x="82" y="16" width="76" height="148" rx="6" fill="#FBF8EC"/>${inner}`;
  const RING = (x, y, w, h, r) => `<rect class="gd-ring" x="${x - 5}" y="${y - 5}" width="${w + 10}" height="${h + 10}" rx="${r + 5}" fill="none" stroke="#C2A23D" stroke-width="4.5"/>`;
  const CRING = (cx, cy, r) => `<circle class="gd-ring" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#C2A23D" stroke-width="4.5"/>`;
  const LINES = (y, n = 3) => Array.from({ length: n }, (_, k) => `<rect x="92" y="${y + k * 9}" width="${56 - k * 10}" height="4" rx="2" fill="#D9C6DC"/>`).join('');
  const ROW = y => `<rect x="88" y="${y}" width="64" height="18" rx="5" fill="#fff" stroke="#DCC4E0"/><rect x="92" y="${y + 4}" width="10" height="10" rx="3" fill="#C29DC8"/><rect x="107" y="${y + 7}" width="36" height="4" rx="2" fill="#BDBDBD"/>`;
  const ADD_LIST = hlY => SVG(PHONE(ROW(34) + ROW(58) + ROW(82) + ROW(106) + RING(88, hlY, 64, 18, 5)));
  const DIALOG = () => SVG(PHONE(
    '<rect x="84" y="56" width="72" height="66" rx="8" fill="#fff" stroke="#C29DC8" stroke-width="1.5"/>' +
    '<rect x="92" y="68" width="56" height="5" rx="2.5" fill="#7E4B87"/>' + LINES(80, 2) +
    '<rect x="92" y="102" width="26" height="10" rx="5" fill="#E6E1E8"/><rect x="124" y="102" width="24" height="10" rx="5" fill="#0B57D0"/>' +
    RING(124, 102, 24, 10, 5)));

  const PIC = {
    welcome: () => '<img class="gd-logo-img" src="logo.svg" alt="">',
    addlist82: () => ADD_LIST(82),
    addlist58: () => ADD_LIST(58),
    dialog: DIALOG,
    download: () => SVG(PHONE(LINES(30) +
      '<path d="M120 60v26m-8-8l8 8 8-8" stroke="#502A58" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<rect x="90" y="108" width="60" height="22" rx="11" fill="#E2CE7E"/>' + RING(90, 108, 60, 22, 11))),
    warn: () => SVG(PHONE(
      '<rect x="86" y="40" width="68" height="84" rx="8" fill="#fff" stroke="#C29DC8" stroke-width="1.5"/>' + LINES(50) +
      '<rect x="92" y="104" width="26" height="14" rx="7" fill="#E6E1E8"/><rect x="122" y="104" width="30" height="14" rx="7" fill="#502A58"/>' +
      RING(122, 104, 30, 14, 7))),
    notif: () => SVG(PHONE(
      '<rect x="86" y="24" width="68" height="34" rx="8" fill="#EEE2F0"/><circle cx="97" cy="41" r="6" fill="#7E4B87"/>' +
      '<rect x="108" y="36" width="36" height="4" rx="2" fill="#7E4B87"/><rect x="108" y="44" width="26" height="4" rx="2" fill="#C29DC8"/>' +
      '<rect x="86" y="72" width="68" height="16" rx="6" fill="#fff" stroke="#DCC4E0"/><rect x="92" y="78" width="40" height="4" rx="2" fill="#D9C6DC"/>' +
      RING(86, 24, 68, 34, 8))),
    settings: () => SVG(PHONE(
      '<path d="M104 28H92m5-5l-5 5 5 5" stroke="#502A58" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<rect x="88" y="58" width="64" height="20" rx="5" fill="#fff" stroke="#DCC4E0"/><rect x="92" y="65" width="36" height="5" rx="2" fill="#BDBDBD"/>' +
      '<rect x="128" y="62" width="18" height="10" rx="5" fill="#7E4B87"/><circle cx="143" cy="67" r="4" fill="#fff"/>' +
      RING(128, 62, 18, 10, 5))),
    protect: () => SVG(PHONE(
      '<rect x="86" y="36" width="68" height="104" rx="8" fill="#fff" stroke="#C29DC8" stroke-width="1.5"/>' +
      '<path d="M120 46l12 4v9c0 8-5 13-12 16-7-3-12-8-12-16v-9z" fill="#502A58"/>' +
      '<rect x="98" y="88" width="44" height="4" rx="2" fill="#BDBDBD"/><rect x="104" y="96" width="32" height="4" rx="2" fill="#D9C6DC"/>' +
      '<rect x="92" y="108" width="56" height="12" rx="6" fill="#E2CE7E"/><rect x="92" y="124" width="56" height="12" rx="6" fill="#E6E1E8"/>' +
      RING(92, 108, 56, 12, 6))),
    install: () => SVG(PHONE(
      '<rect x="90" y="36" width="60" height="50" rx="8" fill="#EEE2F0"/><rect x="100" y="46" width="22" height="22" rx="6" fill="#7E4B87"/>' +
      '<rect x="90" y="108" width="60" height="22" rx="11" fill="#502A58"/>' + RING(90, 108, 60, 22, 11))),
    safari: () => SVG(PHONE(
      '<rect x="86" y="22" width="68" height="18" rx="9" fill="#EEE2F0"/><rect x="92" y="28" width="30" height="6" rx="3" fill="#7E4B87"/>' +
      LINES(56) + '<rect x="82" y="142" width="76" height="16" fill="#EEE2F0"/>' + RING(86, 22, 68, 18, 9))),
    share: () => SVG(PHONE(
      LINES(40) + '<rect x="82" y="138" width="76" height="20" fill="#F3EEF5"/>' +
      '<path d="M120 142v10m-4-6l4-4 4 4" stroke="#502A58" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M113 148h-3v8h14v-8h-3" stroke="#502A58" stroke-width="2.4" fill="none" stroke-linejoin="round"/>' +
      RING(108, 137, 24, 22, 6))),
    addbtn: () => SVG(PHONE(
      '<rect x="86" y="24" width="28" height="12" rx="6" fill="#DDD"/><rect x="126" y="24" width="28" height="12" rx="6" fill="#502A58"/>' +
      '<rect x="88" y="50" width="64" height="40" rx="6" fill="#EEE2F0"/><rect x="104" y="58" width="32" height="22" rx="6" fill="#502A58"/>' +
      RING(126, 24, 28, 12, 6))),
    menu: () => SVG(PHONE(
      '<rect x="84" y="18" width="72" height="18" rx="5" fill="#EEE2F0"/>' + LINES(56) + LINES(80, 2) +
      '<circle cx="146" cy="22" r="2" fill="#502A58"/><circle cx="146" cy="27" r="2" fill="#502A58"/><circle cx="146" cy="32" r="2" fill="#502A58"/>' +
      CRING(146, 27, 10))),
    btnBig: () => SVG(PHONE(LINES(34) +
      '<rect x="90" y="96" width="60" height="24" rx="12" fill="#E2CE7E"/>' + RING(90, 96, 60, 24, 12))),
    grid: () => SVG(PHONE(
      '<rect x="92" y="40" width="22" height="22" rx="6" fill="#DCC4E0"/><rect x="126" y="40" width="22" height="22" rx="6" fill="#DCC4E0"/>' +
      '<rect x="92" y="76" width="22" height="22" rx="6" fill="#DCC4E0"/><rect x="126" y="76" width="22" height="22" rx="6" fill="#502A58"/>' +
      '<circle cx="137" cy="87" r="4" fill="#E2CE7E"/>' + RING(126, 76, 22, 22, 6))),
    check: () => SVG(PHONE(
      '<circle cx="120" cy="90" r="26" fill="#E2CE7E"/>' +
      '<path d="M106 90l10 10 18-20" stroke="#502A58" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>')),
    desk: () => {
      // a decorative QR-like square: three finder corners and a fixed pattern
      const N = 11, cell = 12, ox = (240 - N * cell) / 2, oy = (180 - N * cell) / 2;
      let s = '';
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const finder = (r < 3 && c < 3) || (r < 3 && c >= N - 3) || (r >= N - 3 && c < 3);
        if (finder || (r * 3 + c * 7) % 4 === 0) s += `<rect x="${ox + c * cell}" y="${oy + r * cell}" width="${cell - 1}" height="${cell - 1}" rx="2" fill="#3B1F42"/>`;
      }
      return SVG(s);
    },
  };

  /** A lookalike of what the phone shows (Chrome / Android / iPhone style). Static text only. */
  const LOOK = (title, btns = [], cap = 'যদি এমন লেখা আসে') =>
    `<div class="gd-look"><div class="gd-look-cap">${cap}</div><div class="gd-fake"><div>${title}</div>` +
    (btns.length ? `<div class="gd-fake-b">${btns.map(b => `<span>${b}</span>`).join('')}</div>` : '') + '</div></div>';

  const step = (title, pic, alt, lead, body = () => '') => ({ kind: 'step', title, pic, alt, lead, body });
  const FINAL = note => ({ kind: 'final', note });
  const addrBox = c => `<div class="gd-addr" id="gd-addr">${esc(c.addr)}</div><button class="gd-btn ghost" data-gd="copy">লিংক কপি করুন</button>`;

  /** Android: download the APK (the recommended path). */
  const APK = [
    step('অ্যাপটি নামান', 'download', 'ছবি: বড় সোনালি বোতাম', 'নিচের বড় বোতামে চাপুন। ফাইলটি ফোনে নামবে।', c =>
      `<a class="gd-btn gold" href="${esc(APK_URL)}" download>অ্যাপ নামান</a>` +
      `<div class="gd-small">প্রায় ${esc(bn(sizeMb(c)))} MB, সামান্য নেট লাগবে</div>`),
    step('সতর্কবার্তায় ‘রাখুন’ চাপুন', 'warn', 'ছবি: সতর্কবার্তার বাক্স, ‘Keep’ বোতাম ঘেরা',
      'ইন্টারনেট দেখার অ্যাপ (যেমন Chrome) সতর্ক করতে পারে। এটি স্বাভাবিক।', () =>
      LOOK('This type of file can harm your device<br><small>এই ধরনের ফাইল আপনার ডিভাইসের ক্ষতি করতে পারে</small>', ['Delete', 'Keep']) +
      '<div class="gd-small">‘Keep (রাখুন)’ চাপুন। ‘Delete’ চাপবেন না।</div>'),
    step('নামানো ফাইলটি খুলুন', 'notif', 'ছবি: ওপরের নোটিফিকেশন ঘেরা',
      'নোটিফিকেশনে ‘Download complete (ডাউনলোড সম্পন্ন)’ লেখাটিতে চাপুন।', () =>
      '<div class="gd-small">নোটিফিকেশন না পেলে ‘Files (ফাইল)’ অ্যাপ খুলুন। তারপর ‘Download (ডাউনলোড)’ ফোল্ডারে যান।</div>' +
      '<div class="gd-small">সেখানে ‘DiffEdu’ ফাইলটিতে চাপুন।</div>'),
    step('ইনস্টলের অনুমতি দিন', 'settings', 'ছবি: সেটিংসের সুইচ ঘেরা',
      'যদি ‘অজানা অ্যাপ ইনস্টল বন্ধ আছে’ লেখা আসে, এই ধাপগুলো করুন।', () =>
      LOOK('অজানা অ্যাপ ইনস্টল বন্ধ আছে<br><small>Install unknown apps is blocked</small>', ['Settings (সেটিংস)', 'Cancel']) +
      '<ol class="gd-list"><li>‘Settings (সেটিংস)’ চাপুন।</li>' +
      '<li>‘Allow from this source (এই অ্যাপকে অনুমতি দিন)’ সুইচটি চালু করুন।</li>' +
      '<li>ওপরের বাঁ দিকের তীর ← চাপুন।</li></ol>' +
      '<div class="gd-small">এই লেখা না এলে এই ধাপ বাদ দিন।</div>'),
    step('Play Protect লেখা এলে', 'protect', 'ছবি: Play Protect বার্তা, ‘আরও দেখুন’ ঘেরা',
      'ভয় পাবেন না। অ্যাপটি ডিফ এডু কোচিং অফিসেরই।', () =>
      LOOK('এই অ্যাপটি সাধারণত দেখা যায় না<br><small>Google Play Protect</small>', ['More details (আরও দেখুন)', 'Install anyway (তবুও ইনস্টল করুন)']) +
      '<div class="gd-small">প্রথমে ‘আরও দেখুন’ চাপুন। তারপর ‘তবুও ইনস্টল করুন’ চাপুন।</div>'),
    step('ইনস্টল করুন, তারপর খুলুন', 'install', 'ছবি: নিচের ইনস্টল বোতাম ঘেরা',
      'প্রথমে ‘Install (ইনস্টল)’ চাপুন। শেষ হলে ‘Open (খুলুন)’ চাপুন।'),
    FINAL(''),
  ];

  /** iPhone: Safari and the Share sheet. */
  const IOS = [
    step('Safari খুলুন', 'safari', 'ছবি: ওপরের ঠিকানার ঘর ঘেরা', '', c => {
      if (c.plat === 'ios' && c.safari) return '<div class="gd-lead">ভালো। আপনি Safari-তেই আছেন।</div>';
      if (c.plat === 'ios') return '<div class="gd-lead">আপনি এখন ইন্টারনেট দেখার অ্যাপে আছেন (যেমন Chrome)। iPhone-এ শুধু Safari দিয়ে হোম স্ক্রিনে রাখা যায়।</div>' +
        '<div class="gd-small">নিচের ঠিকানাটি কপি করুন। তারপর Safari খুলে সেখানে পেস্ট করুন।</div>' + addrBox(c);
      // opened on a phone that is not an iPhone, or on a computer: copy the address for the iPhone
      return '<div class="gd-lead">আপনার iPhone-এ এই পাতাটি Safari-তে খুলুন। iPhone-এ শুধু Safari দিয়ে হোম স্ক্রিনে রাখা যায়।</div>' +
        '<div class="gd-small">নিচের ঠিকানাটি কপি করুন। তারপর iPhone-এর Safari-তে পেস্ট করুন।</div>' + addrBox(c);
    }),
    step('নিচের মাঝের শেয়ার বোতামে চাপুন', 'share', 'ছবি: নিচের শেয়ার বোতাম ঘেরা',
      'বাক্সের মতো বোতাম। তার থেকে একটি তীর ওপরে উঠছে।'),
    step('‘হোম স্ক্রিনে যোগ করুন’ বেছে নিন', 'addlist82', 'ছবি: তালিকার তৃতীয় সারি ঘেরা',
      'তালিকাটি নিচের দিকে টানুন।', () => LOOK('Add to Home Screen<br><small>হোম স্ক্রিনে যোগ করুন</small>')),
    step('‘যোগ করুন’ চাপুন', 'addbtn', 'ছবি: ওপরের ডান কোণের ‘Add’ ঘেরা',
      'ওপরের ডান কোণে ‘Add (যোগ করুন)’ লেখাটিতে চাপুন।'),
    FINAL('হোম স্ক্রিনের ‘ডিফ এডু’ আইকনে চাপুন। তারপর লগইন করুন।'),
  ];

  /** Android without the download: add to the home screen from Chrome's menu, or the install prompt. */
  const HOME_PROMPT = [
    step('নিচের বোতামে চাপুন', 'btnBig', 'ছবি: বড় সোনালি ইনস্টল বোতাম', 'বোতামে চাপলে একটি ছোট প্রশ্ন আসবে।', () =>
      '<button class="gd-btn gold" data-gd="install">ইনস্টল করুন</button>'),
    step('‘Install’ চাপুন', 'dialog', 'ছবি: প্রশ্নের বাক্সে ‘Install’ ঘেরা',
      'প্রশ্নটি এলে ‘Install (ইনস্টল)’ চাপুন।', () => LOOK('Install app?<br><small>অ্যাপটি ইনস্টল করবেন?</small>', ['Cancel (বাতিল)', 'Install (ইনস্টল)'])),
    step('হোম স্ক্রিনে আইকন দেখুন', 'grid', 'ছবি: হোম স্ক্রিনে ডিফ এডু আইকন ঘেরা',
      'আইকনে চাপলে অ্যাপ খুলবে। তারপর লগইন করুন।'),
    FINAL('হোম স্ক্রিনের ‘ডিফ এডু’ আইকন থেকে অ্যাপটি খুলুন।'),
  ];
  const HOME_MENU = [
    step('উপরের ডান কোণে ⋮ চাপুন', 'menu', 'ছবি: ওপরের ডান কোণের তিন বিন্দু ঘেরা', 'এটি Chrome-এর মেনু বোতাম।'),
    step('‘হোম স্ক্রিনে যোগ করুন’ চাপুন', 'addlist58', 'ছবি: তালিকার দ্বিতীয় সারি ঘেরা',
      'তালিকায় ‘Add to Home screen (হোম স্ক্রিনে যোগ করুন)’ খুঁজে চাপুন।'),
    step('‘Add (যোগ করুন)’ চাপুন', 'dialog', 'ছবি: প্রশ্নের বাক্সে ‘Add’ ঘেরা', 'একটি প্রশ্ন আসবে। সেখানে ‘Add’ চাপুন।'),
    FINAL('হোম স্ক্রিনের ‘ডিফ এডু’ আইকন থেকে অ্যাপটি খুলুন।'),
  ];

  /** Desktop: open the page on the phone. */
  const DESK = {
    kind: 'desk', pic: 'desk', alt: 'ছবি: QR কোড',
    title: 'এই পাতাটি আপনার ফোনে খুলুন',
    lead: 'ফোনের ক্যামেরা দিয়ে QR কোডটি ধরুন। অথবা নিচের ঠিকানাটি ফোনে লিখুন।',
  };
  const WELCOME = { kind: 'welcome', pic: 'welcome', alt: 'ডিফ এডু লোগো', title: 'ডিফ এডু অ্যাপ নিন' };

  function sizeMb(c) {
    const mb = c.size ? c.size / 1048576 : 2;
    return String(Math.round(mb * 10) / 10);     // "2" or "1.4"
  }

  /** Each flow is a list of screens; the last one is the final screen. */
  function flowOf(name, c) {
    if (name === 'apk') return APK;
    if (name === 'ios') return IOS;
    if (name === 'home') return (deferredInstall && !c.used) ? HOME_PROMPT : HOME_MENU;
    return [];
  }

  /** Opens the full-screen guide; resolves when it is closed (then the normal login boot continues). */
  function show() {
    return new Promise(resolve => {
      const plat = platform();
      const c = { plat, safari: isSafariIos(), addr: pageAddress(), version: '', size: 0, used: false };
      const stack = [plat === 'other' ? { flow: 'desk', i: 0 } : { flow: 'welcome', i: 0 }];
      const ov = document.createElement('div');
      ov.id = 'guide';
      ov.className = 'gd-ov';
      ov.setAttribute('role', 'dialog');
      ov.setAttribute('aria-modal', 'true');
      ov.setAttribute('aria-label', 'অ্যাপ ইনস্টল গাইড');
      let done = false;

      const top = () => stack[stack.length - 1];
      /** The screen on top of the stack, with its flow list (a flow is a list of screens). */
      const current = () => {
        const t = top();
        if (t.flow === 'welcome') return { s: WELCOME, list: [WELCOME] };
        if (t.flow === 'desk') return { s: DESK, list: [DESK] };
        const list = flowOf(t.flow, c);
        return { s: list[t.i], list };
      };

      /** One screen: top bar with the step count, the picture, the title, the text, the buttons. */
      function view() {
        const t = top();
        const { s, list } = current();
        const steps = list.filter(x => x.kind === 'step').length;
        let count = 'ডিফ এডু', pct = 0, bar = false;
        if (s.kind === 'step') { count = `ধাপ ${bn(t.i + 1)} / ${bn(steps)}`; pct = (t.i + 1) / steps * 100; bar = true; }
        else if (s.kind === 'final') { count = 'শেষ'; pct = 100; bar = true; }

        const head = `<div class="gd-top"><div class="gd-in"><div class="gd-top-row">` +
          `<div class="gd-count" aria-live="polite">${count}</div>` +
          `<button class="gd-x" data-gd="close">বন্ধ করুন</button></div>` +
          (bar ? `<div class="gd-bar" role="progressbar" aria-label="অগ্রগতি" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><i style="width:${pct}%"></i></div>` : '') +
          `</div></div>`;

        let pic = '', title = '', lead = '', body = '';
        if (s.kind === 'welcome') {
          pic = PIC.welcome(); title = WELCOME.title;
          lead = `${bn(plat === 'ios' ? 4 : 6)}টি ছোট ধাপ। ২ মিনিট লাগবে।`;
          body = plat === 'ios'
            ? '<button class="gd-link" data-gd="flow:apk">আমার Android আছে</button>'
            : '<button class="gd-link" data-gd="flow:ios">আমার iPhone আছে</button>' +
              '<button class="gd-link" data-gd="flow:home">হোম স্ক্রিনে রাখুন (ডাউনলোড ছাড়া)</button>';
          body += '<button class="gd-link" data-gd="close">অ্যাপ ছাড়া ব্রাউজারেই দেখি</button>';
        } else if (s.kind === 'desk') {
          pic = PIC.desk(); title = DESK.title; lead = DESK.lead;
          body = `<div class="gd-look">${addrBox(c)}</div>` +
            '<div class="gd-links"><button class="gd-link" data-gd="flow:apk">অ্যান্ড্রয়েড ফোনের ধাপ দেখুন</button>' +
            '<button class="gd-link" data-gd="flow:ios">iPhone-এর ধাপ দেখুন</button></div>';
        } else if (s.kind === 'final') {
          pic = PIC.check(); title = 'হয়ে গেছে! এবার লগইন';
          lead = 'অফিস থেকে আইডি এবং পিন জেনে নিন। প্রথমবার নিজের একটা পিন বানাতে হবে।';
          body = `<a class="gd-btn gold" href="tel:${OFFICE_PHONE}">অফিসে ফোন করুন<span class="gd-phone">${bn(OFFICE_PHONE)}</span></a>` +
            (s.note ? `<div class="gd-small">${esc(s.note)}</div>` : '') +
            (c.version ? `<div class="gd-small">সর্বশেষ সংস্করণ ${esc(bn(c.version))}</div>` : '');
        } else {
          pic = PIC[s.pic] ? PIC[s.pic]() : ''; title = s.title; lead = s.lead;
          body = s.body(c);
        }

        const main = `<main class="gd-main"><div class="gd-in">` +
          `<div class="gd-pic" role="img" aria-label="${esc(s.alt || title)}">${pic}</div>` +
          `<h1 class="gd-h1" tabindex="-1">${title}</h1>` +
          (lead ? `<p class="gd-lead">${lead}</p>` : '') +
          body + `</div></main>`;

        let nav = '';
        const prev = stack.length > 1 ? '<button class="gd-btn ghost gd-prev" data-gd="prev">আগের ধাপ</button>' : '';
        if (s.kind === 'welcome') nav = '<button class="gd-btn" data-gd="start">শুরু করি</button>';
        else if (s.kind === 'desk') nav = '';
        else if (s.kind === 'final') nav = `<div class="gd-nav-row">${prev}<button class="gd-btn" data-gd="close">ঠিক আছে, লগইনে যাই</button></div>`;
        else nav = `<div class="gd-nav-row">${prev}<button class="gd-btn" data-gd="next">পরের ধাপ</button></div>`;
        const foot = nav ? `<footer class="gd-nav"><div class="gd-in">${nav}</div></footer>` : '';

        return head + main + foot;
      }

      /** Repaints the screen. focus: true moves the cursor to the new title (step changes); false keeps the scroll place. */
      function paint(focus) {
        const old = ov.querySelector('.gd-main');
        const y = old ? old.scrollTop : 0;
        ov.innerHTML = view();
        const main = ov.querySelector('.gd-main');
        if (main) main.scrollTop = focus ? 0 : y;
        if (focus) ov.querySelector('.gd-h1')?.focus({ preventScroll: true });
      }
      const go = (flow, i = 0) => { stack.push({ flow, i }); paint(true); };

      const close = (fromPop = false) => {
        if (done) return;
        done = true;
        window.removeEventListener('beforeinstallprompt', onPrompt);
        window.removeEventListener('appinstalled', onInstalled);
        window.removeEventListener('popstate', onPop);
        ov.remove();
        store.set('installSeen', true);                   // the small install sheet stays away on this visit
        stripUrl(fromPop);
        resolve();
      };

      /** Removes ?install=1 from the address. The extra history entry added by show() is removed too. */
      function stripUrl(fromPop) {
        try {
          if (!fromPop && history.state && history.state.deGuide) {
            const fix = () => { window.removeEventListener('popstate', fix); try { history.replaceState(null, '', pageAddress()); } catch { /* keep */ } };
            window.addEventListener('popstate', fix);
            history.back();
          } else {
            history.replaceState(null, '', pageAddress());
          }
        } catch { /* keep the URL */ }
      }

      // The phone's back gesture steps back inside the guide; on the first screen it closes the guide (never a sudden exit).
      const onPop = () => {
        if (done) return;
        if (stack.length > 1) {
          stack.pop();
          try { history.pushState({ deGuide: 1 }, '', location.href); } catch { /* ignore */ }
          paint(true);
        } else close(true);
      };

      // The browser may offer the install prompt after the guide is already on screen.
      // app.js's listener runs after this one, so repaint on the next tick.
      const onPrompt = () => setTimeout(() => {
        if (ov.isConnected && top().flow === 'home' && top().i === 0) paint(false);
      }, 0);

      async function installNow() {
        const ev = deferredInstall;
        if (!ev) { paint(false); return; }
        deferredInstall = null;
        c.used = true;
        try {
          ev.prompt();
          const choice = await ev.userChoice;
          if (choice?.outcome === 'accepted') {
            const list = flowOf('home', c);
            stack.push({ flow: 'home', i: list.length - 1 });
            paint(true);
          } else {
            toast('ইনস্টল হয়নি। এবার ⋮ মেনু থেকে চেষ্টা করুন।');
            paint(true);
          }
        } catch { paint(false); }
      }

      async function copyAddress() {
        try { await navigator.clipboard.writeText(c.addr); toast('লিংক কপি হয়েছে।'); }
        catch {
          try {
            const el = ov.querySelector('#gd-addr');
            const r = document.createRange(); r.selectNodeContents(el);
            const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
          } catch { /* nothing to select */ }
          toast('ঠিকানাটি বেছে নিয়ে কপি করুন।');
        }
      }

      ov.addEventListener('click', e => {
        const t = e.target.closest?.('[data-gd]');
        if (!t) return;
        const a = t.dataset.gd;
        if (a === 'close') close();
        else if (a === 'start') go(plat === 'ios' ? 'ios' : 'apk');
        else if (a.startsWith('flow:')) go(a.slice(5));
        else if (a === 'next') { const tp = top(); stack.push({ flow: tp.flow, i: tp.i + 1 }); paint(true); }
        else if (a === 'prev') { if (stack.length > 1) { stack.pop(); paint(true); } }
        else if (a === 'install') installNow();
        else if (a === 'copy') copyAddress();
      });

      const onInstalled = () => close();
      window.addEventListener('beforeinstallprompt', onPrompt);
      window.addEventListener('appinstalled', onInstalled);
      window.addEventListener('popstate', onPop);
      // the entry show() adds lets the phone's back gesture stay inside the guide
      try { history.pushState({ deGuide: 1 }, '', location.href); } catch { /* ignore */ }
      document.body.appendChild(ov);
      paint(true);

      // Published app version (and APK size); fails silently, the page works without it.
      fetch(CFG.url + '/storage/v1/object/public/app-updates/version.json', { cache: 'no-store' })
        .then(r => r.json())
        .then(v => { c.version = v?.versionName || ''; c.size = +v?.size || 0; if (ov.isConnected) paint(false); })
        .catch(() => {});
    });
  }

  window.DeGuide = { wanted, show };
})();

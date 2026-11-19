// Diff Edu PWA — installation guide (Bangla, shown before login).
// Opens on ?install=1 (the printed QR code) and ?guide=1. Not shown when the app already runs installed.
// A step-by-step wizard: one step per screen, big text, plain Bangla.
// Loaded before app.js: everything is inside one IIFE and only the global `window.DeGuide` is exported.
// It uses app.js globals at call time only (esc, bn, store, toast, CFG, APK_URL, deferredInstall).
(function () {
  'use strict';
  const UA = navigator.userAgent || '';
  const OFFICE_PHONE = '01404793202';
  const REDUCED = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();

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
  const LANDING = { kind: 'landing', alt: 'ডিফারেন্ট এডুকেশন সেন্টার' };

  const WA = '8801517103656';            // WhatsApp / phone of the coaching
  const CALL_NO = '01716057167';         // (not PHONE: that name is the phone-outline picture helper above)
  const CLASSES = [
    { name: '১ম শ্রেণি', size: 'প্রতি ব্যাচে ১৫ জন', text: 'আপনার স্নেহের সোনামণিকে স্নেহ ও ভালোবাসার পরশে হাতে-কলমে আনন্দের সঙ্গে পাঠদান।' },
    { name: '২য় শ্রেণি', size: 'প্রতি ব্যাচে ১৫ জন', text: 'জিলা, গার্লস ও পুলিশ <span class="ld-sys">লাইন্স</span> স্কুলে ভর্তি পরীক্ষার উপযোগী পাঠদান। পাঠ্যবইয়ের প্রতিটি লাইন বিশ্লেষণ করে বাংলা, ইংরেজি ও গণিতের শিটের মাধ্যমে পাঠদান। মার্চ–এপ্রিলের মধ্যেই সম্পূর্ণ বোর্ড বই শেষ করা হবে, এরপর সারা বছর রিভিশন ও পরীক্ষা।' },
    { name: '৩য় – ৫ম শ্রেণি', size: 'প্রতি ব্যাচে ২০ জন', text: 'স্কুল সিলেবাস অনুযায়ী পাঠ্যবইয়ের প্রতিটি লাইন বিশ্লেষণ করে পাঠদান। বৃত্তি পরীক্ষার্থীদের আলাদা ব্যাচে জুলাই মাসের মধ্যেই পাঠ্যবই সম্পূর্ণ শেষ করানো হবে, এরপর রিভিশন ও নিয়মিত পরীক্ষা।' },
    { name: '৬ষ্ঠ – ৮ম শ্রেণি', size: 'প্রতি ব্যাচে ২০ জন', text: 'স্কুল সিলেবাস অনুযায়ী পাঠ্যবইয়ের প্রতিটি লাইন বিশ্লেষণ করে পাঠদান। বৃত্তি পরীক্ষার্থীদের আলাদা ব্যাচে জুলাই মাসের মধ্যেই পাঠ্যবই সম্পূর্ণ শেষ করানো হবে, এরপর রিভিশন ও নিয়মিত পরীক্ষা।' },
  ];
  const BATCHES = [
    { name: 'প্রভাতি ব্যাচ', chip: 'সকাল', text: 'সকালবেলার ব্যাচ — সতেজ মনে দিনের পড়া শুরু।' },
    { name: 'দিবা ব্যাচ', chip: 'দিন', text: 'দিনের ব্যাচ — স্কুল শেষে নিশ্চিন্তে পড়ার সুযোগ।' },
    { name: 'সন্ধ্যাকালীন ব্যাচ', chip: 'সন্ধ্যা', text: 'সন্ধ্যা ৬টা থেকে রাত ১০টা — স্পেশাল ম্যারাথন ব্যাচ। স্কুলের পড়া এখানেই সম্পূর্ণ করিয়ে দেওয়া হয়।' },
  ];
  /** days left of the 50% admission offer (until the end of 31 December 2026); negative = over */
  const offerDaysLeft = () => Math.ceil((new Date(2026, 11, 31, 23, 59, 59).getTime() - Date.now()) / 86400000);

  /** The first screen: the chalkboard hero, notebook Q&A, batch finder, app preview, facts, programs, contact. Static text only. */
  function landingHtml(c) {
    const ticks = items => `<ul class="ld-ticks">${items.map(t => `<li>${t}</li>`).join('')}</ul>`;
    const left = offerDaysLeft();
    const cls = c.cls ? CLASSES[c.cls - 1] : null;
    const bt = c.bt ? BATCHES[c.bt - 1] : null;
    const chips = (list, key) => list.map((x, i) =>
      `<button class="ld-chip${c[key] === i + 1 ? ' on' : ''}" data-gd="${key}:${i + 1}" aria-pressed="${c[key] === i + 1}">${x.label}</button>`).join('');
    const clsChips = chips(CLASSES.map(k => ({ label: k.name })), 'cls');
    const btChips = chips(BATCHES.map(b => ({ label: `${b.chip} · ${b.name}` })), 'bt');
    const msg = cls && bt ? 'আসসালামু আলাইকুম। আমি আমার সন্তানকে ' + cls.name + 'র ' + bt.name + 'ে ভর্তি করাতে আগ্রহী। অনুগ্রহ করে বিস্তারিত জানাবেন।' : '';
    const result = cls && bt
      ? `<div class="ld-result-card"><div class="ld-kicker">আপনার সন্তানের জন্য উপযুক্ত</div>` +
        `<div class="ld-pick">${cls.name} · ${bt.name}</div>` +
        `<p>${cls.text}</p>` +
        `<p><b>${bt.name}:</b> ${bt.text}</p>` +
        `<div class="ld-pill">${cls.size}</div>` +
        (c.cls >= 3 ? `<p class="ld-hl">৫ম ও ৮ম শ্রেণির বৃত্তি পরীক্ষার্থীদের একই বেতনে আলাদা ব্যাচ।</p>` : '') +
        (left >= 0 ? `<p class="ld-hl">এখনই ভর্তি হলে ভর্তিতে ৫০% ছাড়।</p>` : '') +
        `<a class="gd-btn gold" href="https://wa.me/${WA}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">WhatsApp-এ ভর্তির কথা বলুন</a>` +
        `<a class="gd-btn ghost" href="tel:${CALL_NO}">কল করুন</a></div>`
      : `<div class="gd-small">শ্রেণি আর সময় বেছে নিন — ব্যাচের পুরো বিবরণ এখানেই দেখতে পাবেন।</div>`;
    const appBtns = c.plat === 'android'
      ? '<button class="gd-btn gold" data-gd="flow:apk">অ্যাপ ডাউনলোড করুন (Android)</button>' +
        '<button class="gd-link" data-gd="flow:home">ডাউনলোড ছাড়া হোম স্ক্রিনে রাখুন</button>' +
        '<button class="gd-link" data-gd="flow:ios">আমার iPhone আছে</button>'
      : c.plat === 'ios'
        ? '<button class="gd-btn gold" data-gd="flow:ios">iPhone-এ অ্যাপ নিন</button>' +
          '<button class="gd-link" data-gd="flow:apk">আমার Android আছে</button>'
        : '<div class="gd-small">এই পাতাটি ফোনে খুলুন:</div>' + addrBox(c) +
          '<button class="gd-link" data-gd="flow:apk">অ্যান্ড্রয়েড ফোনের ধাপ দেখুন</button>' +
          '<button class="gd-link" data-gd="flow:ios">iPhone-এর ধাপ দেখুন</button>';
    return `<section class="ld-board">
  <i class="ld-screw s1"></i><i class="ld-screw s2"></i><i class="ld-screw s3"></i><i class="ld-screw s4"></i>
  <div class="ld-dust" aria-hidden="true"></div>
  <span class="ld-dd d1" aria-hidden="true">A B C</span>
  <span class="ld-dd d2" aria-hidden="true">ক খ গ</span>
  <span class="ld-dd d3" aria-hidden="true">১ + ১ = ২</span>
  <span class="ld-dd d4" aria-hidden="true">২ × ৩ = ৬</span>
  <span class="ld-dd d5" aria-hidden="true">a² + b² = c²</span>
  <svg class="ld-ds s-circle" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" pathLength="100"/></svg>
  <svg class="ld-ds s-tri" viewBox="0 0 44 40" aria-hidden="true"><path d="M4 36 L40 36 L40 4 Z" pathLength="100"/></svg>
  <svg class="ld-ds s-star" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3 L25 15 L38 15 L27.5 23 L31.5 36 L20 28 L8.5 36 L12.5 23 L2 15 L15 15 Z" pathLength="100"/></svg>
  <svg class="ld-ds s-tick" viewBox="0 0 40 30" aria-hidden="true"><path d="M3 16 L14 27 L37 3" pathLength="100"/></svg>
  <div class="ld-badge">ভর্তি চলছে!</div>
  <img class="ld-logo" src="logo.svg" alt="">
  <h1 class="ld-name" tabindex="-1">ডিফারেন্ট এডুকেশন সেন্টার<i class="ld-stick" aria-hidden="true"></i><b class="ld-crumb" aria-hidden="true"></b><b class="ld-crumb" aria-hidden="true"></b><b class="ld-crumb" aria-hidden="true"></b><b class="ld-crumb" aria-hidden="true"></b><b class="ld-crumb" aria-hidden="true"></b><b class="ld-crumb" aria-hidden="true"></b></h1>
  <svg class="ld-uline" viewBox="0 0 220 12" preserveAspectRatio="none" aria-hidden="true"><path d="M3 8 C 50 3, 110 11, 160 5 S 210 6, 217 4" pathLength="100"/></svg>
  <div class="ld-chalk">প্রতিটি শিশুই আলাদা</div>
  <div class="ld-sub">স্পেশাল একাডেমিক এন্ড এক্সাম কেয়ার · ১ম–৮ম শ্রেণি</div>
  <div class="ld-tray" aria-hidden="true"><b class="ld-duster"></b><i></i><i></i><i></i></div>
</section>` +
      `<section class="ld-note ld-rv">` +
        `<div class="ld-q"><b>প্রশ্ন</b></div>` +
        `<div>১। আপনি কি সন্তানের পড়ালেখা নিয়ে চিন্তিত?</div>` +
        `<div>২। সন্তানকে পর্যাপ্ত সময় দিতে পারছেন না?</div>` +
        `<div>৩। সন্তান কি পড়ালেখায় অমনোযোগী?</div>` +
        `<div class="ld-a"><b>উত্তর</b></div>` +
        `<div class="ld-ans">ডিফারেন্ট এডুকেশন সেন্টার<i class="ld-pencil" aria-hidden="true"></i></div>` +
      `</section>` +
      (left >= 0
        ? `<section class="ld-offer ld-rv"><div>ডিসেম্বর ২০২৬-এর মধ্যে ভর্তি হলেই</div><b>ভর্তিতে ৫০% ছাড়!</b><span class="ld-days">অফার শেষ হতে আর ${bn(left)} দিন</span></section>`
        : '') +
      `<section class="ld-note ld-finder ld-rv" id="ld-finder">` +
        `<h2 class="ld-h2">আপনার সন্তানের জন্য সঠিক ব্যাচটি খুঁজে নিন</h2>` +
        `<div class="ld-step">১. সন্তান কোন শ্রেণিতে পড়ে?</div>` +
        `<div class="ld-chips">${clsChips}</div>` +
        `<div class="ld-step">২. কোন সময়টা আপনার জন্য সুবিধাজনক?</div>` +
        `<div class="ld-chips">${btChips}</div>` +
        result +
      `</section>` +
      `<section class="ld-card ld-app ld-rv" id="ld-app"><h2 class="ld-h2">সন্তান কোচিংয়ে পৌঁছাল কি না, জানুন সঙ্গে সঙ্গে</h2>` +
        `<div class="ld-lead">Diff Edu অ্যাপে অভিভাবকের ফোনে যেমন বার্তা আসে</div>` +
        `<div class="ld-phone" aria-hidden="false"><div class="ld-phone-top"><span class="ld-phone-time">৪:০২</span><span class="ld-phone-app">Diff Edu</span><b class="ld-phone-n" aria-label="নতুন বার্তা">০</b></div><div class="ld-phone-screen">` +
        `<div class="ld-msg ld-m1"><b>কোচিংয়ে পৌঁছেছে</b><span>আপনার সন্তান বিকাল ৪:০২-এ কোচিংয়ে প্রবেশ করেছে</span></div>` +
        `<div class="ld-msg ld-m2"><b>রিপোর্ট কার্ড</b><span>এ সপ্তাহের ফলাফল প্রকাশিত হয়েছে</span></div>` +
        `<div class="ld-msg ld-m3"><b>নোটিশ</b><span>এ শুক্রবার সাপ্তাহিক পরীক্ষা</span></div></div></div>` +
        ticks(['প্রবেশ ও প্রস্থানের সঙ্গে সঙ্গে বার্তা', 'পরীক্ষার ফল ও সাপ্তাহিক রিপোর্ট কার্ড', 'বেতন, নোটিশ ও পরীক্ষার রুটিন — সব এক জায়গায়', 'শিক্ষার্থীদের জন্য প্রশ্নব্যাংক, ধাঁধা ও দৈনিক রেটিং']) +
        appBtns +
        `<button class="gd-link" data-gd="close">অ্যাপ ছাড়াই ব্রাউজারে লগইন করুন</button>` +
      `</section>` +
      `<section class="ld-card ld-red ld-rv"><div class="ld-kicker">বৃত্তি স্পেশাল</div>` +
        `<div class="ld-big">৫ম ও ৮ম শ্রেণির বৃত্তি পরীক্ষার্থীদের একই বেতনে আলাদা ব্যাচ।</div></section>` +
      `<section class="ld-facts ld-rv">` +
        `<div class="ld-fact"><b data-n="6" data-u=" দিন">৬ দিন</b><span>সপ্তাহে ক্লাস</span></div>` +
        `<div class="ld-fact"><b data-n="3" data-u=" ঘণ্টা">৩ ঘণ্টা</b><span>প্রতিদিন পাঠদান</span></div>` +
        `<div class="ld-fact"><b>প্রতিদিন</b><span>গণিত ও ইংরেজি</span></div>` +
        `<div class="ld-fact"><b>শুক্রবার</b><span>সাপ্তাহিক পরীক্ষা</span></div>` +
      `</section>` +
      `<section class="ld-rv"><h2 class="ld-h2">আমাদের প্রোগ্রাম</h2>` +
        CLASSES.map(k => `<div class="ld-prog"><div class="ld-prog-h"><b>${k.name}</b><span class="ld-pill">${k.size}</span></div><p>${k.text}</p></div>`).join('') +
      `</section>` +
      `<section class="ld-card ld-green ld-rv"><h2 class="ld-h2">কেন ডিফারেন্ট?</h2>` +
        ticks(['প্রতি ব্যাচে সীমিত শিক্ষার্থী', 'দীর্ঘ সময় ধরে যত্ন নিয়ে পাঠদান', 'সিসি ক্যামেরায় প্রতিটি ক্লাস পর্যবেক্ষণ', 'হোয়াটসঅ্যাপ গ্রুপে প্রতিদিনের পড়ার খবর অভিভাবকের কাছে']) +
        `<p class="ld-hl">ফাঁকি দেওয়ার সুযোগ নেই — না শিক্ষকের, না শিক্ষার্থীর।</p>` +
      `</section>` +
      `<section class="ld-card ld-rv"><h2 class="ld-h2">আমাদের ঠিকানা</h2>` +
        `<p>আর.সি.আর.সি স্ট্রিট, কোর্টপাড়া, কুষ্টিয়া<br>মেহেরজান ডাইনের বিপরীতে</p>` +
        `<a class="gd-btn ghost" href="https://maps.google.com/?q=23.905835,89.127338" target="_blank" rel="noopener">গুগল ম্যাপে লোকেশন দেখুন</a>` +
      `</section>` +
      `<section class="ld-card ld-contact ld-rv"><h2 class="ld-h2">যোগাযোগ করুন</h2>` +
        `<div class="ld-role">পরিচালক</div>` +
        `<div class="ld-who">মোঃ রাশেদুজ্জামান সানি</div>` +
        `<a class="ld-tel" href="tel:01716057167">০১৭১৬-০৫৭১৬৭</a>` +
        `<a class="ld-tel" href="tel:01711678818">০১৭১১-৬৭৮৮১৮</a>` +
      `</section>` +
      `<div class="ld-foot"><img class="ld-footlogo" src="logo.svg" alt=""><div>© ডিফারেন্ট এডুকেশন সেন্টার, কুষ্টিয়া</div></div>`;
  }

  /** Landing app preview: each notification bumps the badge and shakes the phone. */
  function ldNotify(app) {
    const n = app.querySelector('.ld-phone-n'), ph = app.querySelector('.ld-phone');
    if (!n || !ph) return;
    [0, 600, 1200].forEach((t, i) => setTimeout(() => {
      n.textContent = bn(i + 1);
      n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump');
      ph.classList.remove('shake'); void ph.offsetWidth; ph.classList.add('shake');
    }, t + 150));
  }

  /** Landing fact tiles: count from 0 up to data-n. */
  function ldCount(box) {
    box.querySelectorAll('b[data-n]').forEach(b => {
      const to = +b.dataset.n, t0 = performance.now();
      const tick = now => {
        const k = Math.min(1, (now - t0) / 700);
        b.textContent = bn(Math.round(to * k)) + (b.dataset.u || '');
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  /** Confetti inside the result card (#ld-finder), when a class and a batch are both picked. */
  function ldConfetti(root) {
    const f = root.querySelector('#ld-finder');
    if (!f) return;
    const COLS = ['#015D36', '#C12026', '#FFBB23', '#ffffff'];
    for (let k = 0; k < 28; k++) {
      const el = document.createElement('i');
      el.className = 'ld-conf';
      el.style.left = (Math.random() * 100) + '%';
      el.style.background = COLS[k % COLS.length];
      el.style.width = (6 + Math.random() * 4) + 'px';
      el.style.height = (10 + Math.random() * 4) + 'px';
      el.style.animationDelay = (Math.random() * 0.25) + 's';
      el.style.setProperty('--x', (Math.random() * 120 - 60).toFixed(1) + 'px');
      el.style.setProperty('--r', (180 + Math.random() * 540).toFixed(0) + 'deg');
      f.appendChild(el);
      setTimeout(() => el.remove(), 1600);
    }
  }

  /** Scroll reveal for the landing page. first = true on the first paint (animate as sections come into view);
   *  on later repaints (chip taps) everything is shown at once so nothing replays.
   *  One throttled scroll handler per paint (the main element is new each time): parallax for the chalk doodles,
   *  the progress line under the top bar, and the bottom bar hiding while scrolling down. */
  function ldReveal(root, first) {
    const main = root.querySelector('.gd-main.ld');
    if (!main) return;
    const items = main.querySelectorAll('.ld-rv');
    let raf = 0, lastY = main.scrollTop;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = main.scrollTop, max = main.scrollHeight - main.clientHeight;
        const board = main.querySelector('.ld-board');
        if (board && !REDUCED && y < 900) board.style.setProperty('--py', Math.round(y * 0.18) + 'px');
        const bar = root.querySelector('.ld-progress i');
        if (bar) bar.style.width = (max > 0 ? Math.min(100, y / max * 100) : 0) + '%';
        const foot = root.querySelector('.ld-bar');
        const dy = y - lastY;
        if (foot && !REDUCED) {
          if (dy > 6 && y > 240) foot.classList.add('ld-hide');
          else if (dy < -6 || y < 120) foot.classList.remove('ld-hide');
        }
        lastY = y;
      });
    };
    main.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    if (!first || REDUCED || !('IntersectionObserver' in window)) {
      main.classList.add('ld-again');
      items.forEach(el => el.classList.add('in'));
      const pn = main.querySelector('.ld-phone-n');
      if (pn) pn.textContent = bn(3);
      return;
    }
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const el = en.target;
        el.classList.add('in');
        io.unobserve(el);
        if (el.classList.contains('ld-app')) ldNotify(el);
        if (el.classList.contains('ld-facts')) ldCount(el);
      });
    }, { root: main, threshold: 0.15 });
    items.forEach(el => io.observe(el));
  }

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
      const c = { plat, safari: isSafariIos(), addr: pageAddress(), version: '', size: 0, used: false, cls: 0, bt: 0 };
      const stack = [{ flow: 'landing', i: 0 }];
      const ov = document.createElement('div');
      ov.id = 'guide';
      ov.className = 'gd-ov';
      ov.setAttribute('role', 'dialog');
      ov.setAttribute('aria-modal', 'true');
      ov.setAttribute('aria-label', 'ডিফারেন্ট এডুকেশন সেন্টার');
      let done = false;

      const top = () => stack[stack.length - 1];
      /** The screen on top of the stack, with its flow list (a flow is a list of screens). */
      const current = () => {
        const t = top();
        if (t.flow === 'landing') return { s: LANDING, list: [LANDING] };
        if (t.flow === 'welcome') return { s: WELCOME, list: [WELCOME] };
        if (t.flow === 'desk') return { s: DESK, list: [DESK] };
        const list = flowOf(t.flow, c);
        return { s: list[t.i], list };
      };

      /** One screen: top bar with the step count, the picture, the title, the text, the buttons. */
      function view() {
        const t = top();
        const { s, list } = current();
        if (s.kind === 'landing') {
          // landing page: its own top bar (no progress bar), the page, and a sticky download button
          const lhead = `<div class="gd-top ld-top"><div class="gd-in"><div class="gd-top-row">` +
            `<div class="gd-count ld-brand"><img class="ld-toplogo" src="logo.svg" alt="">${LANDING.alt}</div>` +
            `<button class="gd-x" data-gd="close">লগইন</button></div><div class="ld-progress" aria-hidden="true"><i></i></div></div></div>`;
          const lfoot = `<footer class="gd-nav ld-bar"><div class="gd-in"><div class="ld-bar-row">` +
            `<a class="ld-b ld-b1" href="tel:${CALL_NO}">কল করুন</a>` +
            `<a class="ld-b ld-b2" href="https://wa.me/${WA}" target="_blank" rel="noopener">WhatsApp</a>` +
            `<button class="ld-b ld-b3" data-gd="tofinder">ভর্তি হোন</button></div></div></footer>`;
          return lhead + `<main class="gd-main ld"><div class="gd-in">${landingHtml(c)}</div></main>` + lfoot;
        }
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
        if (focus) ov.querySelector('.gd-h1, .ld-name')?.focus({ preventScroll: true });
        ldReveal(ov, focus);
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

      // Tapping the chalkboard: a dust burst; every 3rd tap also writes a doodle. Taps closer than 120 ms are ignored.
      const DOODLES = ['★', '১ + ১ = ২', 'A', 'ক', '✓', '৫ × ২ = ১০'];
      let taps = 0, lastTap = 0;
      ov.addEventListener('pointerdown', e => {
        const b = e.target.closest?.('.ld-board');
        if (!b || REDUCED) return;
        const now = performance.now();
        if (now - lastTap < 120) return;
        lastTap = now;
        const rect = b.getBoundingClientRect();
        // positions are inside the border (clientLeft/clientTop = border width)
        const x = e.clientX - rect.left - b.clientLeft, y = e.clientY - rect.top - b.clientTop;
        for (let k = 0; k < 10; k++) {
          const el = document.createElement('i');
          el.className = 'ld-puff';
          el.style.left = x + 'px';
          el.style.top = y + 'px';
          el.style.setProperty('--dx', (Math.random() * 76 - 38).toFixed(1) + 'px');
          el.style.setProperty('--dy', (Math.random() * 76 - 38).toFixed(1) + 'px');
          b.appendChild(el);
          setTimeout(() => el.remove(), 700);
        }
        taps++;
        if (taps % 3 === 0) {
          const d = document.createElement('span');
          d.className = 'ld-tapdoodle';
          d.textContent = DOODLES[(taps / 3 - 1) % DOODLES.length];
          d.style.left = x + 'px';
          d.style.top = y + 'px';
          d.style.setProperty('--r', (Math.random() * 24 - 12).toFixed(1) + 'deg');
          b.appendChild(d);
          setTimeout(() => d.remove(), 1600);
        }
      });
      // a short vibration on a chip tap (where the phone supports it)
      const tap = () => { if (REDUCED) return; try { navigator.vibrate?.(12); } catch { /* not supported */ } };

      ov.addEventListener('click', e => {
        const t = e.target.closest?.('[data-gd]');
        if (!t) return;
        const a = t.dataset.gd;
        if (a === 'close') close();
        else if (a === 'start') go(plat === 'ios' ? 'ios' : 'apk');
        else if (a.startsWith('flow:')) go(a.slice(5));
        else if (a.startsWith('cls:')) { c.cls = +a.slice(4); tap(); paint(false); if (c.cls && c.bt && !REDUCED) ldConfetti(ov); }
        else if (a.startsWith('bt:')) { c.bt = +a.slice(3); tap(); paint(false); if (c.cls && c.bt && !REDUCED) ldConfetti(ov); }
        else if (a === 'tofinder') ov.querySelector('#ld-finder')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        .then(v => { c.version = v?.versionName || ''; c.size = +v?.size || 0; if (ov.isConnected && top().flow !== 'landing') paint(false); })
        .catch(() => {});
    });
  }

  window.DeGuide = { wanted, show };
})();

// Diff Edu PWA — installation guide (Bangla, shown before login).
// Opens on ?install=1 (the printed QR code) and ?guide=1. Not shown when the app already runs installed.
// Loaded before app.js: everything is inside one IIFE and only the global `window.DeGuide` is exported.
// It uses app.js globals at call time only (esc, bn, store, toast, CFG, APK_URL, deferredInstall).
(function () {
  'use strict';
  const UA = navigator.userAgent || '';

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

  // Inline SVG illustrations: small, plum and gold, no text inside.
  const ILL = {
    down: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 6v22M15 20l9 9 9-9" stroke="#502A58" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 30v6a4 4 0 0 0 4 4h24a4 4 0 0 0 4-4v-6" stroke="#7E4B87" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    file: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 15l16-7 16 7v18l-16 7-16-7z" fill="#E2CE7E" stroke="#502A58" stroke-width="2.6" stroke-linejoin="round"/><path d="M8 15l16 7 16-7M24 22v18" stroke="#502A58" stroke-width="2.6" fill="none" stroke-linejoin="round"/></svg>',
    gear: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="12" fill="#502A58"/><path d="M37.5 24H42.5M33.55 33.55L37.08 37.08M24 37.5V42.5M14.45 33.55L10.92 37.08M10.5 24H5.5M14.45 14.45L10.92 10.92M24 10.5V5.5M33.55 14.45L37.08 10.92" stroke="#502A58" stroke-width="5" stroke-linecap="round"/><circle cx="24" cy="24" r="4.5" fill="#E2CE7E"/></svg>',
    shield: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5l15 5.5v11c0 10-6.5 17.5-15 21.5C15.5 39 9 31.5 9 21.5v-11z" fill="#502A58"/><path d="M24 14v11M24 31v3.2" stroke="#E2CE7E" stroke-width="3.4" stroke-linecap="round"/></svg>',
    phone: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="14" y="5" width="20" height="38" rx="4" fill="#3B1F42"/><rect x="18" y="11" width="12" height="26" rx="1.5" fill="#FBF8EC"/><rect x="20.5" y="14" width="7" height="7" rx="2" fill="#E2CE7E"/></svg>',
    key: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="11" y="21" width="26" height="19" rx="5" fill="#502A58"/><path d="M17 21v-5a7 7 0 0 1 14 0v5" stroke="#502A58" stroke-width="3.2" fill="none"/><circle cx="24" cy="30" r="2.8" fill="#E2CE7E"/></svg>',
    menu: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="8" y="8" width="32" height="32" rx="9" fill="#502A58"/><circle cx="24" cy="16" r="2.8" fill="#E2CE7E"/><circle cx="24" cy="24" r="2.8" fill="#E2CE7E"/><circle cx="24" cy="32" r="2.8" fill="#E2CE7E"/></svg>',
    add: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="8" y="8" width="32" height="32" rx="9" fill="#502A58"/><path d="M24 16v16M16 24h16" stroke="#E2CE7E" stroke-width="3.4" stroke-linecap="round"/></svg>',
    share: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5v24M16 13l8-8 8 8" stroke="#502A58" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 22h-3a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h26a3 3 0 0 0 3-3V25a3 3 0 0 0-3-3h-3" stroke="#7E4B87" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  /** Everything the page shows. Dynamic values (address, version, size) go through esc(). */
  function markup(c) {
    const bnMb = c.size ? `${bn((c.size / 1048576).toFixed(1))} MB` : `${bn(2)} MB`;
    const step = (n, icon, text, extra = '') =>
      `<li class="gd-card"><div class="gd-top"><span class="gd-num">${bn(n)}</span><span class="gd-ill">${ILL[icon]}</span></div><p class="gd-txt">${text}</p>${extra}</li>`;
    const addrCard = (title, note = '') =>
      `<div class="gd-card"><b class="gd-h">${title}</b>${note ? `<div class="gd-small">${note}</div>` : ''}<div class="gd-addr" id="gd-addr">${esc(c.addr)}</div><button class="gd-btn ghost" data-gd="copy">লিংক কপি করুন</button></div>`;
    const tabs = `<div class="gd-tabs" role="tablist" aria-label="ইনস্টলের পদ্ধতি">
      <button class="gd-tab" role="tab" aria-selected="${c.tab === 'apk'}" data-gd="tab-apk">অ্যাপ নামান<small>সুপারিশকৃত</small></button>
      <button class="gd-tab" role="tab" aria-selected="${c.tab === 'home'}" data-gd="tab-home">হোম স্ক্রিনে রাখুন<small>ডাউনলোড লাগে না</small></button></div>`;

    const apkSection = `<ol class="gd-steps">
      ${step(1, 'down', 'নিচের বোতামে চাপুন। অ্যাপটি নেমে আসবে।', `<a class="gd-btn" href="${esc(APK_URL)}" download>অ্যাপ নামান</a><div class="gd-small">প্রায় ${esc(bnMb)} — সামান্য ডেটা লাগবে</div>`)}
      ${step(2, 'file', 'নামানো শেষ হলে নোটিফিকেশন বা ডাউনলোড তালিকা থেকে ‘DiffEdu’ ফাইলটি খুলুন।')}
      ${step(3, 'gear', '‘এই উৎস থেকে ইনস্টলের অনুমতি’ চাইলে সেটি চালু করে ফিরে আসুন। এই অনুমতি শুধু এই ফাইলটির জন্য দরকার।')}
      ${step(4, 'shield', 'যদি ‘অ্যাপটি ব্লক করা হয়েছে’ বা ‘অজানা অ্যাপ’ লেখা আসে, ‘আরও বিস্তারিত’ চাপুন, তারপর ‘তবু ইনস্টল করুন’ চাপুন।', '<div class="gd-small">অ্যাপটি ডিফ এডু কোচিং অফিসেরই। ফাইলটি পরীক্ষা করা হয়েছে।</div>')}
      ${step(5, 'phone', '‘ইনস্টল’ চাপুন, তারপর ‘খুলুন’ চাপুন।')}
      ${step(6, 'key', 'আইডি আর পিন দিয়ে লগইন করুন। প্রথমবার নিজের একটা পিন বানাতে হবে।')}
      </ol>
      <div class="gd-card gd-help"><div class="gd-txt">সমস্যা হলে: <b>${bn('01711-678818')}</b></div><a class="gd-btn ghost" href="tel:01711678818">অফিসে ফোন করুন</a></div>`;

    let homeSection;
    if (deferredInstall) {
      homeSection = `<div class="gd-card"><button class="gd-btn" data-gd="install">ইনস্টল করুন</button><div class="gd-small">বোতামে চাপলে একটি ছোট প্রশ্ন আসবে। সেখানে ‘ইনস্টল’ চাপুন।</div></div>`;
    } else {
      homeSection = `<ol class="gd-steps">
        ${step(1, 'menu', 'ব্রাউজারের মেনু (⋮) চাপুন।')}
        ${step(2, 'add', '‘হোম স্ক্রিনে যোগ করুন’ বা ‘অ্যাপ ইনস্টল করুন’ বেছে নিন।')}
        ${step(3, 'phone', '‘যোগ করুন’ চাপুন।')}
        </ol>
        <div class="gd-small gd-pad">হয়ে গেলে হোম স্ক্রিনে ডিফ এডু আইকন থাকবে।</div>`;
    }

    let body;
    if (c.plat === 'ios') {
      const iosSafariNote = c.safari ? '' : addrCard('প্রথমে এই পাতাটি Safari-তে খুলুন', 'iPhone-এ হোম স্ক্রিনে রাখতে শুধু Safari লাগে।');
      body = iosSafariNote + `<ol class="gd-steps">
        ${step(1, 'share', 'নিচের শেয়ার বোতামে চাপুন। এটি বর্গ থেকে ওপরে ওঠা তীরের মতো দেখায়।')}
        ${step(2, 'add', 'নিচে টেনে ‘হোম স্ক্রিনে যোগ করুন’ বেছে নিন।')}
        ${step(3, 'phone', '‘যোগ করুন’ চাপুন।')}
        </ol>
        <div class="gd-small gd-pad">হোম স্ক্রিনে ডিফ এডু আইকন এলে সেটি খুলে লগইন করুন।</div>`;
    } else {
      body = (c.plat === 'other' ? addrCard('এই পাতাটি ফোনে খুলুন') : '')
        + tabs
        + (c.tab === 'apk'
          ? `<div class="gd-small gd-pad">অ্যান্ড্রয়েড ফোনের জন্য এটাই সবচেয়ে ভালো।</div>${apkSection}`
          : homeSection);
    }

    const foot = `<div class="gd-foot">
      <div class="gd-card gd-teal"><b class="gd-h">লগইন আইডি আর পিন অফিস থেকে নিন।</b>${c.version ? `<div class="gd-small">অ্যাপের সর্বশেষ সংস্করণ ${esc(bn(c.version))}</div>` : ''}</div>
      <button class="gd-btn ghost" data-gd="close">আগে ব্রাউজারেই দেখি</button></div>`;

    return `<div class="gd-wrap">
      <div class="gd-head"><img class="gd-logo" src="logo.svg" alt=""><div><div class="gd-brand">ডিফ এডু</div><h1 class="gd-title">অ্যাপ ইনস্টল গাইড</h1></div></div>
      <p class="gd-intro">ফোনে অ্যাপ রাখতে নিচের ধাপগুলো একে একে করুন।</p>
      ${body}${foot}</div>`;
  }

  /** Opens the full-screen guide; resolves when it is closed (then the normal login boot continues). */
  function show() {
    return new Promise(resolve => {
      const plat = platform();
      const c = { plat, safari: isSafariIos(), tab: plat === 'ios' ? 'home' : 'apk', addr: pageAddress(), version: '', size: 0 };
      const ov = document.createElement('div');
      ov.id = 'guide';
      ov.className = 'gd-ov';
      ov.setAttribute('role', 'dialog');
      ov.setAttribute('aria-modal', 'true');
      ov.setAttribute('aria-label', 'অ্যাপ ইনস্টল গাইড');
      const paint = () => { ov.innerHTML = markup(c); };
      let done = false;

      const close = () => {
        if (done) return;
        done = true;
        window.removeEventListener('beforeinstallprompt', onPrompt);
        window.removeEventListener('appinstalled', close);
        ov.remove();
        store.set('installSeen', true);                   // the small install sheet stays away on this visit
        try { history.replaceState(history.state, '', pageAddress()); } catch { /* keep the URL */ }
        resolve();
      };
      // The browser may offer the install prompt after the guide is already on screen.
      // app.js's listener runs after this one, so repaint on the next tick.
      const onPrompt = () => setTimeout(() => { if (ov.isConnected) paint(); }, 0);

      async function installNow() {
        const ev = deferredInstall;
        if (!ev) { paint(); return; }
        deferredInstall = null;
        try {
          ev.prompt();
          const choice = await ev.userChoice;
          if (choice?.outcome === 'accepted') close(); else paint();
        } catch { paint(); }
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
        if (a === 'tab-apk' || a === 'tab-home') { c.tab = a === 'tab-apk' ? 'apk' : 'home'; paint(); ov.scrollTop = 0; }
        else if (a === 'close') close();
        else if (a === 'install') installNow();
        else if (a === 'copy') copyAddress();
      });

      window.addEventListener('beforeinstallprompt', onPrompt);
      window.addEventListener('appinstalled', close);
      document.body.appendChild(ov);
      paint();

      // Published app version (and APK size); fails silently, the page works without it.
      fetch(CFG.url + '/storage/v1/object/public/app-updates/version.json', { cache: 'no-store' })
        .then(r => r.json())
        .then(v => { c.version = v?.versionName || ''; c.size = +v?.size || 0; if (ov.isConnected) paint(); })
        .catch(() => {});
    });
  }

  window.DeGuide = { wanted, show };
})();

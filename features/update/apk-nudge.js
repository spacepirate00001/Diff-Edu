// Android phones are asked (never forced) to use the Android app: a bottom sheet, at most once every 3 days.
// Not shown on iPhone (cannot install an APK) or inside the Android app's own web view. It does show inside an installed PWA.
import { h } from '../../ui/dom.js';
import { openSheet } from '../../ui/sheet.js';
import { store } from '../../core/store.js';
import { bn } from '../../core/bn.js';
import { CFG } from '../../core/config.js';

const BASE = CFG.url + '/storage/v1/object/public/app-updates/';
export const APK_URL = BASE + 'DiffEdu.apk';
const KEY = 'de.next.apkAsked';
const DAYS = 3;

/** Android phone with a normal browser or an installed PWA (not the Android app's own web view). The "আরও" menu row uses this. */
export const canGetApk = (ua = navigator.userAgent) => /Android/i.test(ua) && !/; wv\)|DiffEduApp/i.test(ua);

export function apkWanted(ua = navigator.userAgent, last = +store.get(KEY) || 0, now = Date.now()) {
  if (!canGetApk(ua)) return false;
  return now - last >= DAYS * 864e5;
}
export async function maybeAskForApk() {
  if (!apkWanted()) return;
  if (document.querySelector('.de-sheet')) return;
  store.set(KEY, String(Date.now()));
  return openApkSheet();
}

/** The download sheet itself: shown by the 3-day prompt and by the always-there "আরও" row. */
export async function openApkSheet() {
  let size = '';
  try { const v = await (await fetch(BASE + 'version.json', { cache: 'no-store' })).json(); if (v.size) size = ` (${bn((v.size / 1048576).toFixed(1))} MB)`; } catch { /* size is optional */ }
  const s = openSheet({
    title: 'অ্যান্ড্রয়েড অ্যাপ ব্যবহার করুন',
    content: h('div', {},
      h('p', { text: 'একই আইডি ও পিন দিয়ে ঢুকবেন। অ্যাপে নোটিফিকেশন সাথে সাথে আসে, নেট ছাড়াও হাজিরা নেওয়া যায়।' }),
      h('a', { class: 'de-btn de-btn--primary', href: APK_URL, download: '', text: 'অ্যাপ ডাউনলোড' + size }),
      h('p', { text: 'ডাউনলোডের পর ফাইলটি খুলুন। "অজানা উৎস" জিজ্ঞেস করলে অনুমতি দিন।' }),
      h('button', { class: 'de-btn de-btn--text', type: 'button', onclick: () => s.close(), text: 'এখন না, ওয়েবেই চালাই' })),
  });
}

// Text size and colour choice, kept on this phone only (spec P2). The page changes the moment a choice is made.
import { KEYS } from './config.js';
import { store } from './store.js';

export const DEFAULTS = { text: 'normal', theme: 'auto', sizeAsked: false };
export function parse(raw) {
  const o = raw && typeof raw === 'object' ? raw : {};
  return {
    text: o.text === 'large' ? 'large' : 'normal',
    theme: o.theme === 'light' || o.theme === 'dark' ? o.theme : 'auto',
    sizeAsked: o.sizeAsked === true,
  };
}
let cur = parse(store.json(KEYS.prefs));
const subs = new Set();
export const prefs = {
  get: () => cur,
  set(patch) { cur = parse({ ...cur, ...patch }); store.setJson(KEYS.prefs, cur); prefs.apply(); subs.forEach(f => f(cur)); },
  // fake mode: change the choice for this page only, without saving it
  transient(patch) { cur = parse({ ...cur, ...patch }); prefs.apply(); subs.forEach(f => f(cur)); },
  on(f) { subs.add(f); return () => subs.delete(f); },
  // Sets <html data-text> and the colour override. "auto" leaves the colours to the phone and the sky (weather.js).
  apply(doc = globalThis.document) {
    if (!doc?.documentElement) return;
    const r = doc.documentElement;
    if (cur.text === 'large') r.setAttribute('data-text', 'large'); else r.removeAttribute('data-text');
  },
  // For weather.js: the phone's own choice unless the user picked one.
  themePref() {
    if (cur.theme !== 'auto') return cur.theme;
    return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  },
  reset() { cur = parse(null); },
};

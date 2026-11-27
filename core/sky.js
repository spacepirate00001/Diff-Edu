// Sky, sun and page colours for every screen (spec P17). Uses ui/weather.js (window.Weather) and exposes window.DeSky
// to the "আজ" screen. Real weather = one row of table weather_now, used only while under 3 hours old; otherwise a plain
// time-of-day sky (clear, sunrise 6:30, sunset 17:30) and the weather line stays hidden: no made-up temperature.
import { prefs } from './prefs.js';
import { dhakaParts, greetingFor } from './bn.js';
import { sel, rows } from './api.js';
import { cache } from './cache.js';
import { session } from './session.js';

const FALLBACK = { weather_code: 0, temperature_c: 27, cloud_cover_pct: 5, precipitation_mm: 0, sunrise: '06:30', sunset: '17:30' };
const MAX_AGE = 3 * 3600e3;
let row = null;                 // a fresh real row, or null
let fake = {};                  // test overrides (hour, weather, ...), only filled in fake mode
let live = null;                // ?live=1 (fake mode only): a real forecast fetched for testing
const subs = new Set();
const notify = () => subs.forEach(f => f());

const forcedLight = () => prefs.get().theme === 'light';
export const sky = {
  setFake(p) { fake = p || {}; },
  qs: name => (name in fake ? fake[name] : null),
  hasReal: () => !!(row || live || (fake.weather && window.Weather?.presets[fake.weather])),
  minutes() {
    const h = fake.hour;
    if (h != null && h !== '' && Number(h) >= 0 && Number(h) < 24) return Math.floor(Number(h)) * 60 + Math.min(59, Math.max(0, Math.floor(Number(fake.minute) || 0)));
    return dhakaParts().minutes;
  },
  pref() { return prefs.themePref(); },
  // The weather input for Weather.theme(). "Always light" shows the day sky at any hour (greeting still follows the clock).
  input() {
    const preset = window.Weather.presets[fake.weather];
    const base = Object.assign({}, FALLBACK, preset ? {} : (live || row || {}), preset || {});
    if (preset && (live || row)) { base.sunrise = (live || row).sunrise; base.sunset = (live || row).sunset; }
    if (/^\d{1,2}:\d{2}$/.test(fake.sunrise || '')) base.sunrise = fake.sunrise;
    if (/^\d{1,2}:\d{2}$/.test(fake.sunset || '')) base.sunset = fake.sunset;
    base.now = forcedLight() ? 12 * 60 : sky.minutes();
    return base;
  },
  greet: (dflt) => (forcedLight() ? greetingFor(sky.minutes()) : dflt),
  subscribe(f) { subs.add(f); return () => subs.delete(f); },
  // Puts the sky's colours on <html> (the page cream, the tab bar, accents) and picks light or dark.
  apply() {
    const W = window.Weather; if (!W) return null;
    const t = W.theme(sky.input(), sky.pref());
    const r = document.documentElement;
    for (const [k, v] of Object.entries(t.vars)) r.style.setProperty(k, v);
    r.setAttribute('data-theme', t.dark ? 'dark' : 'light');
    r.setAttribute('data-wx', t.cls + (t.day ? 'd' : 'n'));
    return t;
  },
  // Reads weather_now once (cached copy for up to 3 hours). Never blocks and never shows an error.
  async load() {
    const uid = session.uid();
    const old = uid && cache.get(uid, 'weather');
    if (old?.v) row = window.Weather.fromRow(old.v, Date.now());
    const res = await sel('weather_now', 'select=*&limit=1');
    const fresh = rows(res)[0];
    if (fresh) { if (uid) cache.set(uid, 'weather', fresh); row = window.Weather.fromRow(fresh, Date.now()); }
    else if (res.kind === 'ok' || res.kind === 'missing') row = null;   // table empty or not there yet: plain sky
    if (fake.live === '1') live = await window.Weather.live();
    sky.apply(); notify();
  },
  forget() { row = null; live = null; },
  startClock() { setInterval(() => { sky.apply(); notify(); }, 60000); window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => { sky.apply(); notify(); }); prefs.on(() => { sky.apply(); notify(); }); },
};
globalThis.DeSky = sky;

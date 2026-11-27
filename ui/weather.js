// Weather + sun/moon theme for the আজ screen (v6). Pure functions, no DOM: runs in the browser (window.Weather) and in node (v6-audit.mjs).
// theme(w, pref) -> { cls, phase, dark, vars, sun, moon, ... }.  w = {weather_code, temperature_c, cloud_cover_pct, precipitation_mm, sunrise, sunset, now}
// (sunrise/sunset: "HH:MM" or ISO "2026-11-22T06:27" or minutes; now: minutes since midnight, Asia/Dhaka). pref = "light" | "dark" (the phone's choice).
// Contrast is guaranteed by construction (fit) and checked again by v6-audit.mjs over every class x minute x preference.
(function (root) {
  "use strict";
  var TW = 45, H = 0.5;                 // dusk/dawn length in minutes; the ink flips at half of it (the one place the sky cannot stay smooth, see SPEC 4kh)
  var SKY_MIN = 0.235, SKY_MAX = 0.145; // luminance a sky stop must keep for dark ink (>=) or light ink (<=); 4.5:1 with the inks below
  var INK = { dark: { ink: "#1A0B21", ink2: "#2B1236" }, light: { ink: "#FFFFFF", ink2: "#F3EEF5" } };

  function rgb(h) { h = h.replace("#", ""); return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }); }
  function hex(a) { return "#" + a.map(function (x) { x = Math.max(0, Math.min(255, Math.round(x))); return (x < 16 ? "0" : "") + x.toString(16); }).join(""); }
  function mix(a, b, t) { var p = rgb(a), q = rgb(b); return hex([0, 1, 2].map(function (i) { return p[i] + (q[i] - p[i]) * t; })); }
  function lum(h) { var c = rgb(h).map(function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  function fit(h, lo, hi) { var n = 0; while (lum(h) < lo && n++ < 80) h = mix(h, "#ffffff", 0.04); n = 0; while (lum(h) > hi && n++ < 80) h = mix(h, "#000000", 0.04); return h; }
  function lerp3(a, b, t) { return a.map(function (c, i) { return mix(c, b[i], t); }); }
  function clamp(x, a, b) { return Math.max(a === undefined ? 0 : a, Math.min(b === undefined ? 1 : b, x)); }
  function mins(v, dflt) {
    if (typeof v === "number") return v;
    var m = /(\d{1,2}):(\d{2})/.exec(String(v || ""));
    return m ? Number(m[1]) * 60 + Number(m[2]) : dflt;
  }

  var CLASSES = ["clear", "partly", "overcast", "fog", "drizzle", "rain", "storm", "hot", "cool"];
  // midday sky, top / middle / horizon
  var DAY = {
    clear: ["#86C8EF", "#A6D6F2", "#C4E4F7"], partly: ["#A3CCE8", "#BDD9EC", "#D3E5F1"], overcast: ["#B1B8C4", "#C4CAD3", "#D4D9E0"],
    fog: ["#D1D4D8", "#DDDFE2", "#E8E9EB"], drizzle: ["#A6B6C7", "#B9C7D5", "#CBD6E0"], rain: ["#8B9DB2", "#A1B1C3", "#B5C3D1"],
    storm: ["#1E1B45", "#2D2A63", "#3C3A7E"], hot: ["#FFCB62", "#FFDB8C", "#FFEBB8"], cool: ["#B6D4EB", "#CDE2F2", "#DFECF7"]
  };
  var WARM = ["#FFB48C", "#FFCDA3", "#FFE3BE"];
  var K_WARM = { clear: 0.8, partly: 0.55, overcast: 0.25, fog: 0.1, drizzle: 0.15, rain: 0.08, storm: 0, hot: 0.9, cool: 0.4 };
  var K_DUSK = { clear: 0, partly: 0.1, overcast: 0.3, fog: 0.4, drizzle: 0.3, rain: 0.4, storm: 0, hot: 0, cool: 0.15 };
  var DUSK_A = ["#A66FB5", "#CB7FA0", "#EE9C78"], DUSK_B = ["#1E2058", "#3B3480", "#7A4C92"], NIGHT = ["#0B0F2E", "#161A47", "#242662"];
  var NIGHT_TINT = { overcast: "#1E2430", fog: "#222629", drizzle: "#18222E", rain: "#142030", storm: "#0A0A26", hot: "#2A1A12", cool: "#102236" };
  var PAGE_L = { clear: "#FFF8EC", partly: "#F8F5EF", overcast: "#EEEDF0", fog: "#EAEBEC", drizzle: "#E6EDF2", rain: "#DDE6EE", storm: "#D8DBEC", hot: "#FFF0CF", cool: "#E6EFF7" };
  var PAGE_D = { clear: "#151116", partly: "#14131A", overcast: "#141418", fog: "#161617", drizzle: "#11171C", rain: "#0F161E", storm: "#0E0F1E", hot: "#1B150F", cool: "#101620" };
  var ACC = { clear: "#D4B95A", partly: "#8FB8D8", overcast: "#9A9FB0", fog: "#B8BEC4", drizzle: "#7FA6C2", rain: "#5E8DB5", storm: "#6B63C9", hot: "#E8A83A", cool: "#7FB0D6" };
  var FUN = { light: { mint: "#7FE0B5", coral: "#FF9486", sky: "#8FD3FF", sunny: "#FFD84D" }, dark: { mint: "#66D9A8", coral: "#FF8A7A", sky: "#7CC8F5", sunny: "#F5CF45" } };
  // look of each class: cloud amount 0-4, rain 0-3, fog, flash
  var SUNF = { clear: 1, partly: 0.9, overcast: 0.4, fog: 0.35, drizzle: 0.4, rain: 0.25, storm: 0, hot: 1, cool: 0.9 };   // how much of the sun shows through
  var LOOK = { clear: { cl: 0 }, partly: { cl: 2 }, overcast: { cl: 4 }, fog: { cl: 1, fog: 1 }, drizzle: { cl: 3, rain: 1 }, rain: { cl: 4, rain: 2 }, storm: { cl: 4, rain: 3, flash: 1 }, hot: { cl: 0 }, cool: { cl: 2 } };

  function classify(w) {
    var c = w.weather_code, t = w.temperature_c, cc = w.cloud_cover_pct, p = w.precipitation_mm || 0;
    if (c >= 95) return "storm";
    if ([63, 65, 66, 67, 81, 82].indexOf(c) >= 0 || p >= 2.5) return "rain";
    if ((c >= 51 && c <= 57) || c === 61 || c === 80 || p >= 0.1) return "drizzle";
    if (c === 45 || c === 48) return "fog";
    if (t >= 36) return "hot";
    if (t <= 15) return "cool";
    if (c === 3 || cc >= 85) return "overcast";
    if (c === 2 || cc >= 40) return "partly";
    return "clear";
  }

  function when(w) {   // where "now" is relative to the sun
    var sr = mins(w.sunrise, 390), ss = mins(w.sunset, 1050), now = ((w.now % 1440) + 1440) % 1440;
    if (now >= sr && now <= ss) {
      var f = (now - sr) / (ss - sr);
      return { day: true, f: f, tw: 0, phase: f < 0.3 ? "morning" : f < 0.62 ? "noon" : "afternoon", sr: sr, ss: ss, now: now, since: 0, toRise: 0 };
    }
    var since = now > ss ? now - ss : now + 1440 - ss, toRise = now < sr ? sr - now : sr + 1440 - now;
    if (since < TW) return { day: false, f: 1, tw: since / TW, phase: since / TW < H ? "dusk" : "twilight", sr: sr, ss: ss, now: now, since: since, toRise: toRise };
    if (toRise < TW) return { day: false, f: 0, tw: toRise / TW, phase: "dawn", sr: sr, ss: ss, now: now, since: since, toRise: toRise };
    return { day: false, f: 1, tw: 1, phase: "night", sr: sr, ss: ss, now: now, since: since, toRise: toRise };
  }

  function skyStops(cls, t, prefDark) {
    var day = DAY[cls], gold = lerp3(day, WARM, K_WARM[cls]), s, light;
    var nt = NIGHT_TINT[cls] ? lerp3(NIGHT, [NIGHT_TINT[cls], NIGHT_TINT[cls], NIGHT_TINT[cls]], 0.3) : NIGHT;
    if (t.day) {
      var warm = clamp(Math.max(1 - t.f / 0.16, (t.f - 0.78) / 0.22));
      var pale = lerp3(day, ["#C7B2DC", "#E9C3D6", "#F8D3C4"], 0.7);   // blue -> peach straight would pass through grey, so go via lavender-pink
      s = warm < 0.5 ? lerp3(day, pale, warm * 2) : lerp3(pale, gold, (warm - 0.5) * 2);
      light = cls === "storm";
    } else if (cls === "storm") {
      s = lerp3(day, nt, t.tw); light = true;
    } else if (t.tw < H) {
      s = lerp3(gold, lerp3(DUSK_A, day, K_DUSK[cls]), t.tw / H); light = false;
    } else {
      s = lerp3(DUSK_B, nt, (t.tw - H) / (1 - H)); light = true;
    }
    if (prefDark) { s = lerp3(s, ["#140E24", "#140E24", "#140E24"], 0.72); light = true; }
    s = s.map(function (c) { return light ? fit(c, 0, cls === "storm" ? 0.06 : SKY_MAX) : fit(c, SKY_MIN, 1); });   // storm: extra headroom for the lightning flash
    return { stops: s, light: light };
  }

  function theme(w, pref) {
    var prefDark = pref === "dark", cls = w.cls || classify(w), t = when(w), sk = skyStops(cls, t, prefDark);
    var night = !t.day && t.tw >= H, dark = prefDark || night, ink = INK[sk.light ? "light" : "dark"];
    // page: smooth inside each side of the dusk (cream -> dusk rose; deep violet -> night), then the card theme flips
    var page, tw = t.tw;
    if (dark) page = prefDark || t.day ? PAGE_D[cls] : tw >= 1 ? PAGE_D[cls] : mix("#17142C", PAGE_D[cls], (tw - H) / (1 - H));
    else page = t.day ? PAGE_L[cls] : mix(PAGE_L[cls], "#EAD6E6", 0.85 * tw / H);
    page = dark ? fit(page, 0, 0.055) : fit(page, 0.66, 1);
    var fb = FUN[dark ? "dark" : "light"], v = {
      "--v6-a": sk.stops[0], "--v6-b": sk.stops[1], "--v6-c": sk.stops[2], "--v6-ink": ink.ink, "--v6-ink2": ink.ink2,
      "--v6-page": page, "--v6-tab": page, "--v6-edge": dark ? mix("#3A2E44", ACC[cls], 0.22) : mix("#DDCBE3", ACC[cls], 0.35), "--v6-acc": ACC[cls],
      "--v6-cloud": cls === "storm" ? "rgba(10,10,40,0.5)" : sk.light ? "rgba(255,255,255,0.14)" : cls === "rain" || cls === "drizzle" ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.8)",
      "--v6-star": "#F6EFD3"
    };
    Object.keys(fb).forEach(function (k) { v["--de-fun-" + k] = fit(mix(fb[k], ACC[cls], 0.22), 0.26, 1); });
    // sun / moon: fraction along the arc; east (left) at rise, top middle at noon, west (right) at set
    var sunOp = t.now < t.sr ? clamp((t.now - (t.sr - 10)) / 10) : t.now > t.ss ? clamp(1 - (t.now - t.ss) / 12) : 1;
    var moonOp = t.day ? 0 : t.since < TW ? clamp(t.since / 20) : t.toRise < TW ? clamp(t.toRise / 20) : 1;
    var nightLen = t.sr + 1440 - t.ss, fm = clamp(t.since / nightLen), fs = clamp(t.f);
    return {
      cls: cls, phase: t.phase, dark: dark, light: sk.light, tw: t.tw, day: t.day, vars: v, look: LOOK[cls],
      stars: t.day ? 0 : clamp((t.tw - 0.25) / 0.5),
      sun: { x: 10 + 80 * fs, y: 44 * Math.sin(Math.PI * fs), op: sunOp * (prefDark ? 0.85 : 1) * SUNF[cls], f: fs },
      moon: { x: 10 + 80 * fm, y: 40 * Math.sin(Math.PI * fm), op: moonOp, f: fm }
    };
  }

  var PRESETS = {
    clear: { weather_code: 0, temperature_c: 27, cloud_cover_pct: 5, precipitation_mm: 0 }, partly: { weather_code: 2, temperature_c: 28, cloud_cover_pct: 45, precipitation_mm: 0 },
    overcast: { weather_code: 3, temperature_c: 25, cloud_cover_pct: 95, precipitation_mm: 0 }, fog: { weather_code: 45, temperature_c: 16, cloud_cover_pct: 100, precipitation_mm: 0 },
    drizzle: { weather_code: 53, temperature_c: 24, cloud_cover_pct: 90, precipitation_mm: 0.4 }, rain: { weather_code: 63, temperature_c: 23, cloud_cover_pct: 100, precipitation_mm: 6 },
    storm: { weather_code: 95, temperature_c: 24, cloud_cover_pct: 100, precipitation_mm: 12 }, hot: { weather_code: 0, temperature_c: 38, cloud_cover_pct: 10, precipitation_mm: 0 },
    cool: { weather_code: 1, temperature_c: 12, cloud_cover_pct: 20, precipitation_mm: 0 }
  };
  var LIVE = "https://api.open-meteo.com/v1/forecast?latitude=23.9013&longitude=89.1220&current=temperature_2m,weather_code,cloud_cover,precipitation&daily=sunrise,sunset&timezone=Asia%2FDhaka";
  // testing only (?live=1). The product never calls a third party from a phone: a server job stores one row, see SPEC 4kh.
  function live() {
    return fetch(LIVE).then(function (r) { if (!r.ok) throw new Error("http"); return r.json(); }).then(function (j) {
      return { weather_code: j.current.weather_code, temperature_c: j.current.temperature_2m, cloud_cover_pct: j.current.cloud_cover, precipitation_mm: j.current.precipitation, sunrise: j.daily.sunrise[0], sunset: j.daily.sunset[0] };
    }).catch(function () { return null; });
  }
  // the stored server row is used only while fresh (under 3 hours); otherwise a plain time-of-day theme (clear sky, default sun times)
  function fromRow(row, nowMs) {
    if (!row || !row.fetched_at || nowMs - new Date(row.fetched_at).getTime() > 3 * 3600 * 1000) return null;
    return row;
  }

  root.Weather = { classify: classify, when: when, theme: theme, live: live, fromRow: fromRow, presets: PRESETS, classes: CLASSES, lum: lum, mix: mix, TW: TW, H: H, INK: INK };
  if (typeof module !== "undefined" && module.exports) module.exports = root.Weather;
})(typeof window !== "undefined" ? window : globalThis);

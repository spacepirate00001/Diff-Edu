'use strict';
// Student search (N7): one query finds a student by Bangla name, English spelling, login id or roll.
// Line-by-line port of the APK's ui/Search.kt (object NameSearch). Keep the two in sync when changing anything.
(function () {
  const NUKTA = '়', HASANTA = '্';
  const independentVowels = { 'অ': 'a', 'আ': 'a', 'ই': 'i', 'ঈ': 'i', 'উ': 'u', 'ঊ': 'u', 'ঋ': 'ri', 'এ': 'e', 'ঐ': 'oi', 'ও': 'o', 'ঔ': 'ou' };
  const vowelSigns = { 'া': 'a', 'ি': 'i', 'ী': 'i', 'ু': 'u', 'ূ': 'u', 'ৃ': 'ri', 'ে': 'e', 'ৈ': 'oi', 'ো': 'o', 'ৌ': 'ou' };
  const consonants = {
    'ক': 'k', 'খ': 'kh', 'গ': 'g', 'ঘ': 'gh', 'ঙ': 'ng', 'চ': 'ch', 'ছ': 'chh', 'জ': 'j', 'ঝ': 'jh', 'ঞ': 'n',
    'ট': 't', 'ঠ': 'th', 'ড': 'd', 'ঢ': 'dh', 'ণ': 'n', 'ত': 't', 'থ': 'th', 'দ': 'd', 'ধ': 'dh', 'ন': 'n',
    'প': 'p', 'ফ': 'ph', 'ব': 'b', 'ভ': 'bh', 'ম': 'm', 'য': 'j', 'র': 'r', 'ল': 'l', 'শ': 'sh', 'ষ': 'sh', 'স': 's', 'হ': 'h',
  };
  const nuktaConsonants = { 'য': 'y', 'ড': 'r', 'ঢ': 'rh' }; // য় ড় ঢ়
  const otherSigns = { 'ং': 'ng', 'ঃ': '', 'ঁ': '', 'ৎ': 't' };
  const has = (o, c) => Object.prototype.hasOwnProperty.call(o, c);
  const JOINERS = /[‌‍]/g;

  // Precomposed য় ড় ঢ় -> letter + nukta.
  const decompose = s => s.replace(/য়/g, 'য' + NUKTA).replace(/ড়/g, 'ড' + NUKTA).replace(/ঢ়/g, 'ঢ' + NUKTA);
  const bnToAsciiDigits = s => s.replace(/[০-৯]/g, d => String(d.charCodeAt(0) - 0x09E6));
  // For substring matching: lowercase, ASCII digits, no nukta / joiners, single spaces.
  const normalize = s => bnToAsciiDigits(decompose(String(s ?? '').toLowerCase())).replace(/[়‌‍]/g, '').trim().replace(/\s+/g, ' ');

  // Bangla -> rough Roman spelling. Non-Bangla characters are kept (lowercased).
  function romanize(input) {
    const s = Array.from(decompose(String(input ?? '').toLowerCase()).replace(JOINERS, ''));
    let out = '', i = 0;
    while (i < s.length) {
      const c = s[i];
      if (has(consonants, c)) {
        let j = i + 1, roman = consonants[c];
        if (s[j] === NUKTA) { roman = nuktaConsonants[c] ?? roman; j++; }
        // Two conjuncts that are not read letter by letter: ক্ষ (kh), জ্ঞ (g).
        if (c === 'ক' && s[j] === HASANTA && s[j + 1] === 'ষ') { roman = 'kh'; j += 2; }
        else if (c === 'জ' && s[j] === HASANTA && s[j + 1] === 'ঞ') { roman = 'g'; j += 2; }
        out += roman;
        const next = s[j];
        if (next === HASANTA) {
          j++;
          // য-ফলা and ব-ফলা only double the sound: write nothing for them.
          const after = s[j];
          if ((after === 'য' || after === 'ব') && s[j + 1] !== NUKTA) j++;
        } else if (next !== undefined && has(consonants, next)) out += 'o'; // inherent vowel
        i = j;
        continue;
      }
      if (c === NUKTA || c === HASANTA) { /* nothing */ }
      else if (has(independentVowels, c)) out += independentVowels[c];
      else if (has(vowelSigns, c)) out += vowelSigns[c];
      else if (has(otherSigns, c)) out += otherSigns[c];
      else out += c;
      i++;
    }
    return out;
  }
  const isVowel = c => 'aeiouwy'.includes(c);

  // First letter + consonants of one word (Bangla or Roman). '' when the word has no letters.
  function skeleton(word) {
    const r = romanize(word).replace(/[^a-z]/g, '');
    let t = '', i = 0;
    while (i < r.length) {
      const c = r[i];
      if (r[i + 1] === 'h' && 'kgcjtdpbsr'.includes(c)) {
        t += c === 'p' ? 'f' : c;
        i += 2;
        if (c === 'c' && r[i] === 'h') i++; // "chh"
        continue;
      }
      if (isVowel(c)) t += 'a';
      else if (c === 'v') t += 'b';
      else if (c === 'z') t += 'j';
      else if (c === 'q') t += 'k';
      else if (c === 'x') t += 'ks';
      else t += c;
      i++;
    }
    // Collapse doubled letters (mm -> m, aa -> a).
    let col = '';
    for (const c of t) if (!col || col[col.length - 1] !== c) col += c;
    if (!col) return '';
    let res = col[0];
    for (let k = 1; k < col.length; k++) if (col[k] !== 'a') res += col[k];
    return res;
  }

  // Precomputed search data for one student. Build once per list, not per keystroke.
  function prep(name, loginId, roll) {
    const n = normalize(name);
    const rd = normalize(roll).replace(/\D/g, '');
    return {
      name: n,
      words: n.split(' ').filter(Boolean),
      wordSkeletons: String(name ?? '').trim().split(/\s+/).map(skeleton).filter(Boolean),
      login: normalize(loginId),
      roll: rd && rd.length <= 6 ? parseInt(rd, 10) : null,
    };
  }

  // 0 = starts with the query, 1 = contains it, -1 = no match.
  function score(key, query) {
    const q = normalize(query);
    if (!q) return 0;
    let best = null;
    const hit = r => { if (best === null || r < best) best = r; };

    // Name as typed (Bangla or English), substring.
    if (key.name.startsWith(q) || key.words.some(w => w.startsWith(q))) hit(0);
    else if (key.name.includes(q)) hit(1);

    if (/^\d+$/.test(q)) {
      // Roll: "05" and "5" are the same roll. Login only on an exact match.
      if (key.roll !== null && q.length <= 6 && parseInt(q, 10) === key.roll) hit(0);
      if (key.login === q) hit(0);
    } else if (key.login) {
      if (key.login.startsWith(q)) hit(0); else if (key.login.includes(q)) hit(1);
    }

    // Sound-alike: every letters-only query word must start some name word (skeletons).
    const tokens = q.split(' ').filter(Boolean);
    if (tokens.length && tokens.every(t => !/\d/.test(t)) && key.wordSkeletons.length) {
      const sk = tokens.map(skeleton);
      if (sk.every(s => s) && sk.every(s => key.wordSkeletons.some(w => w.startsWith(s)))) {
        hit(key.wordSkeletons[0].startsWith(sk[0]) ? 0 : 1);
      } else if (sk.length === 1 && sk[0].length >= 3 && key.wordSkeletons.some(w => w.includes(sk[0]))) {
        hit(1);
      }
    }
    return best === null ? -1 : best;
  }

  // Items matching the query, "starts with" before "contains"; input order kept inside each group.
  // get(item) -> { name, login, roll }
  const cache = new WeakMap();
  function filter(items, query, get) {
    if (!normalize(query)) return items.slice();
    const out = [];
    items.forEach((it, i) => {
      let k = cache.get(it);
      if (!k) { const f = get(it); k = prep(f.name, f.login, f.roll); cache.set(it, k); }
      const s = score(k, query);
      if (s >= 0) out.push([s, i, it]);
    });
    return out.sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]);
  }
  window.Search = { normalize, romanize, skeleton, prep, score, filter };
})();

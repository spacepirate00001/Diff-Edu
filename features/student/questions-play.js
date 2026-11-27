// Makers for the four newer games. Pure (no DOM), tested in node.
//  - shopOrder: হাটের দোকান, a customer buys things and pays; the student gives the change in notes and coins.
//  - mergePuzzle: সংখ্যা জোড়া, join numbers with + − × ÷ to reach a target. Built backwards from real moves, so it can always be solved.
import { SCRAMBLE } from './questions.js';

const pick = (list, rnd) => list[Math.floor(rnd() * list.length)];
const int = (rnd, a, b) => a + Math.floor(rnd() * (b - a + 1));
const clsOf = c => Math.min(10, Math.max(1, Number(c) || 5));

// [emoji, name, unit, lowest price, highest price, step]
const GOODS = [['🥔', 'আলু', 'কেজি', 25, 45, 5], ['🍅', 'টমেটো', 'কেজি', 40, 80, 10], ['🧅', 'পেঁয়াজ', 'কেজি', 50, 90, 10], ['🥚', 'ডিম', 'হালি', 40, 60, 10], ['🍌', 'কলা', 'হালি', 30, 50, 5],
  ['🍋', 'লেবু', 'পিস', 5, 10, 5], ['🍪', 'বিস্কুট', 'প্যাকেট', 10, 30, 5], ['📒', 'খাতা', 'পিস', 20, 60, 10], ['✏️', 'পেনসিল', 'পিস', 5, 10, 5], ['🥛', 'দুধ', 'লিটার', 80, 100, 10],
  ['🍚', 'চাল', 'কেজি', 60, 80, 10], ['🐟', 'রুই মাছ', 'কেজি', 200, 300, 50]];
export const NOTES = [50, 100, 200, 500, 1000, 2000];
export const denomsFor = cls => (clsOf(cls) <= 3 ? [20, 10, 5, 2, 1] : clsOf(cls) <= 6 ? [50, 20, 10, 5, 2, 1] : [500, 200, 100, 50, 20, 10, 5, 2, 1]);
export function shopOrder(rnd, cls = 5) {
  const c = clsOf(cls), cap = c <= 3 ? 50 : c <= 6 ? 300 : 1200, count = c <= 3 ? 1 : c <= 6 ? 2 : 3;
  for (let tries = 0; tries < 50; tries++) {
    const pool = GOODS.filter(g => (c >= 7 ? true : g[4] <= 100)), used = new Set(), lines = [];
    for (let i = 0; i < count; i++) {
      let g; do { g = pick(pool, rnd); } while (used.has(g[1])); used.add(g[1]);
      const steps = Math.floor((g[4] - g[3]) / g[5]), price = c <= 3 ? int(rnd, 1, 5) * 5 : g[3] + g[5] * int(rnd, 0, steps), qty = c <= 3 || g[2] === 'প্যাকেট' ? 1 : int(rnd, 1, 3);
      lines.push({ emoji: g[0], name: g[1], unit: g[2], qty, price, sum: qty * price });
    }
    const total = lines.reduce((n, l) => n + l.sum, 0);
    if (total > cap || total < 5) continue;
    const notes = NOTES.filter(n => n > total && (c > 3 || n <= 100)), paid = notes[Math.min(notes.length - 1, rnd() < 0.35 ? 1 : 0)];
    if (!paid || paid - total > (c <= 3 ? 60 : c <= 6 ? 250 : 800)) continue;
    return { lines, total, paid, change: paid - total, denoms: denomsFor(c) };
  }
  return { lines: [{ emoji: '🍌', name: 'কলা', unit: 'হালি', qty: 1, price: 30, sum: 30 }], total: 30, paid: 50, change: 20, denoms: denomsFor(c) };
}

// ---- সংখ্যা জোড়া ----
export const OPS = ['+', '−', '×', '÷'];
export const applyOp = (a, op, b) => (op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : b !== 0 && a % b === 0 ? a / b : null);
export function mergePuzzle(rnd, cls = 5) {
  const c = clsOf(cls), count = c <= 4 ? 3 : 4, ops = c <= 4 ? ['+', '−'] : c <= 6 ? ['+', '−', '×'] : OPS, hi = c <= 4 ? 12 : 9;
  for (let tries = 0; tries < 200; tries++) {
    const nums = Array.from({ length: count }, () => int(rnd, 1, hi)); let items = nums.slice(), ok = true;
    while (items.length > 1 && ok) {
      let done = false;
      for (let k = 0; k < 30 && !done; k++) {
        const i = int(rnd, 0, items.length - 1); let j = int(rnd, 0, items.length - 1); if (i === j) continue;
        let a = items[i], b = items[j]; const op = pick(ops, rnd); if (a < b) [a, b] = [b, a];
        const r = applyOp(a, op, b); if (r == null || r < 1 || r > 300 || (op === '×' && (a === 1 || b === 1)) || (op === '÷' && b === 1)) continue;
        items = items.filter((_, x) => x !== i && x !== j); items.push(r); done = true;
      }
      ok = done;
    }
    if (ok && items[0] >= 3 && !nums.includes(items[0])) return { nums, target: items[0] };
  }
  return { nums: [2, 3, 4], target: 10 };
}

// ---- শব্দ গোয়েন্দা ----
export function detectiveWord(rnd, cls = 5, taken = new Set()) {
  const pool = SCRAMBLE.filter(([, en]) => /^[a-z]+$/.test(en) && en.length >= 3 && en.length <= (clsOf(cls) <= 4 ? 5 : 9) && !taken.has(en));
  const [clue, word] = pick(pool.length ? pool : SCRAMBLE.filter(([, en]) => /^[a-z]+$/.test(en)), rnd); taken.add(word);
  return { clue, word };
}

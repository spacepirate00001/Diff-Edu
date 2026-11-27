// "Offline" = the browser says so, OR the last call failed for network reasons. Any answered call clears it (spec P15).
let browserOffline = false, lastFailed = false, lastOkAt = 0;
const subs = new Set();
const state = () => browserOffline || lastFailed;
function emit(before) { const now = state(); if (now !== before) subs.forEach(f => f(now)); }
export const net = {
  isOffline: () => state(),
  lastOkAt: () => lastOkAt,
  report(status) { const b = state(); if (!status) lastFailed = true; else { lastFailed = false; lastOkAt = Date.now(); } emit(b); },
  setBrowser(offline) { const b = state(); browserOffline = !!offline; emit(b); },
  on(f) { subs.add(f); return () => subs.delete(f); },
  reset() { browserOffline = lastFailed = false; subs.clear(); },
};

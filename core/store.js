// Phone storage that never throws. If localStorage is blocked, values live only in this open page.
let backend = null;
const mem = new Map();
try { backend = globalThis.localStorage || null; backend?.setItem('de.next.probe', '1'); backend?.removeItem('de.next.probe'); } catch { backend = null; }
export const store = {
  works: !!backend,
  get(k) { try { const v = backend ? backend.getItem(k) : mem.get(k); return v == null ? null : v; } catch { return mem.get(k) ?? null; } },
  set(k, v) { try { if (backend) backend.setItem(k, v); else mem.set(k, v); } catch { mem.set(k, v); } },
  del(k) { try { backend?.removeItem(k); } catch { /* ignore */ } mem.delete(k); },
  keys() { try { return backend ? Object.keys(backend) : [...mem.keys()]; } catch { return [...mem.keys()]; } },
  json(k, fallback = null) { try { const v = this.get(k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } },
  setJson(k, v) { this.set(k, JSON.stringify(v)); },
  // tests: swap the backend for a plain object with getItem/setItem/removeItem
  use(b) { backend = b; this.works = !!b; mem.clear(); },
};

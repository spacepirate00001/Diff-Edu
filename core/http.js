// The only place that calls fetch. Never throws: always { status, data }. status 0 = no answer (offline or timeout).
import { CFG } from './config.js';
import { net } from './net.js';

const real = async (method, path, { headers, body, timeoutMs = 15000 } = {}) => {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
  try {
    const r = await fetch(path.startsWith('http') ? path : CFG.url + path, { method, headers, body: body == null ? undefined : typeof Blob !== 'undefined' && body instanceof Blob ? body : JSON.stringify(body), signal: ctl?.signal });
    const text = await r.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: r.status, data, retryAfter: Number(r.headers.get('Retry-After')) || undefined };
  } catch { return { status: 0, data: null }; } finally { if (timer) clearTimeout(timer); }
};
let transport = real;
// The fake server (?fake=) replaces the transport; nothing else changes.
export const setTransport = t => { transport = t || real; };
export async function http(method, path, opts = {}) {
  const res = await transport(method, path, opts);
  net.report(res.status);
  return res;
}

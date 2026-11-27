// Server calls with the session attached. Never throws: always { status, data, kind }.
// A 401 triggers one quiet refresh and one retry (spec 2.2).
import { CFG } from './config.js';
import { http } from './http.js';
import { session } from './session.js';
import { kindOf } from './errors.js';

export async function request(method, path, body, { auth = true, prefer, retried = false, contentType, headers: more } = {}) {
  const headers = { apikey: CFG.key, 'Content-Type': contentType || 'application/json', ...more };
  const tok = session.token();
  if (auth && tok) headers.Authorization = 'Bearer ' + tok;
  if (prefer) headers.Prefer = prefer;
  const res = await http(method, path, { headers, body });
  if (res.status === 401 && auth && !retried && session.has() && await session.refresh()) return request(method, path, body, { auth, prefer, retried: true, contentType, headers: more });
  return { ...res, kind: kindOf(res) };
}
export const sel = (table, query = '') => request('GET', `/rest/v1/${table}${query ? '?' + query : ''}`);
export const rpc = (name, args = {}) => request('POST', `/rest/v1/rpc/${name}`, args);
// A file into a storage bucket (a retry overwrites: x-upsert). -> the same { status, data, kind } as every call
export const upload = (bucket, path, blob, type) => request('POST', `/storage/v1/object/${bucket}/${path}`, blob, { contentType: type || 'application/octet-stream', headers: { 'x-upsert': 'true' } });
export const fn = (name, body, auth = false) => request('POST', `/functions/v1/${name}`, body, { auth });
export const insert = (table, row, prefer = 'return=minimal') => request('POST', `/rest/v1/${table}`, row, { prefer });
export const upsert = (table, row, onConflict) =>
  request('POST', `/rest/v1/${table}${onConflict ? '?on_conflict=' + onConflict : ''}`, row, { prefer: 'resolution=merge-duplicates,return=minimal' });
// rows of a successful read, or [] (the caller looks at .kind for the reason)
export const rows = res => (res.kind === 'ok' && Array.isArray(res.data) ? res.data : []);

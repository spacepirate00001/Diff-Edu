// Memes: server calls. Every read and write goes through the SECURITY DEFINER functions of app/supabase/memes.sql; pictures live in the private bucket "memes".
import { rpc, rows, upload, request } from '../../core/api.js';
import { CFG } from '../../core/config.js';
import { session } from '../../core/session.js';
import { uuid } from '../../core/bn.js';
import { fitSize, MAX_BYTES } from './logic.js';

export const msgOf = r => r?.data?.message || r?.data?.hint || '';
export const loadFeed = before => rpc('memes_feed', { p_limit: 12, p_before: before || null });
export const loadMine = () => rpc('meme_mine');
export const laugh = id => rpc('meme_laugh', { p_id: id });
export const report = id => rpc('meme_report', { p_id: id });
export const loadReview = status => rpc('memes_review_list', { p_status: status });
export const review = (id, ok) => rpc('meme_review', { p_id: id, p_ok: ok });
export const waitingCount = () => rpc('memes_waiting_count');

// Delete a picture file (best effort: the row is already gone from the page).
const dropFile = path => (path ? request('DELETE', `/storage/v1/object/memes/${path}`) : null);
export async function removeMine(id) { const r = await rpc('meme_delete_mine', { p_id: id }); if (r.kind === 'ok') dropFile(typeof r.data === 'string' ? r.data : null); return r; }
export async function removeAny(id) { const r = await rpc('meme_remove', { p_id: id }); if (r.kind === 'ok') dropFile(typeof r.data === 'string' ? r.data : null); return r; }
export async function rejectOne(id, path) { const r = await review(id, false); if (r.kind === 'ok') dropFile(path); return r; }

// A picture link that works for an hour. Kept in memory so scrolling back does not ask again.
const urls = new Map();
export async function pictureUrl(path) {
  if (urls.has(path)) return urls.get(path);
  const r = await request('POST', `/storage/v1/object/sign/memes/${path}`, { expiresIn: 3600 });
  const u = r.kind === 'ok' && r.data?.signedURL ? CFG.url + '/storage/v1' + r.data.signedURL : null;
  if (u) urls.set(path, u);
  return u;
}

// Shrink a photo to at most 1080 px on the long side as a JPEG under 1.5 MB. -> Blob, or null if the phone cannot read it.
export async function shrinkPhoto(file) {
  try {
    const bmp = await createImageBitmap(file);
    const { w, h } = fitSize(bmp.width, bmp.height);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(bmp, 0, 0, w, h); bmp.close?.();
    for (const q of [0.82, 0.7, 0.55, 0.4]) {
      const b = await new Promise(res => c.toBlob(res, 'image/jpeg', q));
      if (b && b.size <= MAX_BYTES) return b;
    }
  } catch { /* fall through */ }
  return null;
}
// Upload the picture (if any), then post the meme. -> { ok } | { error: server message | 'offline' | 'picture' }
export async function post({ body, blob, coachingId }) {
  let path = null;
  if (blob) {
    path = `${coachingId}/${session.uid()}/${uuid()}.jpg`;
    const u = await upload('memes', path, blob, 'image/jpeg');
    if (u.kind === 'offline') return { error: 'offline' };
    if (u.kind !== 'ok') return { error: 'picture' };
  }
  const r = await rpc('meme_submit', { p_body: body || null, p_image_path: path });
  if (r.kind === 'ok') return { ok: true };
  if (path) dropFile(path);
  return { error: r.kind === 'offline' ? 'offline' : msgOf(r) || 'x' };
}
export { rows };

// A page that loads something and always shows one of the five states (loading, empty, offline, error, no permission), then the data.
// load() -> { kind: 'ok'|'offline'|'missing'|'forbidden'|..., data }. The last good answer is kept on the phone per person and shown (with a yellow strip) when the net is down.
import { h } from './dom.js';
import { loading, errorState, offlineState, forbiddenState, unavailableState, staleBanner } from './states.js';
import { cache } from '../core/cache.js';
import { session } from '../core/session.js';
import { kids } from '../core/children.js';
import { childBar, noKidsCard } from '../features/switcher/child-switcher.js';

// opts: { key, load(), isEmpty(data), empty(): node, draw(data, reload): node|node[] }
export function dataPage({ key, load, isEmpty, empty, draw }) {
  const root = h('div', { class: 'datapage', 'aria-live': 'polite' });
  let dead = false, run = 0;
  const uid = session.uid();
  async function go() {
    const me = ++run;
    root.replaceChildren(loading(3));
    let r; try { r = await load(); } catch { r = { kind: 'error' }; }
    if (dead || me !== run) return;
    const old = key ? cache.get(uid, key) : null;
    if (r.kind === 'ok' && key) cache.set(uid, key, r.data);
    const data = r.kind === 'ok' ? r.data : old?.v;
    if (data === undefined) {
      root.replaceChildren(r.kind === 'offline' ? offlineState(go) : r.kind === 'forbidden' ? forbiddenState(() => { location.hash = '#/today'; }) : r.kind === 'missing' ? unavailableState() : errorState(go));
      return;
    }
    const out = [];
    if (r.kind !== 'ok') out.push(staleBanner(r.kind === 'offline' ? 'offline' : 'error', old?.at));
    out.push(...[isEmpty?.(data) ? empty() : draw(data, go)].flat().filter(Boolean));   // a draw may return null for a part that is not shown
    root.replaceChildren(...out);
  }
  go();
  return { node: root, reload: go, destroy() { dead = true; } };
}
// The same, for the child chosen on the guardian tabs: shows the child strip and loads again when another child is chosen.
export function childPage(opts) {
  const root = h('div', { class: 'child-page' });
  let inner = null;
  const draw = () => {
    inner?.destroy();
    const kid = kids.current();
    if (!kid) { root.replaceChildren(noKidsCard()); return; }
    inner = dataPage({ ...opts, key: opts.key ? `${opts.key}.${kid.id}` : null, load: () => opts.load(kid), draw: (d, go) => opts.draw(d, kid, go), isEmpty: opts.isEmpty && (d => opts.isEmpty(d, kid)) });
    root.replaceChildren(childBar() || '', inner.node);
  };
  const paint = () => { if (!kids.list().length) { root.replaceChildren(loading(2)); kids.load({ maxAge: 15000 }).then(draw); } else draw(); };
  paint();
  const off = kids.on(() => { if (root.isConnected) draw(); });
  return { node: root, destroy() { off(); inner?.destroy(); } };
}

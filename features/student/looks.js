// Shared by the shop and the profile: turns the saved loadout (student_rewards.loadout + the older avatar / theme columns) into { slot: item } using the shop_items list.
// Any missing table or column just gives an empty look, so the app still works before the shop database update is live.
export function lookFrom(w, cat) {
  const lo = w && w.loadout && typeof w.loadout === 'object' ? { ...w.loadout } : {};
  if (w?.theme) lo.theme = w.theme;
  if (w?.avatar) lo.avatar = w.avatar;
  const look = {};
  for (const [slot, key] of Object.entries(lo)) {
    const base = slot.replace(/[23]$/, ''), it = cat.find(x => x.key === key && x.slot === base);
    if (!it) continue;
    if (base === 'badge') (look.badges ||= []).push(it); else look[base] = it;
  }
  return look;
}

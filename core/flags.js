// Feature flags for things that are built but not switched on yet. EVERY flag starts OFF.
//   online_pay  : the "অনলাইনে ফি দিন" button (bKash / Nagad). OFF until the owner has a merchant account and payment-callback verifies a provider
//                 (today the callback refuses everything, so a button would only take money that cannot be recorded).
//   merit_list  : the student's own "মেধা তালিকা" page (rpc merit_list). OFF until the owner decides; the server also shows a child only when that child's merit_list consent is on.
//   diffy_chat  : the "ডিফিকে জিজ্ঞেস করো" chat sheet talks to the real AI (edge function `ai`, mode "tutor"). OFF until the owner has picked a
//                 child-safe AI plan. While OFF the sheet is not offered at all on a real server (fake mode uses canned answers).
//   web_push    : phone notifications through the browser (core/push.js). OFF until the owner has made the VAPID keys, set the three secrets and deployed
//                 web-push-sender, and switched the lab feature on (set_feature_flag). Nothing asks for permission while it is off.
// A flag is ON only when the server says so: rpc my_features lists its key. "Unknown" (call failed) is OFF here, unlike ordinary features,
// because a button that moves money must never appear by accident. In fake mode (localhost only) boot.js may switch one on: ?flag=online_pay,diffy_chat
import { features } from './features.js';

export const FLAGS = Object.freeze({ online_pay: false, diffy_chat: false, merit_list: false, web_push: false });
const forced = {};
export const flags = {
  on(name) {
    if (!(name in FLAGS)) return false;
    if (name in forced) return forced[name];
    const keys = features.keys();
    return keys ? keys.has(name) : FLAGS[name];
  },
  force(name, value) { if (name in FLAGS) forced[name] = !!value; },     // fake mode only (boot.js)
  reset() { for (const k of Object.keys(forced)) delete forced[k]; },
};

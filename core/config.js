// Server address and the publishable key (safe to ship: RLS protects the data), same as the old app.
export const CFG = {
  url: 'https://uwbyxwxfhrffrrqvheft.supabase.co',
  key: 'sb_publishable_fXPLUYRqvrz9d6i9xL2IAQ_tmtZ194t',
  slug: 'diff-edu',
};
export const VERSION = 'নতুন অ্যাপ ১.০ (ধাপ ১)';
export const OFFICE_PHONE = '01711678818';
export const OFFICE_PHONE_BN = '০১৭১১-৬৭৮৮১৮';
export const KEYS = { auth: 'diffedu-next-auth', prefs: 'de.next.prefs', outboxDb: 'de.next.outbox', cache: 'de.next.c.', seen: 'de.next.inboxSeen.', consentRetry: 'de.next.consent.' };
// Web Push (core/push.js): the VAPID PUBLIC key goes here (it is public by design, the private key never leaves the server's secrets).
// Empty = push stays off even when the flag is on. The owner pastes the key after generating the pair, see the step-4 report.
export const WEB_PUSH = { publicKey: '' };

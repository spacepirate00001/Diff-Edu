# Diff Edu PWA (অভিভাবক ও শিক্ষার্থী)

Static site, no build step. Same Supabase backend as the Android app.

## Local test
    python -m http.server 8099   # then open http://localhost:8099

## Host (free, HTTPS needed for install + offline)
Cloudflare Pages: Workers & Pages → Create → Pages → Upload assets → drop this folder.
Netlify: app.netlify.com/drop → drop this folder.
`_headers` works on both. Update = upload the folder again.

## Notes
- Publishable key in app.js is public by design; RLS protects data.
- Bump `V` in sw.js when changing shell files, so phones refresh the cache.
- Teachers/admins are rejected on login (use the Android app).

## Topic videos (in-app player)
- Videos are rows in `materials` with `kind='video'`, `url` = YouTube link, `subject_id` + `chapter` = the topic
  (match the chapter title in the syllabus so "বুঝিনি" and the syllabus ▶ button find it). No schema change.
- Teachers/admins add links in bulk: staff home → "ভিডিও লিংক যোগ" (class → subject → chapter → paste links, one per line,
  optional `শিরোনাম | লিংক`). Needs INSERT/DELETE on `materials` for staff under RLS.
- Playback is always inside the app (`videos.js`, YouTube nocookie embed; CSP `frame-src` allows only that host).
  Entry points: student/guardian home "অনলাইন ক্লাস (ভিডিও)", syllabus chapter ▶, homework "বুঝিনি", materials list.

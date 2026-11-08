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

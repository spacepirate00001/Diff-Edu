# Diff Edu PWA (অভিভাবক, শিক্ষার্থী, শিক্ষক, অ্যাডমিন)

Static site, no build step. Same Supabase backend as the Android app. The source of truth is `app/pwa-dev/next` in the diff-edu-main repo; this repo is the published copy.

## Local test
    python -m http.server 8099   # then open http://localhost:8099
    # demo without a server: http://localhost:8099/?fake=guardian|student|teacher|admin  (works on localhost only)

## Host (free, HTTPS needed for install + offline)
Cloudflare Pages / Netlify, `_headers` works on both. Update = push to main.

## Notes
- Publishable key in core/config.js is public by design; RLS protects data.
- Change `V` in sw.js (and regenerate FILES with audit/gen-sw.mjs in diff-edu-main) when any file changes, so phones refresh the cache.

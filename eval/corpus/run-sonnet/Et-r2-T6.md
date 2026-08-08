---
kind: eval-artifact
run: sonnet
variant: Et
replicate: r2
task: T6
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will speed things up for some endpoints and break correctness for others. GET doesn't mean "safe to cache everywhere" — it means "safe to retry," which is a different guarantee.

The risk is a shared cache. A CDN cache is shared across every user hitting that edge node. If a GET endpoint returns user-specific or authenticated data — `/api/me`, `/api/cart`, `/api/orders` — and you cache it in a shared layer, the first user's response gets served to the next user who hits the same URL. That's not a performance bug, it's a data leak.

Before caching anything at the CDN, sort your GET endpoints into two buckets:

- **Truly public, identical for every user** (product catalog, static content, public pages). These are safe to cache in a shared CDN cache.
- **Personalized or authenticated** (anything scoped to a user or session). These need `Cache-Control: private, no-store` or must stay out of the shared cache entirely — cache them client-side or in a per-user cache instead.

For the public bucket, a few things to get right:

- Set explicit `Cache-Control` headers (`max-age`, `s-maxage`) rather than relying on CDN defaults.
- Use `Vary` headers if the response changes by anything other than the URL (locale, `Accept-Encoding`).
- Have an invalidation plan — cache-busting on deploy, or short TTLs, so stale data doesn't linger.

So: yes for the public, cacheable subset, with real cache headers and an invalidation strategy. No for anything that varies by user — that one needs a different caching layer, not the CDN.

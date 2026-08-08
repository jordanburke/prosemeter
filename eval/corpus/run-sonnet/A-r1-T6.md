---
kind: eval-artifact
run: sonnet
variant: A
replicate: r1
task: T6
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Partly — it'll work well for some endpoints and break others, so it needs to be per-route, not a blanket policy on every GET.

What it works for: GET endpoints that return the same response for the same request and aren't tied to a specific user — public catalog data, static config, anything cacheable purely by URL. That's exactly what CDN caching is built for.

What breaks:
- **Authenticated or personalized responses.** If something like `/api/me` or `/api/cart` gets cached at the CDN, one user can be served another user's cached response. This is a real, seen-in-production data-leak bug class, not a theoretical one.
- **Responses that vary by header** the cache key doesn't account for (`Authorization`, `Accept-Language`, etc.) — you need `Vary` set correctly, or you get cache poisoning across users or locales.
- **Freshness.** Anything that changes often — stock counts, prices — will serve stale data unless TTLs are short or there's an invalidation path.
- **Query-string handling.** Make sure the cache key includes query params correctly, or different queries can collide (or over-fragment) in the cache.

Practical approach: opt in per route rather than enabling it globally. Set `Cache-Control: public, max-age=...` on genuinely public, non-personalized GETs; leave everything else `no-store` or `private`; add an invalidation mechanism (purge-on-write or short TTL) for anything that changes. Don't cache anything behind auth unless you're deliberately varying the cache key by user, and even then think hard about whether it's worth the complexity.

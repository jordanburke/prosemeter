---
kind: eval-artifact
run: 3
variant: E
replicate: r1
task: T6
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will speed things up and leak user data. A shared CDN cache stores one copy per URL and serves it to everyone, so any personalized GET response will reach the wrong person.

Picture `GET /api/me`. The first user hits it, the CDN stores their profile against that URL, and the next thousand users get that same profile back. Same for `/api/cart`, `/api/notifications`, anything scoped to a session. The CDN does not know about your auth cookie unless you tell it, and by default it will not vary on one.

"GET" also does not mean "safe to cache." It means the request has no body and should not change state. Plenty of GETs return per-user data, and plenty return data that goes stale in seconds.

So split the endpoints into three groups:

**Public and stable** — product catalog, static config, published content. Cache these at the edge, and this is where the real win is. Use `Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=600`. `s-maxage` sets the CDN's TTL separately from the browser's, and `stale-while-revalidate` lets the edge serve slightly old data while it refreshes in the background.

**Per-user** — anything behind auth. Mark these `Cache-Control: private, no-store`. `private` alone means "browser may cache, CDN may not," which is often what you want; `no-store` means nobody caches it. Choose per endpoint.

**Frequently changing** — inventory counts, live prices, anything where stale data causes a support ticket. Short TTLs, or skip the cache.

Whatever you cache, you need a way to purge it. Pick one now, not after someone publishes a wrong price with a five-minute TTL. Surrogate keys or cache tags let you purge by entity when the underlying data changes, which is much better than waiting out the TTL.

A few specifics that bite people:

- **Set `Vary` correctly.** If a response differs by `Accept-Language` or `Accept-Encoding`, say so, or users get the wrong variant.
- **Never put an auth token in a query string.** It becomes part of the cache key and lands in CDN logs.
- **Watch the query-string handling.** Many CDNs key on the full URL, so tracking params like `?utm_source=` shard your cache and tank the hit rate. Strip them at the edge.
- **Default to not caching.** Set `no-store` at the origin and opt endpoints in one at a time. The failure mode of over-caching is a data leak; the failure mode of under-caching is a slow page.

Measure the hit rate afterward. If it is low, the cache is adding a hop and giving nothing back, and the fix is usually TTLs or cache keys rather than more endpoints.

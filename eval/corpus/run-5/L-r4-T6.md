---
kind: eval-artifact
run: 5
variant: L
replicate: r4
task: T6
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Caching every GET in a shared cache will leak one user's data to another. Cache the GETs that are the same for everyone, and only those.

The danger is the word "shared." A CDN cache keys on the URL, not on who asked. So `GET /api/me` from Alice gets stored, and Bob's request for the same URL hits that stored copy. Bob sees Alice's profile. This is a real class of incident, not a theoretical one, and it is usually found by a customer.

Session cookies and `Authorization` headers do not save you. Most CDNs ignore them for cache lookup unless you configure otherwise, because they are not in the cache key.

The second problem is that GET does not mean safe to cache. GET means the request has no side effects. It says nothing about whether the response is the same for everyone, or stable over time. Plenty of GETs are per-user, or change every second, or both.

Sort your endpoints into three buckets.

**Public and stable.** Product catalog, static config, published articles. Cache these at the edge with a long `Cache-Control: public, max-age=...`. This is where the win is.

**Per-user.** Anything reflecting the caller's identity. Mark these `Cache-Control: private, no-store`. `private` allows the browser to keep a copy and forbids the shared cache from doing so.

**Fresh-critical.** Inventory counts, prices during a sale, balances. Either skip the cache or use a short TTL you have thought about.

Two mechanics are worth knowing.

Set `Vary` on anything that differs by request header — `Vary: Accept-Language` for localized responses, for example. It adds that header to the cache key.

Default to not caching, then opt in. An endpoint added next quarter with no cache headers should be uncached, not cached by a blanket rule someone wrote a year ago.

Then plan invalidation before you turn it on. A wrong response cached for 24 hours is worse than a slow correct one. Use short TTLs with `stale-while-revalidate`, or version your URLs so a change publishes a new key.

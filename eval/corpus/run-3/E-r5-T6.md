---
kind: eval-artifact
run: 3
variant: E
replicate: r5
task: T6
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Do not do that. A shared CDN cache in front of every GET will leak one user's data to another user, and `GET` by itself is no guarantee that a response is shareable.

The dangerous case is any endpoint whose response depends on who is asking. `/api/me`, `/api/cart`, `/api/notifications`, even `/api/search?q=x` when results are permission-filtered. The CDN caches by URL. Two users hit the same URL, the second one gets the first one's response. Alice sees Bob's cart. This is the bug that lands companies in the news.

The rule that matters: cache in a shared cache only what is identical for every requester. Personalization is the disqualifier, not the HTTP verb.

So split your endpoints into three buckets.

**Public and stable** — product catalog, static config, published content. Cache these hard at the edge:

```
Cache-Control: public, max-age=300, s-maxage=3600, stale-while-revalidate=60
```

**Per-user** — anything behind auth that varies by identity. Keep these out of the shared cache entirely:

```
Cache-Control: private, no-store
```

`private` means the browser may cache it but the CDN must not. Use `no-store` when the data is sensitive enough that you do not want it on disk either.

**Varies by a header** — locale, currency, API version. These can be cached if you declare the axis with `Vary: Accept-Language` and so on. Be careful: `Vary: Cookie` technically works but shatters your hit rate to nothing, since every session cookie is a distinct cache key. If you find yourself reaching for it, the endpoint belongs in the `private` bucket.

Two more traps. Make sure your origin sets these headers explicitly, because a missing `Cache-Control` lets the CDN apply its own heuristics — and defaults have caused exactly this leak before. And plan invalidation up front: `s-maxage=3600` means a bad response is live for an hour unless you can purge, so wire up tag-based purging before you raise the TTLs.

Start with the public bucket only. Measure the hit rate. Expand from there.

---
kind: eval-artifact
run: 2
variant: G
replicate: r1
task: T6
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It'll speed up some endpoints and leak user data on others. The problem isn't caching GETs — it's the word *shared*.

A shared CDN cache stores one response per URL and hands it to everyone who asks for that URL. That's correct for a product page. It's a breach for `/api/me`, `/api/cart`, or anything else whose body depends on who's asking. The first user to hit it fills the cache, and the next user gets that user's data. GET says the request is safe to repeat. It says nothing about whether the response is safe to share.

The dividing line is what varies the response:

- **Same for everyone** — product catalog, public config, static content. Cache it shared, long TTL, big win.
- **Varies by user** — anything behind auth. Either `Cache-Control: private` so only the browser stores it, or `no-store` if it's sensitive enough that disk caching matters.
- **Varies by something in the request** — locale, currency, feature flag. Cacheable, but only with a correct `Vary` header, and each variant multiplies your cache entries.

The header to get right is `Cache-Control`:

```
Cache-Control: public, max-age=300, s-maxage=3600   # shared-cacheable
Cache-Control: private, max-age=0, must-revalidate  # browser only
Cache-Control: no-store                             # nowhere
```

`s-maxage` targets the CDN specifically, so you can hold something for an hour at the edge while browsers revalidate every few minutes.

Two traps beyond the auth one:

- **`Vary: Cookie` mostly defeats caching.** Cookie values are near-unique per user, so nearly every request becomes a cache miss with the storage cost of a hit. If your responses depend on cookies, that endpoint isn't shared-cacheable — say so with `private` rather than trying to `Vary` your way out.
- **You need an invalidation story.** A five-minute TTL means five minutes of stale data after a write. That's fine for a catalog and not fine for inventory counts. Decide the tolerance per endpoint, and wire up purge-on-write for anything where stale is expensive.

How I'd approach it: list your GET endpoints, mark each one public, per-user, or per-variant, and start with the public ones. That's usually where the traffic and the win are anyway. Default everything else to `private` until someone makes a specific case for it.

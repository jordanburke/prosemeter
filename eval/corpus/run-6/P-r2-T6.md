---
kind: eval-artifact
run: 6
variant: P
replicate: r2
task: T6
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

It will speed the app up, and it will also serve one user's private data to another. The caching is not the mistake. "Every GET endpoint" is.

## Why GET is not the right test

`GET` means the request has no side effects. It does not mean the response is the same for everyone. A shared CDN cache stores one copy per cache key — normally the URL — and hands it to whoever asks next.

So `GET /api/me` gets fetched once, by whichever user arrives first, then served to every later user until it expires. Same for `/api/cart`, `/api/notifications`, `/api/orders`. This is not hypothetical. It is the most common way user data leaks through a CDN.

The question to ask is not "is this a GET." It is "**is this response the same for every possible requester**." Only the second one decides whether a shared cache is safe.

## The three-way split

Sort your endpoints into these buckets.

**Public and identical for all** — product catalog, pricing pages, published articles, static config. Cache these aggressively. The real win lives here.

```
Cache-Control: public, max-age=60, s-maxage=600, stale-while-revalidate=86400
```

**Personalized** — anything reflecting who is asking. It must never enter a shared cache.

```
Cache-Control: private, no-store
```

`private` lets browsers cache it and forbids shared caches. `no-store` forbids everyone. Use `no-store` for anything sensitive, and `private, max-age=...` when a per-user browser cache genuinely helps.

**Semi-public but segmented** — same for everyone in a region, locale, currency, or plan tier. Cacheable, as long as the segmentation lives in the cache key. Prefer putting it in the URL path, like `/api/v1/us/catalog`. Failing that, use `Vary`, and know two things: `Vary` on a high-cardinality header shreds your hit rate, and `Vary: Cookie` disables caching in practice, because every session cookie is unique.

## Things that bite even on genuinely public data

**Invalidation.** Long TTLs are what make a CDN worth having, and they mean stale data until expiry. You need a purge path: tag-based purge, or content-hashed URLs so a change produces a new URL and nothing needs purging. Decide this before you set long TTLs, not after someone publishes a wrong price.

**Authorization is not authentication.** An endpoint can be public-ish and still authorization-dependent — a document visible only to one workspace. Caching by URL alone means anyone with the URL gets the content, because a cached response never re-runs your permission check.

**Error responses.** A CDN will cache a 500 or a 404 for the full TTL if the origin sends cacheable headers on it. One bad deploy becomes ten minutes of a cached error page. Set short or zero TTLs on error statuses explicitly.

**Cookies and Set-Cookie.** A response carrying `Set-Cookie` that lands in a shared cache hands that session cookie to the next requester. Most CDNs refuse to cache these by default. Verify yours does rather than assuming.

**Cache-key hygiene.** Query strings, header casing, trailing slashes, and tracking parameters like `utm_source` all fragment the cache. Normalize the key, or your hit rate will come in far below expectation and you will blame caching for a configuration problem.

## Whether it will even be fast

Check where the time goes before doing any of this. If your p95 is dominated by an unindexed query on an authenticated endpoint, a CDN in front of public endpoints will not move it, because those endpoints cannot be cached.

A CDN also only pays off at a decent hit rate. Long-tail content with few requests per object hits rarely, and a miss costs slightly *more* than no CDN, because of the extra network hop.

## A safer default to propose

Flip the polarity. Default everything to `no-store` at the framework level, then opt specific routes into caching, each with a comment saying why that response is safe to share. Opt-in is the only version that fails safely. Opt-out means every new endpoint is a potential leak until someone remembers.

Then add a test that fails the build when a route returning user data carries neither `private` nor `no-store`. Cheap to write, and it catches the mistake in CI instead of a support ticket.

**Short version:** cache the public endpoints, mark the personalized ones `private, no-store`, put segmentation in the URL rather than in `Vary`, and build the purge path before you set long TTLs. Caching all GETs uniformly is a data leak with a performance improvement attached.

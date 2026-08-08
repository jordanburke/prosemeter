---
kind: eval-artifact
run: 5
variant: A
replicate: r2
task: T6
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will speed the app up and it will also serve one user's private data to another. "Every GET endpoint" is the part that is wrong, not the caching itself.

## Why GET is not the right test

`GET` means the request has no side effects. It does not mean the response is the same for everyone. A shared CDN cache stores one copy per cache key — normally the URL — and serves it to whoever asks next.

So `GET /api/me` gets fetched once, by whichever user happens to be first, and then handed to every subsequent user until it expires. Same for `/api/cart`, `/api/notifications`, `/api/orders`. This is not a hypothetical; it is the single most common way user data leaks through a CDN, and it has taken down companies' reputations.

The right question is not "is this a GET" but "**is this response the same for every possible requester**." Those are different questions, and only the second one determines whether a shared cache is safe.

## The three-way split

Sort your endpoints into these buckets.

**Public and identical for all** — product catalog, pricing pages, published articles, static config. Cache these in the CDN aggressively. This is where the real win lives.

```
Cache-Control: public, max-age=60, s-maxage=600, stale-while-revalidate=86400
```

**Personalized** — anything reflecting who is asking. Must never enter a shared cache:

```
Cache-Control: private, no-store
```

`private` means browsers may cache it but shared caches may not. `no-store` means nobody caches it. Use `no-store` for anything sensitive; `private, max-age=...` when a per-user browser cache is genuinely useful.

**Semi-public but segmented** — same for everyone in a region, locale, currency, or plan tier. Cacheable, but the segmentation must be in the cache key. Prefer putting it in the URL path (`/api/v1/us/catalog`). Failing that, use `Vary`, and know that `Vary` on a high-cardinality header shreds your hit rate, and `Vary: Cookie` effectively disables caching entirely because every session cookie is unique.

## Things that bite even on genuinely public data

**Invalidation.** Long TTLs are what make a CDN worth having, and they mean stale data until expiry. You need a purge path — tag-based purge, or content-hashed URLs so a change produces a new URL and nothing needs purging. Decide this before you set long TTLs, not after someone publishes a wrong price.

**Authorization is not authentication.** An endpoint can be public-ish and still authorization-dependent — a document visible only to members of a workspace. Caching by URL alone means anyone with the URL gets the content, bypassing your permission check entirely. Cached responses do not re-run your authorization code.

**Error responses.** A CDN will happily cache a 500 or a 404 for the full TTL if the origin sends cacheable headers on it. One bad deploy becomes ten minutes of a cached error page. Set short or zero TTLs on error statuses explicitly.

**Cookies and Set-Cookie.** A response carrying `Set-Cookie` that lands in a shared cache hands that session cookie to the next requester. Most CDNs refuse to cache these by default — verify yours does rather than assuming.

**Cache-key hygiene.** Query strings, header casing, trailing slashes, and tracking parameters like `utm_source` all fragment the cache. Normalize the key or your hit rate will be far lower than you expect, and you will conclude caching does not help when the configuration was the problem.

## Whether it will even be fast

Check where the time actually goes before doing any of this. If your p95 is dominated by an unindexed query on an authenticated endpoint, a CDN cache in front of public endpoints will not move it, because those endpoints cannot be cached.

Also note that a CDN only helps at hit rates that make it worth it. Long-tail content with low request-per-object rates has a low hit rate, and a miss costs slightly *more* than no CDN — an extra network hop.

## A safer default to propose

Flip the polarity. Default everything to `no-store` at the framework level, then opt specific routes into caching explicitly, with a comment saying why the response is safe to share. Opt-in is the only version of this that fails safely; opt-out means every new endpoint is a potential leak until someone remembers.

Then add a test that fails the build if a route returning user data does not carry `private` or `no-store`. Cheap to write, and it catches the mistake in CI rather than in a support ticket.

**Short version:** cache the public endpoints, mark the personalized ones `private, no-store`, put segmentation in the URL rather than in `Vary`, and build the purge path before you set long TTLs. Caching all GETs uniformly is a data leak with a performance improvement attached.

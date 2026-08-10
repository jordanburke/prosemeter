---
kind: eval-artifact
run: 6
variant: R
replicate: r2
task: T6
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

It will speed the app up. It will also serve one user's private data to another. "Every GET endpoint" is the wrong part, not the caching.

## Why GET is not the right test

`GET` means the request has no side effects. It does not mean the response is the same for everyone. A shared CDN cache stores one copy per cache key — normally the URL — and hands that copy to the next requester in line.

So `GET /api/me` gets fetched once, by whichever user arrives first. Then the CDN hands that response to every later user until it expires. The same goes for `/api/cart`, `/api/notifications`, and `/api/orders`. This is not hypothetical: it is the common way user data leaks through a CDN, and it has cost companies their reputations.

The right question is not "is this a GET" but "**is this response the same for every requester**." Those are different questions. Only the second one determines whether a shared cache is safe.

## The three-way split

Put your endpoints into these buckets.

**Public and identical for all** — product catalog, pricing pages, published articles, static config. Cache these in the CDN aggressively. The real win lives here.

```
Cache-Control: public, max-age=60, s-maxage=600, stale-while-revalidate=86400
```

**Personalized** — anything reflecting who is asking. This must never enter a shared cache:

```
Cache-Control: private, no-store
```

`private` lets browsers cache the response and bars shared caches from it. `no-store` bars everyone. Use `no-store` for anything sensitive. Use `private, max-age=...` when a per-user browser cache buys you something.

**Semi-public but segmented** — same for everyone in a region, locale, currency, or plan tier. These are cacheable, but the segmentation belongs in the cache key. Put it in the URL path (`/api/v1/us/catalog`). Failing that, use `Vary`. Know two things about `Vary`: on a high-cardinality header it shreds your hit rate, and `Vary: Cookie` turns caching off, because every session cookie is unique.

## What bites even on public data

**Invalidation.** Long TTLs are what make a CDN worth having, and they mean stale data until expiry. You need a purge path. Use tag-based purge, or content-hashed URLs, where a change produces a new URL and nothing needs purging. Decide this before you set long TTLs, not after your team publishes a wrong price.

**Authorization is not authentication.** An endpoint can be public-ish and still authorization-dependent — a document visible only to members of a workspace. Cache by URL alone and anyone holding the URL gets the content. Your permission check never runs. A cached response does not re-run your authorization code.

**Error responses.** A CDN caches a 500 or a 404 for the full TTL when the origin sends cacheable headers on it. One bad deploy becomes ten minutes of a cached error page. Set short or zero TTLs on error statuses.

**Cookies and Set-Cookie.** A response carrying `Set-Cookie` that lands in a shared cache hands that session cookie to the next requester. The major CDNs refuse to cache these by default. Verify yours does.

**Cache-key hygiene.** Query strings, header casing, trailing slashes, and tracking arguments like `utm_source` all fragment the cache. Normalize the key. Otherwise your hit rate lands far below what you expect, and you conclude caching does not help when the configuration was the problem.

## Whether it will even be fast

Check where the time goes before doing any of this. If an unindexed query on an authenticated endpoint dominates your p95, a CDN in front of public endpoints will not move it. Those endpoints cannot be cached.

A CDN also only pays off at a decent hit rate. Long-tail content gets few requests per object, so the hit rate stays low, and a miss costs more than no CDN at all — one extra network hop.

## A safer default to propose

Flip the polarity. Default everything to `no-store` at the framework level. Then opt specific routes into caching, each with a comment saying why the response is safe to share. Opt-in is the only version of this that fails safely. Opt-out means every new endpoint is a leak waiting for someone to remember.

Then add a test that fails the build when a route returning user data carries neither `private` nor `no-store`. It is cheap to write, and it catches the mistake in CI instead of in a support ticket.

**Short version:** cache the public endpoints, mark the personalized ones `private, no-store`, put segmentation in the URL instead of in `Vary`, and build the purge path before you set long TTLs. Caching all gets uniformly is a data leak with a performance improvement attached.

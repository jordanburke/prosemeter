---
kind: eval-artifact
run: 6
variant: R
replicate: r5
task: T6
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

It will speed up part of the app and leak private data in the rest. The GET method does not determine cacheability. One question determines it: is the response the *same for everyone*? A shared cache is where that distinction turns into an incident.

## The failure mode to picture

A CDN cache is shared across all users. Store one user's personalized response under a URL, and the next request for that URL gets that same body — for a different person.

```
alice → GET /api/me → origin → { "name": "Alice", "email": ... }
                              CDN stores it under /api/me
bob   → GET /api/me → CDN   → { "name": "Alice", "email": ... }
```

Nothing here is exotic. `/api/me`, `/dashboard`, `/cart`, `/notifications`, and any endpoint whose output depends on a session cookie or an `Authorization` header all have this shape. The cache key is the URL. What made the response different was not in the URL.

This bug has produced public breaches at large companies. It is not theoretical.

## The split that matters

Put your GET endpoints into three buckets. The bucket decides the policy, not the method.

**Same for everyone, changes rarely.** Static assets, product catalogs, public documentation, published articles, config blobs. Cache these hard in the CDN. All the speed lives here, and these are the bulk of your bytes.

```
Cache-Control: public, max-age=31536000, immutable
```

Pair long TTLs with content-hashed filenames. A deploy then changes the URL instead of needing an invalidation.

**Same for everyone, changes every few seconds.** Live prices, vote counts, availability. Cache these briefly in the CDN. Ten seconds collapses a traffic spike into one origin request, and `stale-while-revalidate` keeps the fast path warm during the refresh.

```
Cache-Control: public, max-age=10, stale-while-revalidate=60
```

**Different per user.** Never in a shared cache.

```
Cache-Control: private, no-store
```

`private` lets a browser keep the response and forbids a CDN from keeping it. For sensitive data, choose `no-store`. It forbids writing the response to disk at all.

## What bites you even in the "public" bucket

**Vary headers.** If a response differs by `Accept-Encoding`, `Accept-Language`, or content negotiation, say so with `Vary`. Omit it and the cache serves a German page to an English reader, or a Brotli body to a client that cannot decode it. Do not reach for `Vary: Cookie` on a shared cache as a safety measure. It works, and it destroys your hit rate, because cookie values are near-unique.

**Query strings.** Analytics and campaign keys (`utm_*`, `fbclid`, `gclid`) fragment the cache key, so identical content gets stored dozens of times. Configure the CDN to ignore or normalize them.

**Authenticated responses.** Cloudflare, Fastly, and CloudFront refuse to cache a response when the request carried an `Authorization` header or the origin returned a `Set-Cookie`, unless you override the refusal. Do not override it until you can say why.

**Invalidation.** Purging is eventually consistent, and providers rate-limit it. Design so you seldom need it: hashed asset URLs, short TTLs on volatile data, and surrogate keys or cache tags for the cases where you must purge a group.

## How to roll it out safely

Default everything to `private, no-store` at the framework level. Then opt specific routes into public caching, one at a time. Default the other way and every new endpoint an engineer adds is public until a reviewer catches it. That is the same bug, delayed.

Then verify. Send an authenticated request and an anonymous one to the same URL, then compare the bodies and the cache-status headers. Stronger still: put a test in CI that fails when a route serving user data returns a `public` cache directive.

## The answer to give your teammate

Cache the public GETs aggressively. That is where nearly all the speedup lives. Mark the per-user GETs `private, no-store`, and default new routes to that until you prove them public. "Every GET" is the version of this plan that ships one user's data to another.

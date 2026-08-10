---
kind: eval-artifact
run: 6
variant: P
replicate: r5
task: T6
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

It will speed up part of the app and leak private data in the rest. The GET method does not decide cacheability. Whether a response is the *same for everyone* decides it, and a shared cache is where that distinction becomes an incident.

## The failure to picture

A CDN cache is shared across all users. Store one user's personalized response under a URL and the next request for that URL gets that body — served to somebody else.

```
alice → GET /api/me → origin → { "name": "Alice", "email": ... }
                              CDN stores it under /api/me
bob   → GET /api/me → CDN   → { "name": "Alice", "email": ... }
```

Nothing here is exotic. `/api/me`, `/dashboard`, `/cart`, `/notifications`, and every endpoint whose output depends on a session cookie or an `Authorization` header share this shape. The cache key is the URL, and the thing that made the response different was not in the URL.

This bug has caused real, public breaches at large companies. It is not theoretical.

## The split that matters

Sort your GET endpoints into three buckets. The bucket decides the policy, not the method.

**Same for everyone, changes rarely.** Static assets, product catalogs, public documentation, published articles, config blobs. Cache these hard at the CDN. All the speed lives here, and it is usually most of your bytes.

```
Cache-Control: public, max-age=31536000, immutable
```

Pair long TTLs with content-hashed filenames, so a deploy changes the URL instead of needing an invalidation.

**Same for everyone, changes often.** Live prices, vote counts, availability. Cache these briefly. Even 10 seconds collapses a traffic spike into one origin request, and `stale-while-revalidate` keeps the fast path warm while it refreshes.

```
Cache-Control: public, max-age=10, stale-while-revalidate=60
```

**Different per user.** Never in a shared cache.

```
Cache-Control: private, no-store
```

`private` lets a browser keep it and forbids a CDN from keeping it. For anything genuinely sensitive, prefer `no-store`, which forbids writing it to disk at all.

## What bites you even in the public bucket

**Vary headers.** When a response differs by `Accept-Encoding`, `Accept-Language`, or other content negotiation, say so with `Vary`. Omit it and the cache serves a German page to an English reader, or a Brotli body to a client that cannot decode it. Do not reach for `Vary: Cookie` as a safety measure on a shared cache — it works technically and destroys your hit rate, because cookie values are near-unique.

**Query parameters.** Campaign and analytics parameters (`utm_*`, `fbclid`, `gclid`) fragment the cache key, so identical content gets stored dozens of times. Configure the CDN to ignore or normalize them.

**Authenticated responses.** Most CDNs refuse to cache a response when the request carried an `Authorization` header or the response set a cookie, unless you override that. Do not override it without knowing exactly why.

**Invalidation.** Purging is eventually consistent and rate-limited at most providers. Design so you rarely purge: hashed asset URLs, short TTLs on volatile data, and surrogate keys or cache tags when you must clear a group.

## How to roll it out safely

Default every route to `private, no-store` at the framework level, then opt specific routes into public caching one at a time. Defaulting the other way makes every new endpoint public until someone notices, which is the same bug on a delay.

Then verify. Send an authenticated request and an anonymous one to the same URL, and compare the bodies and the cache-status headers. Better, add a CI test that fails when a route serving user data returns a `public` directive.

## The answer for your teammate

Cache the public GETs aggressively, because nearly all the speedup lives there. Mark per-user GETs `private, no-store`, and default new routes to that until proven public. "Every GET" is the version of this plan that ships one user's data to another.

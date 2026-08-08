---
kind: eval-artifact
run: 5
variant: A
replicate: r5
task: T6
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will speed up part of the app and leak private data in the rest of it. The GET method is not what determines cacheability. Whether a response is the *same for everyone* is what determines it, and a shared cache is exactly where that distinction turns into an incident.

## The failure mode to picture

A CDN cache is shared across all users. Store one user's personalized response under a URL, and the next request for that URL is served that same body — to a different person.

```
alice → GET /api/me → origin → { "name": "Alice", "email": ... }
                              CDN stores it under /api/me
bob   → GET /api/me → CDN   → { "name": "Alice", "email": ... }
```

Nothing here is exotic. `/api/me`, `/dashboard`, `/cart`, `/notifications`, and any endpoint whose output depends on a session cookie or an `Authorization` header all have this shape. The cache key is the URL; the thing that made the response different was not in the URL.

This class of bug has produced real, public breaches at large companies. It is not a theoretical concern.

## The split that actually matters

Sort your GET endpoints into three buckets. The bucket, not the method, decides the policy.

**Same for everyone, changes rarely.** Static assets, product catalogs, public documentation, published articles, config blobs. Cache these hard in the CDN. This is where all the speed is, and it is usually most of your bytes.

```
Cache-Control: public, max-age=31536000, immutable
```

Pair long TTLs with content-hashed filenames so a deploy changes the URL rather than needing an invalidation.

**Same for everyone, changes often.** Live prices, vote counts, availability. Cache these briefly in the CDN. Even 10 seconds collapses a traffic spike into one origin request, and `stale-while-revalidate` keeps the fast path warm during the refresh.

```
Cache-Control: public, max-age=10, stale-while-revalidate=60
```

**Different per user.** Never in a shared cache.

```
Cache-Control: private, no-store
```

`private` means a browser may keep it but a CDN may not. For anything genuinely sensitive, `no-store` is the safer choice, because it forbids writing it to disk at all.

## Things that will bite you even in the "public" bucket

**Vary headers.** If a response differs by `Accept-Encoding`, `Accept-Language`, or content negotiation, say so with `Vary`. Omit it and the cache serves a German page to an English reader, or a Brotli body to a client that cannot decode it. Never `Vary: Cookie` on a shared cache as a safety measure — it technically works and it destroys your hit rate, since cookie values are near-unique.

**Query parameters.** Analytics and campaign parameters (`utm_*`, `fbclid`, `gclid`) fragment the cache key so that identical content is stored dozens of times. Configure the CDN to ignore or normalize them.

**Authenticated responses.** Most CDNs refuse to cache a response when the request carried an `Authorization` header or a `Set-Cookie` came back, unless you override it. Do not override it without knowing precisely why.

**Invalidation.** Purging is eventually consistent and rate-limited on most providers. Design so you rarely need it: hashed asset URLs, short TTLs on volatile data, and surrogate keys or cache tags for the cases where you must purge a group.

## How to roll it out safely

Default everything to `private, no-store` at the framework level, then opt specific routes into public caching one at a time. Defaulting the other way means every new endpoint an engineer adds is public until someone notices — which is the same bug, just delayed.

Then verify. Send an authenticated request and an anonymous one to the same URL and compare bodies and cache-status headers. Better, put a test in CI that fails when any route serving user data returns a `public` cache directive.

## The answer to give your teammate

Cache the public GETs aggressively — that is where nearly all the speedup lives. Mark the per-user GETs `private, no-store`, and default new routes to that until proven public. "Every GET" is the version of this plan that ships one user's data to another.

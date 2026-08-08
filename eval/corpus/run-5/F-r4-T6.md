---
kind: eval-artifact
run: 5
variant: F
replicate: r4
task: T6
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
## Will caching every GET in a shared CDN cache work?

No. It will speed up some endpoints and leak user data on the others. A shared cache stores one copy of a response and serves it to everyone who asks for that URL. If a response depends on who is asking, the first user's data goes to the next user.

The plan is right about the goal and wrong about the scope. Cache the responses that are the same for everybody. Leave the rest alone.

## Why is "it's a GET" not enough?

`GET` means the request does not change anything on the server. It says nothing about whether the *response* is the same for every caller.

Three kinds of GET are unsafe in a shared cache.

**Per-user responses.** `GET /api/me`, `GET /api/cart`, `GET /api/notifications` return different bytes per user, and the URL does not say which user. The cache keys on the URL, so user B gets user A's cart.

**Responses that depend on a header.** Anything that varies by `Authorization`, `Cookie`, `Accept-Language`, or a role claim has the same problem. The varying input is invisible to a cache that keys on the URL alone.

**Responses that must be fresh.** Inventory counts, prices during a sale, a job's status, a feature flag. Serving these a few minutes stale is a correctness bug, not a performance win.

A shared cache is one that many users read from — a CDN edge, a reverse proxy. This is the opposite of a private cache, which lives in one user's browser and can safely hold that user's data.

## Which endpoints are actually safe?

Ask one question of each: would every caller in the world get the same bytes right now? If yes, cache it.

That usually covers static assets, public product pages, published articles, public API listings, and config that changes on deploy. These are the endpoints where CDN caching pays off most anyway, because they are also the ones with the most traffic.

## How do I say this to the CDN?

Set `Cache-Control` per endpoint, and make the default private.

For public, cacheable responses:

```
Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=600
```

`max-age` is how long a browser may reuse it, in seconds. `s-maxage` overrides that for shared caches only, so you can let the CDN hold it longer than the browser. `stale-while-revalidate` lets the CDN serve the old copy while it fetches a new one in the background, which removes the latency spike when an entry expires.

For anything user-specific:

```
Cache-Control: private, no-store
```

`private` bars shared caches and allows the browser. `no-store` bars both, and is the right choice for anything you would not want written to disk.

If a response varies by a header and you still want it cached, name the header:

```
Vary: Accept-Language
```

The cache then keeps a separate copy per value. Use this sparingly — each varying header multiplies the number of stored copies and cuts your hit rate. Never `Vary: Authorization` as a way to cache per-user data; it works in theory and one misconfigured edge turns it into a data leak.

## How should we roll it out?

Start with the endpoints that carry the most traffic and the least personalization, and expand from there.

List your GET endpoints and mark each one public, private, or must-be-fresh. Set the default to private, so a new endpoint is safe until somebody thinks about it.

Turn on caching for the public set behind a flag, watch the cache hit rate and the error rate, then widen.

Build the invalidation path before you need it. Decide how a changed product page gets a new copy at the edge — a purge call on publish, or a version in the URL so the new content is a new key. Versioned URLs are more reliable, because they never depend on a purge landing everywhere.

Verify by request, not by intent. Fetch a user-specific endpoint as two different users through the CDN and confirm the bodies differ and the responses report a cache miss. That test catches the leak before your users do.

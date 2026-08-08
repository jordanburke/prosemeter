---
kind: eval-artifact
run: 5
variant: E
replicate: r1
task: T6
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Caching every GET in a shared CDN will speed some things up and leak other users' data. `GET` means "no side effects." It does not mean "same answer for everyone." Any endpoint whose response depends on who is asking must not go in a shared cache, or one user's response gets served to the next.

## The failure that matters

Picture `GET /api/me`. It returns the caller's name and email, keyed off a session cookie. The CDN stores the first response under the URL. The next request for that URL — from a different user, on a different continent — gets the first user's record.

This is not theoretical. It has taken down real sites, and it is hard to spot in testing because it needs two different users hitting the same edge node.

The same trap sits under `GET /api/cart`, `GET /api/notifications`, `GET /api/orders`, and any endpoint that branches on a role or a feature flag.

## The line to draw

Sort your GETs into two buckets.

**Safe to share.** The response depends only on the URL. Product catalog, public blog posts, static config, images, JS bundles. Cache these hard and long.

**Not safe to share.** The response depends on a cookie, an `Authorization` header, a tenant, or a role. Never let a shared cache hold these.

The mechanism is the `Cache-Control` header, set per response:

```
# public content
Cache-Control: public, max-age=300, s-maxage=3600

# per-user content
Cache-Control: private, no-store
```

`private` tells the CDN to skip it and lets the browser keep it. `no-store` means nobody keeps it. Use `no-store` for anything genuinely sensitive.

Set the default to `private, no-store` and opt endpoints into `public` one at a time. Getting that direction backwards is how the leak happens — a new endpoint ships, nobody edits the cache config, and it inherits "cache everything."

## Vary is not the escape hatch

Someone will suggest `Vary: Authorization` or `Vary: Cookie` to make per-user caching safe. Two reasons that disappoints:

- **It barely caches.** Every distinct cookie value is a separate cache entry. With session cookies that means one entry per user, and the hit rate collapses to roughly zero while you pay full storage.
- **CDNs handle it inconsistently.** Some ignore `Vary: Cookie` outright. Some normalize headers before the check. You are relying on behavior that differs per vendor and can change under you.

Where per-user caching is genuinely worth it, use a cache key you control explicitly — a CDN worker that adds the user ID to the key — rather than `Vary`. And know you are now responsible for correctness on every auth change.

## The rest of the problems

Even for cacheable endpoints, three things bite.

**Invalidation.** A price changes; the CDN serves the old one for the next hour. Decide up front how staleness gets fixed: short TTLs, purge on write, or versioned URLs. `stale-while-revalidate` covers the common case well — serve the stale copy instantly, refresh in the background.

**Errors get cached.** A 500 or a 404 from a brief backend blip can be stored and served for the whole TTL. Set an explicit short TTL for error statuses.

**Query strings multiply keys.** `?utm_source=...` creates a distinct entry for identical content. Strip tracking parameters from the cache key.

## What to do instead

Do this in three steps:

1. **List the GET endpoints and mark each one shared or per-user.** That list is the actual work; the config follows from it.
2. **Set `private, no-store` as the default** at the framework or gateway level, so new endpoints are safe by accident rather than dangerous by accident.
3. **Cache the public list aggressively,** with a purge path and short error TTLs.

Then check whether the CDN is even the bottleneck. If the slow part is authenticated API calls, the CDN cannot help, and the real fix is a query index, an application cache, or fewer round trips. A blanket CDN policy trades a real security hole for a speedup you may not get.

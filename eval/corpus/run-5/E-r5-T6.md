---
kind: eval-artifact
run: 5
variant: E
replicate: r5
task: T6
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
No. Caching every GET in a shared cache will leak one user's data to another user. The method tells you the request is safe to repeat, not that the response is safe to share.

## The failure that matters

A shared CDN cache stores one response per URL and serves it to everyone who asks for that URL. `GET /api/me` returns Alice's profile, the CDN stores it, and the next request for `/api/me` — from Bob — gets Alice's data.

Every personalized endpoint has this shape. Profile, cart, notifications, permissions, anything scoped by session cookie or bearer token. The URL is identical across users and the response is not.

This is not a rare edge case. It is the default outcome, and it is a data breach.

## Why "GET is safe to cache" is not the rule

GET is *safe*, meaning it does not change server state. That makes it repeatable. Cacheability is a separate question with a separate answer.

A response is cacheable in a shared cache only when all of these hold.

- The response is the same for every caller, or every input that varies it is in the cache key.
- The data can be stale for the cache lifetime without harm.
- The response carries no per-user or per-tenant content.

Most GET endpoints in an app fail the first and third.

## What is actually safe to cache

Cache what is public and identical for everyone.

- Static assets with content hashes in the filename. Cache these forever.
- Public reference data: country lists, product catalogs, published articles, pricing pages.
- Public API responses with no auth header.

Set these explicitly.

```
Cache-Control: public, max-age=300, s-maxage=3600
```

## What to do with everything else

Mark it, do not just omit the header. A CDN with a default TTL will cache what you did not label.

```
Cache-Control: private, no-store
```

`private` means a browser may cache it but a shared cache may not. `no-store` means nobody caches it. Use `no-store` for anything sensitive.

## If you want the speed anyway

There are safer ways to get most of the win.

**Vary the cache key.** `Vary: Authorization` splits the cache per credential. It works, but hit rates collapse because every user gets their own entry. It is a correctness fix, not a performance one.

**Split the endpoints.** Serve the public shell from a cacheable URL and fetch the personalized part separately. The expensive, shared query gets cached; the cheap personal one does not.

**Cache at the origin instead.** Redis in front of the slow query gives you the speedup with a key you control, and no risk of serving the wrong tenant.

**Use short TTLs plus revalidation.** `stale-while-revalidate` keeps responses fresh without a stampede on expiry.

## Before rolling anything out

Ask for a list of endpoints and their responses for two different users. Anything that differs cannot go in a shared cache. That review takes an hour and is much cheaper than an incident.

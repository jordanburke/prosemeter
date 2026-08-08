---
kind: eval-artifact
run: 2
variant: E
replicate: r5
task: T6
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Caching *some* GETs in a shared cache will speed the app up. Caching *every* GET will leak one user's data to another.

The danger is the word "shared". A shared cache stores one copy of a response and serves it to everyone who asks for that URL. So the moment a GET returns anything specific to the caller — `/api/me`, `/api/cart`, `/api/orders`, an admin list filtered by permission — the first user's response becomes every user's response. This is a real class of incident, not a theoretical one, and it usually surfaces as a support ticket saying "I'm logged in as someone else."

GET means safe, not cacheable. Those are different properties. Safe means the request does not change server state. Cacheable means the response is the same for everyone who could ask for it.

So split your endpoints by who the response belongs to.

**Public and identical for all callers** — product catalog, published content, config, static reference data. Cache these in the CDN, and set a long TTL:

```
Cache-Control: public, max-age=300, s-maxage=3600
```

**Specific to one user** — anything behind auth that varies by identity. Keep these out of the shared cache:

```
Cache-Control: private, no-store
```

`private` alone tells the CDN not to store it while still allowing the browser to. That is usually what you want for user data that is cheap to refetch.

Two things to check before you turn any of this on.

**Whatever varies the response must be in the cache key.** If a response depends on a header — `Accept-Language`, `Authorization`, an API version — the CDN needs `Vary` on that header, or it will serve the wrong variant. `Vary: Authorization` technically works but gives you a cache-per-user, which buys nothing.

**Decide how you invalidate.** A five-minute TTL means five minutes of stale data after every write. If that is not acceptable, you need purge-on-write, and that is a piece of work worth scoping before committing to the approach.

My suggestion: start with a handful of clearly public, clearly hot endpoints. Measure the hit rate. Expand from there. A default-cache-everything policy with an exception list will eventually miss an exception, and that failure is a data breach rather than a slow page.

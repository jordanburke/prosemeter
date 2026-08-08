---
kind: eval-artifact
run: 5
variant: A
replicate: r3
task: T6
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will speed the app up and it will leak private data between users. Caching *every* GET in a *shared* cache is the specific combination that causes the worst incident of the year.

## The problem in one sentence

A shared CDN cache stores one copy of a response and serves it to everyone who asks for the same URL. Many GET endpoints return responses that depend on who is asking.

`GET /api/me` is a GET. It returns a different body per user, keyed by a cookie or bearer token, not by the URL. Cache it in a shared cache and the first user's profile gets served to every user who hits that path until it expires. Same for `/api/cart`, `/api/notifications`, `/api/orders`, anything under an account.

This is not theoretical. It is a recurring class of public postmortem, and it is usually found by a customer seeing someone else's name in the header.

## Why "GET is safe to cache" is only half the rule

GET means *safe* — the request does not change server state. That is a different property from *cacheable in a shared cache*, which requires the response to be the same for every requester.

HTTP has the distinction built in:

- `Cache-Control: public` — any cache may store it, including a shared one.
- `Cache-Control: private` — only the end user's browser may store it. Shared caches must not.
- `Cache-Control: no-store` — nobody stores it.

The default when you say nothing is ambiguous and varies by CDN, which is exactly why the blanket policy is dangerous. Silence is not a safe default.

## What to do instead

Classify the endpoints, then cache the ones that qualify.

**Cache in the shared cache** — responses identical for all callers, tolerant of being slightly stale:

- Static assets with hashed filenames. Long TTL, `immutable`.
- Public reference data: product catalog, pricing tiers, country lists, published articles.
- Anonymous marketing and landing pages.

**Do not put in the shared cache** — anything varying by identity:

```
Cache-Control: private, no-store
```

Use `private` when the browser holding a copy is fine, `no-store` when it is not — anything with a token, a payment detail, or a health record.

**The hard middle: personalized but expensive.** Do not solve it with `Vary: Authorization`. It technically works and it is a footgun — every distinct token becomes a separate cache entry, so your hit rate goes to nearly zero and you have paid the risk for no gain. Cache these at a layer that understands identity instead: a Redis cache keyed by user id, or the browser's private cache.

## The other things that break

Even for genuinely public endpoints, the blanket approach hits problems worth knowing about.

**Query parameters.** Most CDNs key on the full URL including the query string. `?utm_source=twitter` creates a separate entry for the same content, shredding your hit rate. Configure which parameters are part of the cache key and ignore the rest. The inverse is worse: if you strip a parameter that *does* change the response, you serve the wrong page.

**Invalidation.** A cached response is stale the moment the underlying data changes. You need a story for that before you turn caching on — purge on write, or short TTLs, or content-hashed URLs so the URL changes when the content does. "We will figure out invalidation later" means "we will serve wrong prices later."

**Error responses.** A 500 cached for an hour turns a thirty-second blip into an hour-long outage. Make sure error statuses are excluded.

**Auth-dependent redirects.** An endpoint that 302s anonymous users to login and 200s logged-in users will cache whichever it saw first, and the other half of your traffic gets the wrong one.

## The counter-proposal

Say yes to the goal and no to the mechanism. Pick the top few public, expensive, read-heavy endpoints — usually a catalog or search or a homepage feed — and cache those explicitly with a TTL and a purge hook. That captures most of the available speedup at close to zero risk.

Then set the safe default the other way round: `Cache-Control: private, no-store` everywhere unless an endpoint has opted in. Put a test in CI that fails if a route under `/api` returns a `public` cache header without an explicit annotation. Opt-in caching is the only version of this that stays safe as the codebase grows.

---
kind: eval-artifact
run: 6
variant: P
replicate: r3
task: T6
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

It will speed the app up, and it will leak private data between users. Caching *every* GET in a *shared* cache is the exact combination that produces the worst incident of the year.

## The problem in one sentence

A shared CDN cache stores one copy of a response and serves it to everyone who asks for that URL. Many GET endpoints return a response that depends on who is asking.

`GET /api/me` is a GET. It returns a different body per user, keyed by a cookie or bearer token, not by the URL. Cache it in a shared cache and the first user's profile goes to every user who hits that path until it expires. Same for `/api/cart`, `/api/notifications`, `/api/orders`, anything under an account.

This is not theoretical. It is a recurring class of public postmortem, and it usually gets found by a customer seeing someone else's name in the header.

## Why "GET is safe to cache" is half a rule

GET means *safe*: the request does not change server state. That is a different property from *cacheable in a shared cache*, which needs the response to be the same for every requester.

HTTP has the distinction built in:

- `Cache-Control: public` — any cache may store it, shared ones included.
- `Cache-Control: private` — only the end user's browser may store it. Shared caches must not.
- `Cache-Control: no-store` — nobody stores it.

Say nothing and the default is ambiguous and varies by CDN, which is exactly why a blanket policy is dangerous. Silence is not a safe default.

## What to do instead

Classify the endpoints, then cache the ones that qualify.

**Cache in the shared cache** — responses identical for all callers and fine when slightly stale:

- Static assets with hashed filenames. Long TTL, `immutable`.
- Public reference data: product catalog, pricing tiers, country lists, published articles.
- Anonymous marketing and landing pages.

**Keep out of the shared cache** — anything that varies by identity:

```
Cache-Control: private, no-store
```

Use `private` when a copy in the browser is fine. Use `no-store` when it is not — anything holding a token, a payment detail, or a health record.

**The hard middle: personalized but expensive.** Do not solve it with `Vary: Authorization`. It technically works and it is a footgun, because every distinct token becomes its own cache entry. Your hit rate drops to nearly zero and you have taken the risk for no gain. Cache these at a layer that understands identity instead: a Redis cache keyed by user id, or the browser's private cache.

## The other things that break

Even for genuinely public endpoints, the blanket approach runs into problems worth knowing.

**Query parameters.** Most CDNs key on the full URL, query string included. `?utm_source=twitter` creates a separate entry for the same content and shreds your hit rate. Configure which parameters belong in the cache key and ignore the rest. The inverse is worse: strip a parameter that *does* change the response and you serve the wrong page.

**Invalidation.** A cached response goes stale the moment the underlying data changes. You need a story for that before you turn caching on — purge on write, or short TTLs, or content-hashed URLs so the URL changes when the content does. "We will figure out invalidation later" means "we will serve wrong prices later."

**Error responses.** A 500 cached for an hour turns a thirty-second blip into an hour-long outage. Exclude error statuses.

**Auth-dependent redirects.** An endpoint that 302s anonymous users to login and 200s logged-in users caches whichever it saw first, and half your traffic gets the wrong one.

## The counter-proposal

Say yes to the goal and no to the mechanism. Pick the few public, expensive, read-heavy endpoints — usually a catalog, a search, or a homepage feed — and cache those explicitly, each with a TTL and a purge hook. That captures most of the available speedup at close to zero risk.

Then set the default the other way round: `Cache-Control: private, no-store` everywhere unless an endpoint opts in. Add a CI test that fails when a route under `/api` returns a `public` cache header without an explicit annotation. Opt-in caching is the only version of this that stays safe as the codebase grows.

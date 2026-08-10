---
kind: eval-artifact
run: 6
variant: R
replicate: r3
task: T6
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

It will speed the app up. It will also leak private data between users. Caching *every* GET in a *shared* cache is the combination that produces the worst incident of the year.

## The problem in one sentence

A shared CDN cache stores one copy of a response and serves it to everyone who asks for that URL. Plenty of GET endpoints return a body that depends on who is asking.

`GET /api/me` is a GET. It returns a different body per user, keyed by a cookie or a bearer token, not by the URL. Cache it in a shared cache and the first user's profile goes to every user who hits that path until it expires. The same holds for `/api/cart`, `/api/notifications`, `/api/orders`, and anything under an account.

This is not theoretical. It is a recurring class of public postmortem, and the finder is usually a customer who sees another person's name in the header.

## Why "GET is safe to cache" is half a rule

GET means *safe* — the request does not change server state. Being cacheable in a shared cache is a different property. It requires the response to be identical for every requester.

HTTP has the distinction built in:

- `Cache-Control: public` — any cache can store it, a shared one included.
- `Cache-Control: private` — only the end user's browser stores it. Shared caches must not.
- `Cache-Control: no-store` — nobody stores it.

Say nothing and the default varies by CDN. That ambiguity is what makes the blanket policy dangerous. Silence is not a safe default.

## What to do instead

Classify the endpoints, then cache the ones that qualify.

**Cache in the shared cache** — responses identical for all callers and tolerant of being a few minutes stale:

- Static assets with hashed filenames. Long TTL, `immutable`.
- Public reference data: product catalog, pricing tiers, country lists, published articles.
- Anonymous marketing and landing pages.

**Keep out of the shared cache** — anything that varies by identity:

```
Cache-Control: private, no-store
```

Use `private` when a browser-held copy is fine. Use `no-store` when it is not — for anything carrying a token, a payment detail, or a health record.

**The hard middle: personalized but expensive.** Do not reach for `Vary: Authorization`. It works technically and it is a footgun. Every distinct token becomes its own cache entry, so your hit rate falls to near zero and you have taken the risk for no gain. Cache these at a layer that understands identity: a Redis cache keyed by user id, or the browser's private cache.

## The other failures

Even for genuinely public endpoints, the blanket approach runs into four problems worth knowing.

**Query strings.** Nearly every CDN keys on the full URL, query string included. `?utm_source=twitter` creates a separate entry for identical content and shreds your hit rate. Configure which query keys belong in the cache key and ignore the rest. The inverse is worse: strip a key that *does* change the response, and you serve the wrong page.

**Invalidation.** A cached response goes stale the moment the underlying data changes. You need a story for that before caching goes on. Purge on write, or use short TTLs, or use content-hashed URLs so the URL changes when the content does. "We will figure out invalidation later" means "we will serve wrong prices later."

**Error responses.** A 500 cached for an hour turns a thirty-second blip into an hour-long outage. Exclude error statuses.

**Auth-dependent redirects.** An endpoint that 302s anonymous users to login and 200s logged-in users caches whichever it saw first. The other half of your traffic then gets the wrong one.

## The counter-proposal

Say yes to the goal and no to the mechanism. Pick the three public, expensive, read-heavy endpoints — a catalog, a search, a homepage feed — and cache those explicitly, each with a TTL and a purge hook. That captures the bulk of the available speedup at close to zero risk.

Then set the safe default the other way round: `Cache-Control: private, no-store` everywhere unless an endpoint opts in. Put a test in CI that fails when a route under `/api` returns a `public` cache header without an explicit annotation. Opt-in caching is the only version that stays safe as the codebase grows.

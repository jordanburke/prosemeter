---
kind: eval-artifact
run: 6
variant: P
replicate: r4
task: T6
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

It will speed things up and it will leak user data. GET means "does not change anything," not "safe to show everyone." A shared cache serves one user's stored response to the next person who asks for the same URL.

## The failure, concretely

Alice requests `GET /api/account`. The CDN has no copy, forwards to origin, and stores the response — Alice's email, her plan, her billing address. Bob requests `GET /api/account` a minute later. Same URL, cache hit, and the CDN hands Bob Alice's account.

The authentication was real. Alice's token was checked at origin. But the cache key was the URL, and the URL was identical. The cache never looks at the `Authorization` header unless you tell it to.

This is not hypothetical. It is one of the most common serious production incidents in web infrastructure, and it usually ships as "we turned caching on."

## Why the cache is not to blame

HTTP has always separated two things that "cacheable" runs together.

- `Cache-Control: public` — any cache may store this, including shared ones.
- `Cache-Control: private` — only the end user's own browser may store it.

A shared CDN cache is the `public` case. Every response that varies by user is `private`, or `no-store` if it should not be written down at all.

Your teammate's plan marks everything `public`. That is the whole bug in one sentence.

## The sort that is safe

Cache a GET response in a shared cache when the response is identical for every requester:

- Static assets — JS, CSS, images, fonts. Fingerprint the filename and cache for a year.
- Public content — marketing pages, published articles, docs.
- Reference data — country lists, product catalogs, public pricing, feature flags that are not per-user.
- Anonymous API responses that take no credentials at all.

That set is often most of your bytes, which is why CDN caching is worth doing. It is rarely most of your endpoints.

## The sort that is not

- Anything behind a login that reflects the caller.
- Anything with a `Set-Cookie` in the response. Caching that hands the next visitor someone's session.
- Anything that answers an `Authorization` header or session cookie with user-specific content.
- Anything personalized by locale, currency, or A/B bucket, unless that dimension is in the cache key.

## If you must cache per-user responses

Two options, and neither is free.

**Put the varying input in the cache key.** `Vary: Authorization` tells the cache to keep a separate entry per credential. It works, and it destroys your hit rate. A unique key per user means every user's first request is a miss, and you now store one copy per user. You have bought origin protection for repeat requests only.

**Cache at the edge with a key you compute.** Cloudflare Workers, Fastly Compute, and Lambda@Edge let you build the cache key yourself — user id plus path, say — after validating the token. This is real and used in production, but it is a deliberate design, not a checkbox.

`Vary` in general is a footgun. `Vary: Cookie` splits the cache on the entire cookie string, and one analytics cookie with a random value makes every request unique. You get a cache that stores everything and hits nothing.

## Invalidation, the second problem

Even for genuinely public content, a shared cache means you no longer control when users see a change. You publish a fix, and every edge holding the old copy serves it for the full TTL.

Plan for that before you turn caching on:

- **Fingerprint immutable assets.** `app.a1b2c3.js` with a one-year TTL and `immutable`. A deploy changes the filename, so there is nothing to invalidate.
- **Use short TTLs plus revalidation for HTML.** `s-maxage=60, stale-while-revalidate=600` gives a fresh-enough page and lets the cache serve the old copy while it fetches a new one behind it.
- **Have a purge path, and test it.** Every CDN has a purge API. Find out before an incident whether yours purges in seconds or minutes, and whether it reaches all edges.

## What to actually do

Default everything to `Cache-Control: private, no-store`, then opt specific routes into `public` caching as you verify each one is user-independent. Opt in, never opt out. An endpoint that becomes personalized later then fails closed rather than leaking.

Then check three things:

1. Grep for any response that sets a cookie, and confirm none of those routes are cached.
2. Send two requests with different credentials to each cached route and diff the bodies.
3. Watch hit rate per route after rollout. A route with a suspiciously high hit rate that should be personalized is a leak in progress.

## The version worth proposing back

"Let's cache static assets aggressively and public pages with a short TTL, keep everything authenticated at `private, no-store`, and measure the hit rate before we widen it."

That gets most of the speed your teammate is after, and none of the incident.

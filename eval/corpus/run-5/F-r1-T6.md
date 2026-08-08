---
kind: eval-artifact
run: 5
variant: F
replicate: r1
task: T6
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will work for some endpoints and leak private data on others. GET does not mean public. A shared CDN cache stores one copy per URL and hands it to everyone, so any endpoint whose response depends on who is asking will serve one user's data to the next. Cache the endpoints that are the same for everyone, and mark the rest explicitly.

## What goes wrong?

A **shared cache** is one the CDN operates on behalf of all users, as opposed to a private cache in a single browser. It keys entries by URL, plus whatever headers you tell it to vary on.

`GET /api/me` returns a different body for every logged-in user at the identical URL. The CDN caches the first response it sees and serves it to the next thousand people. That is not slow — that is an account-data breach.

The same shape hides in less obvious places: `/api/cart`, `/api/notifications`, `/api/orders`, any list filtered by permission, any response with a personalized price or a feature flag. Anything that reads the session cookie or an `Authorization` header and changes the body is unsafe in a shared cache.

Three more failure modes beyond the leak:

**Stale data.** A cached response outlives the change behind it. A user edits something, gets redirected, and sees the old version. Whatever time-to-live you set — meaning how long the CDN keeps serving a stored copy — is how long users can see the past.

**Cached errors.** A 500 or a 404 during a deploy can get stored and served long after the service recovered.

**Cache poisoning.** If the response varies on an input the cache key ignores, an attacker can plant a response for everyone. Unkeyed headers and query parameters are the usual way in.

## Which GETs are actually safe to cache?

Cache a response in a shared cache when it satisfies all three:

- The body is identical for every caller, logged in or not.
- It does not read a cookie, an `Authorization` header, or anything else identifying.
- Serving it a few seconds or minutes stale is acceptable.

That set is usually larger than people expect: static assets, product catalogs, public content, search over public data, config and feature-flag manifests, geographic and reference data. Those are also often your highest-traffic endpoints, so the win is real.

## How do I set this up safely?

**Default to no shared caching, then opt in.** Set `Cache-Control: private, no-store` as the framework-wide default for API responses, and override it per route. A leak then requires someone to add a header, not to forget one. The opposite default — cache everything, exclude the private ones — fails the first time someone adds a route.

**Use the right directives.**

- Public and cacheable: `Cache-Control: public, max-age=60, s-maxage=300`. `s-maxage` applies to shared caches only, so you can keep browsers short and the CDN long.
- Per-user: `Cache-Control: private, no-store`. `private` permits the browser to cache it and forbids the CDN.
- Add `stale-while-revalidate=60` to public entries so users get an instant stored copy while the CDN refreshes behind them.

**Make identity part of the cache key, or keep it out entirely.** `Vary: Authorization` tells the CDN to store a separate entry per token, which is correct but nearly useless — hit rates collapse. Prefer splitting the route: a public endpoint that anyone can cache, and a separate authenticated one that nobody caches.

**Set the origin as the authority.** Configure the CDN to honor origin `Cache-Control` headers rather than applying its own blanket TTL. A CDN-level "cache all GETs" rule overrides your careful per-route headers and reintroduces the leak.

**Have a way to purge.** Tag responses by resource and purge by tag on write. Without that, your only tool for a bad cached response is waiting.

**Test the leak directly.** Add a test that requests a private endpoint as user A, then as user B, through the CDN, and fails if the bodies match. Run it in CI. That one test catches the whole class of mistake.

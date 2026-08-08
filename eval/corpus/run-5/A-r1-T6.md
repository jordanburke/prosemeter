---
kind: eval-artifact
run: 5
variant: A
replicate: r1
task: T6
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will speed the app up and it will leak users' data to each other. "Every GET" is the part that breaks it, because GET does not mean public and a shared cache does not know the difference.

## The failure that matters

A shared CDN cache stores one copy of a response per URL and serves it to everyone who asks for that URL. If `/api/me` returns Alice's profile and the CDN caches it, Bob gets Alice's profile. So does everyone else until the entry expires.

That is the whole risk in one sentence, and it applies to more endpoints than people expect: `/api/cart`, `/api/notifications`, `/api/orders`, anything scoped to a session cookie or an `Authorization` header. None of them are visibly personal from the URL alone, which is exactly why a blanket rule catches them.

The related failure is authorization drift. `/api/documents/42` may be readable by Alice and forbidden to Bob. A cache keyed only on the path cannot represent that; it will serve the cached 200 to Bob and skip your permission check entirely.

## Why GET is not the right test

`GET` promises the request does not change server state. It says nothing about whether the response is the same for everyone, or whether it is safe to store. Those are different properties, and HTTP has a different mechanism for each.

The mechanism is `Cache-Control`, and the distinction you need is:

- `public` — any cache, including shared ones, may store this.
- `private` — only the user's own browser may store it. Shared caches must not.
- `no-store` — nobody stores it.

A correctly built API sets `private` or `no-store` on personalized responses. If your app already does that, most CDNs will respect it and the blanket rule is less dangerous than it sounds. If your app does not set these headers — and many do not, relying on the fact that nothing was caching them — then turning on a CDN changes the security properties of the app overnight.

Check what your endpoints currently send before doing anything else.

## Other things that break

**Freshness.** A cached response is stale from the moment the underlying data changes. If a user updates their settings and the next GET serves a five-minute-old copy, the app looks broken. Read-after-write is where users notice caching first.

**Cache key mismatch.** The default key is roughly method plus host plus path plus query. Responses that vary by header — `Accept-Language`, `Accept-Encoding`, an API version, a feature flag, a currency — need `Vary` set correctly, or one variant gets served to everyone. `Vary: Cookie` technically fixes personalization but makes the hit rate near zero, since every session has a distinct cookie. That is a sign the response should not be in a shared cache at all.

**Query-string explosion.** Analytics parameters like `utm_source` create a new cache key per variant, so you cache thousands of copies of the same response and hit almost none of them. You need a normalization rule that ignores parameters that do not affect the body.

**Errors get cached.** A 500 or a 404 served during an incident can be cached and outlive the incident. Set explicit short TTLs or `no-store` on error responses.

## What to do instead

Classify endpoints rather than applying one rule. Three buckets covers most APIs.

**Public and identical for everyone** — product catalogs, published content, config, reference data. Cache these in the CDN with a real TTL. This is where nearly all the performance win lives, and it is usually a small number of endpoints carrying a large share of traffic.

```
Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=600
```

`s-maxage` sets the shared-cache lifetime separately from the browser's, which lets you keep the CDN copy longer than the browser copy.

**Per-user** — anything behind auth. `Cache-Control: private, max-age=0, must-revalidate`, or `no-store` if it is sensitive. Let the browser cache it if that helps; keep it out of the shared tier.

**Never cacheable** — anything with a token, a one-time link, or payment data. `no-store`.

Then make invalidation explicit. TTL alone means every change waits out the clock. Two options work well: purge by surrogate key or tag when the underlying data changes, which most CDNs support; or version the URL so a change produces a new key and the old one simply ages out.

## The recommendation

Do not apply it to every GET. Pick the handful of genuinely public, high-traffic endpoints, set explicit `Cache-Control` on them, and set `private` or `no-store` as the default everywhere else so a new endpoint is safe by accident rather than exposed by accident. Verify with two different logged-in accounts hitting the same URL and confirming they get different bodies, and watch the CDN's hit-rate and age headers to see whether the caching is doing anything at all.

You will get most of the speedup from a small, deliberate list, and none of the incident.

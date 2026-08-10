---
kind: eval-artifact
run: 6
variant: P
replicate: r1
task: T6
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

It will speed the app up, and it will leak users' data to each other. "Every GET" is the part that breaks it, because GET does not mean public and a shared cache cannot tell the difference.

## The failure that matters

A shared CDN cache stores one copy of a response per URL and serves it to everyone who asks. If `/api/me` returns Alice's profile and the CDN caches it, Bob gets Alice's profile. So does everyone else, until the entry expires.

That is the whole risk, and it reaches more endpoints than people expect: `/api/cart`, `/api/notifications`, `/api/orders`, anything scoped to a session cookie or an `Authorization` header. None of them look personal from the URL alone, which is exactly why a blanket rule sweeps them in.

The related failure is authorization drift. `/api/documents/42` may be readable by Alice and forbidden to Bob. A cache keyed on the path cannot represent that. It serves the cached 200 to Bob and skips your permission check.

## Why GET is not the right test

`GET` promises the request does not change server state. It says nothing about whether the response is the same for everyone, or whether storing it is safe. Those are three different properties, and HTTP has a separate mechanism for the last two.

That mechanism is `Cache-Control`:

- `public` — any cache, including shared ones, may store this.
- `private` — only the user's own browser may store it. Shared caches must not.
- `no-store` — nobody stores it.

A correctly built API sets `private` or `no-store` on personalized responses. If yours already does, most CDNs respect it and the blanket rule is less dangerous than it sounds. If yours does not — and many do not, because nothing was caching them — then turning on a CDN changes the security properties of the app overnight.

Check what your endpoints send today before doing anything else.

## Other things that break

**Freshness.** A cached response goes stale the moment the underlying data changes. If a user updates their settings and the next GET serves a five-minute-old copy, the app looks broken. Read-after-write is where users notice caching first.

**Cache key mismatch.** The default key is roughly method plus host plus path plus query. Responses that vary by header — `Accept-Language`, `Accept-Encoding`, an API version, a feature flag, a currency — need `Vary` set correctly, or one variant reaches everyone. `Vary: Cookie` technically fixes personalization, but it drives the hit rate to near zero because every session has a distinct cookie. That is a sign the response does not belong in a shared cache at all.

**Query-string explosion.** Analytics parameters such as `utm_source` create a new key per variant, so you store thousands of copies of one response and hit almost none of them. You need a normalization rule that drops parameters that do not affect the body.

**Cached errors.** A 500 or a 404 served during an incident can be cached and outlive the incident. Set a short explicit TTL, or `no-store`, on error responses.

## What to do instead

Classify endpoints rather than applying one rule. Three buckets cover most APIs.

**Public and identical for everyone** — product catalogs, published content, config, reference data. Cache these in the CDN with a real TTL. Nearly all the performance win lives here, usually in a small number of endpoints carrying a large share of traffic.

```
Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=600
```

`s-maxage` sets the shared-cache lifetime separately from the browser's, so you can keep the CDN copy longer than the browser copy.

**Per-user** — anything behind auth. `Cache-Control: private, max-age=0, must-revalidate`, or `no-store` if it is sensitive. Let the browser cache it if that helps; keep it out of the shared tier.

**Never cacheable** — anything carrying a token, a one-time link, or payment data. `no-store`.

Then make invalidation explicit. TTL alone means every change waits out the clock. Two approaches work: purge by surrogate key or tag when the underlying data changes, which most CDNs support; or version the URL, so a change produces a new key and the old one ages out.

## The recommendation

Do not apply it to every GET. Pick the handful of genuinely public, high-traffic endpoints, set explicit `Cache-Control` on them, and default everywhere else to `private` or `no-store`, so a new endpoint is safe by accident rather than exposed by accident. Verify by hitting the same URL from two logged-in accounts and confirming the bodies differ, then watch the CDN's hit-rate and age headers to see whether the caching does anything at all.

You get most of the speedup from a small, deliberate list, and none of the incident.

---
kind: eval-artifact
run: 6
variant: R
replicate: r1
task: T6
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

It will speed the app up, and it will leak users' data to each other. "Every GET" is the part that breaks it. GET does not mean public, and a shared cache does not know the difference.

## The failure that matters

A shared CDN cache stores one copy of a response per URL. It serves that copy to everyone who asks for the URL. If `/api/me` returns Alice's profile and the CDN stores it, Bob gets Alice's profile. So does everyone else, until the entry expires.

That is the whole risk in one sentence. It applies to more endpoints than people expect: `/api/cart`, `/api/notifications`, `/api/orders`, anything scoped to a session cookie or an `Authorization` header. None of them look personal from the URL alone, which is why a blanket rule catches them.

The related failure is authorization drift. Alice can read `/api/documents/42`; Bob is forbidden. A cache keyed on the path alone cannot represent that. It serves the cached 200 to Bob and skips your permission check.

## Why GET is not the right test

`GET` promises the request does not change server state. It says nothing about two other questions. Is the response the same for everyone? Is the response safe to store? Those are separate properties, and HTTP has a separate mechanism for each.

The mechanism is `Cache-Control`. The distinction you need is:

- `public` — any cache, including shared ones, may store this.
- `private` — only the user's own browser may store it. Shared caches must not.
- `no-store` — nobody stores it.

A correctly built API sets `private` or `no-store` on personalized responses. If your app already does that, CDNs will respect it, and the blanket rule is less dangerous than it sounds. Many apps do not set these headers at all, because nothing was caching them. In that case, turning on a CDN changes the security properties of the app overnight.

Check what your endpoints send today, before you do anything else.

## What else breaks

**Freshness.** A cached response goes stale the moment the underlying data changes. A user updates their settings, the next GET serves a five-minute-old copy, and the app looks broken. Read-after-write is where users notice caching first.

**Cache key mismatch.** The default key is method plus host plus path plus query. Some responses vary by header — `Accept-Language`, `Accept-Encoding`, an API version, a feature flag, a currency. Those need `Vary` set correctly, or one variant gets served to everyone. `Vary: Cookie` fixes personalization on paper. It also drives the hit rate to near zero, since every session carries a distinct cookie. That is a sign the response does not belong in a shared cache.

**Query-string explosion.** Analytics parameters such as `utm_source` create a new cache key per variant. You then store thousands of copies of one response and hit almost none of them. You need a normalization rule that ignores parameters which do not change the body.

**Errors get cached.** A 500 or a 404 served during an incident can be cached and outlive the incident. Set short explicit TTLs, or `no-store`, on error responses.

## What to do instead

Classify endpoints instead of applying one rule. Three buckets cover most APIs.

**Public and identical for everyone** — product catalogs, published content, config, reference data. Cache these in the CDN with a real TTL. Nearly all the performance win lives here, in a small number of endpoints carrying a large share of traffic.

```
Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=600
```

`s-maxage` sets the shared-cache lifetime separately from the browser's. That lets you keep the CDN copy longer than the browser copy.

**Per-user** — anything behind auth. Use `Cache-Control: private, max-age=0, must-revalidate`, or `no-store` for sensitive data. Let the browser cache it if that helps. Keep it out of the shared tier.

**Never cacheable** — anything with a token, a one-time link, or payment data. `no-store`.

Then make invalidation explicit. TTL alone means every change waits out the clock. Two options work well. Purge by surrogate key or tag when the underlying data changes, which most CDNs support. Or version the URL, so a change produces a new key and the old one ages out.

## The recommendation

Do not apply it to every GET. Pick the handful of public, high-traffic endpoints. Set explicit `Cache-Control` on them. Set `private` or `no-store` as the default everywhere else, so a new endpoint is safe by accident instead of exposed by accident. Verify it: hit the same URL from two logged-in accounts and confirm the bodies differ. Then watch the CDN's hit-rate and age headers to see whether the caching does anything at all.

A small, deliberate list gives you most of the speedup and none of the incident.

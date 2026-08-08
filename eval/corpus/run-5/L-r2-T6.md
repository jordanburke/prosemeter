---
kind: eval-artifact
run: 5
variant: L
replicate: r2
task: T6
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will speed up some endpoints and leak private data on others. Cache the GETs that return the same bytes to everyone, and mark the rest private. "Every GET" is the part to reject.

The danger is that a shared CDN cache stores one response and serves it to the next person who asks. If `GET /api/me` returns your profile, the CDN will hand your profile to the next user. This is a real, common breach, and it does not show up in testing because the first request always looks right.

So sort your endpoints into three buckets.

**Safe to cache in the shared cache.** Responses that depend only on the URL — product listings, public articles, static config, prices. Set `Cache-Control: public, max-age=60, s-maxage=300`. `s-maxage` governs the CDN; `max-age` governs the browser.

**Cacheable, but per user.** Responses that vary by identity. Set `Cache-Control: private, max-age=30`. `private` tells the CDN to keep its hands off while letting the browser cache locally.

**Not cacheable.** Anything with a balance, a cart, an inventory count, or a permission check. Set `Cache-Control: no-store`.

Four things break shared caching even for the safe bucket.

- **Auth headers do not key the cache by default.** The CDN keys on the URL. Two users hitting the same URL with different tokens get the same cached body unless you say `Vary: Authorization` — and that makes the hit rate collapse, which usually means the endpoint belonged in the private bucket anyway.
- **Cookies do the same thing.** A session cookie changes the response but not the cache key.
- **A GET can still have side effects.** If any of yours writes to a log table, increments a counter, or refreshes a token, caching silently stops that work.
- **Content negotiation.** If the response changes with `Accept-Language` or `Accept-Encoding`, name those in `Vary` or users will get the wrong language.

Then decide how stale you can stand. `stale-while-revalidate` lets the CDN serve the old copy and refresh in the background, which gives most of the speed with little of the staleness. And set up purging before you turn caching on — a five-minute TTL on a price that just changed is five minutes of wrong prices with no way to fix it.

The last question to ask is whether caching is even the bottleneck. If your slow endpoints are slow because of an N+1 query or a missing index, the CDN just hides it for logged-out users and leaves everyone else on the slow path. Profile first, then cache what the profile says is hot and public.

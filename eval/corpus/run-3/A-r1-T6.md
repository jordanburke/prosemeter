---
kind: eval-artifact
run: 3
variant: A
replicate: r1
task: T6
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
For genuinely public, identical-for-everyone responses, yes — that's what a CDN is for. Applied to *every* GET, no, and the failure mode is bad: users seeing other users' data.

The problem is that GET means "safe" (doesn't modify anything), not "public." Plenty of GETs are personalized:

- `GET /api/me`
- `GET /api/cart`
- `GET /api/orders`
- `GET /api/feed` — same URL for everyone, completely different content

A shared cache keys on the URL. So the first user to hit `/api/me` populates the cache, and the next user gets *their* profile back. That's not a slow app, that's an incident and possibly a disclosure notification. This has happened to real companies at real scale; it's the single most common way CDN caching goes wrong.

The rule that keeps you safe: **anything that varies by identity must be `Cache-Control: private` or `no-store`.** `private` means browser-only, never the shared cache. That's non-negotiable and it should be the default for authenticated routes, with public caching opted into per endpoint rather than the other way round.

Beyond the safety issue, a few things that make blanket caching not work in practice:

**Invalidation.** A cached response is a stale response until something removes it. If you cache `GET /api/products/42` for an hour and someone edits the price, you're serving the old price for up to an hour. You either accept that window explicitly or wire purge calls into every write path — and the second option is real ongoing work that has to be maintained as endpoints get added.

**Query strings and headers.** `/api/search?q=shoes&page=2` is a distinct cache entry from `?page=2&q=shoes`. Analytics params (`utm_*`) fragment your cache into thousands of entries that each get one hit. Most CDNs let you normalize or ignore params — you have to configure it.

**`Vary` is a trap.** If responses differ by `Accept-Language` or `Accept-Encoding`, you need `Vary` so the cache keys on it. But `Vary: Cookie` — which is what you'd reach for on an authenticated route — effectively disables caching, since every user has a different cookie. It looks like it's protecting you while quietly making the cache useless. Use `private` for those, not `Vary`.

**Errors and empties.** Cache a 500 or an empty result during a bad deploy and you're serving it long after the fix ships. Set short TTLs on non-200s, or don't cache them.

What I'd do instead:

**Classify endpoints, don't blanket-apply.** Three buckets — public and cacheable (product catalog, docs, config, public profiles), private (anything behind auth), never-cache (mutations, anything with a token in it). Public gets a real TTL. Private gets `Cache-Control: private, max-age=<small>`. The rest gets `no-store`.

**Use `stale-while-revalidate` for the public bucket.** `public, max-age=60, stale-while-revalidate=600` serves instantly from cache while refreshing in the background. Usually the best latency-per-unit-of-risk on the whole list.

**Add `ETag`s across the board.** Conditional requests give you `304 Not Modified` — cheap on bandwidth, works fine for private responses, no shared-cache risk. Lower ceiling than edge caching but it applies almost everywhere.

**Verify with an actual test.** Log in as user A, hit an endpoint, log in as user B, hit the same endpoint, check the response body and the `X-Cache` / `Age` headers. Do it for every route before it goes live behind the CDN. If you can automate that as a smoke test, do — it's the check that catches the disclosure bug.

Also worth asking first: has anyone profiled where the slowness actually is? If it's an N+1 query or an unindexed table, a CDN moves the problem to the second request and leaves the first one just as slow. Caching a slow endpoint is a real technique, but it's better applied once you know the endpoint is slow for reasons you've decided not to fix.

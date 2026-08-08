---
kind: eval-artifact
run: sonnet
variant: Et
replicate: r1
task: T6
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It'll speed up some endpoints and break others — GET doesn't mean safe to cache by default. A few things to sort out before flipping this on for everything:

- **Personalized responses.** Any GET that returns user-specific data (profile, cart, dashboard) will leak one user's response to another if it's cached by URL alone in a shared CDN cache. That's not a performance bug, it's a data leak.
- **Auth-gated responses.** If the endpoint checks a session or token, caching the response and serving it to the next request skips that check entirely.
- **Query-sensitive responses.** If the response depends on query params, headers (like `Accept-Language`), or cookies, the cache key has to include those, or you'll serve the wrong variant to the wrong request.
- **Freshness.** Some GETs need to be near-real-time (stock counts, prices). A blanket TTL will serve stale data.

What does work: pick the GET endpoints that are actually public and identical for every caller — static content, public listings, marketing pages — and cache those explicitly, with an intentional cache key (including the query params and headers that matter) and a TTL that matches how fast the data changes. Add `Cache-Control` and `Vary` headers so the CDN knows the rules instead of guessing. Treat it endpoint by endpoint, not as a blanket policy.

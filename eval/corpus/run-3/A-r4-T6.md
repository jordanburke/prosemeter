---
kind: eval-artifact
run: 3
variant: A
replicate: r4
task: T6
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It'll speed things up right up until it serves one user's data to another user, at which point it's an incident rather than an optimization. The idea is directionally right; "every GET" is the part that will hurt.

The problem is that a shared CDN cache keys on the URL (plus whatever you put in `Vary`). It does not know about your session cookie or `Authorization` header unless you tell it to. So `GET /api/me` gets cached from the first user who asks, and every subsequent user gets that response. Same for `/api/orders`, `/api/dashboard`, anything scoped to the requester. This is a well-worn failure mode — it's why `Cache-Control: private` exists.

The useful split is by **who the response belongs to**, not by method:

- **Genuinely public and identical for everyone** — product catalog, static config, published content, anything anonymous. These are great CDN candidates. `Cache-Control: public, max-age=...`.
- **Per-user** — anything behind auth. Either `Cache-Control: private, max-age=...` (browser may cache, shared caches must not) or `no-store` if it's sensitive. If you really want edge caching for these, you have to include the user identity in the cache key, and at that point your hit rate collapses and you've mostly bought yourself risk.
- **Not-safe-to-be-stale** — inventory counts, balances, anything where a 30-second-old answer causes a wrong decision. Short TTL or no cache.

A few other things that bite:

**Not all GETs are side-effect-free in practice.** If any endpoint increments a counter, writes an audit log, or extends a session on read, caching it silently stops that from happening.

**`Vary` is a trap in both directions.** Forget `Vary: Accept-Encoding` and you serve gzip to a client that can't read it. Add `Vary: Cookie` and every distinct cookie value is a separate cache entry, so with an analytics cookie in play your hit rate is effectively zero while you pay full storage cost.

**Invalidation is the hard half.** A long `max-age` is worthless if you can't purge on write. `stale-while-revalidate` is usually the better shape — serve stale instantly, refresh in the background, so users get cache latency without cache staleness lingering.

**What I'd actually do:** look at your traffic and find the handful of endpoints that are both high-volume and public. That's usually where nearly all the win is — caching is Pareto-shaped and the top few routes carry it. Set explicit `Cache-Control` on those, set `private` or `no-store` as the default everywhere else, and verify with `curl -I` that each route sends what you think it does. Default-deny is the right posture here: the cost of accidentally caching something public is a stale page, and the cost of accidentally caching something private is a breach report.

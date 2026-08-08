---
kind: eval-artifact
run: sonnet
variant: E
replicate: r2
task: T6
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will work for some endpoints and break others badly. "Cache every GET" is the wrong grain — the decision has to be per endpoint.

**Where it helps:** GET endpoints that return the same response for every user — public data, static content, catalog listings without personalization. A shared CDN cache serves those fast and cuts load on your origin.

**Where it breaks things:**

- **User-specific responses.** If a GET returns "your" data — profile, cart, dashboard — a shared cache can serve *user A's* response to *user B*. That's a data leak, not a performance win.
- **Auth-gated endpoints.** If the response depends on the caller's permissions, caching it shared means the cache doesn't know who's allowed to see what.
- **Frequently-changing data.** Cache a GET that changes every few seconds and you serve stale data, which for things like balances or inventory counts causes real bugs.
- **Endpoints with side effects.** Some "GET" endpoints aren't pure reads in practice (rare, but check) — caching those hides the side effect on repeat calls.

**What to do instead:**

1. Sort GET endpoints into "safe to cache publicly," "cacheable per-user," and "never cache."
2. For the public ones, set proper `Cache-Control` headers and let the CDN cache them — this is the real win.
3. For per-user data, either don't cache at the CDN, or use cache keys that include the user/session so responses don't cross wires.
4. Set sane TTLs and invalidation for anything cached, so staleness doesn't quietly become a correctness bug.

Blanket-caching every GET is the fast way to leak one user's data to another. Pick the safe subset first.

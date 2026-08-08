---
kind: eval-artifact
run: 2
variant: Ep
replicate: r2
task: T6
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will speed things up and it will leak data between users. A shared CDN cache stores one copy per URL and serves it to everyone. Any GET that returns user-specific data will get cached from one user's request and handed to the next.

That is the blocking problem. `GET /api/me`, `GET /api/orders`, `GET /api/notifications` — these look like plain GETs, but the response depends on who asked. The CDN keys on the URL, not on the session cookie or the `Authorization` header, so it cannot tell those requests apart.

**Sort your GET endpoints into three buckets:**

1. **Public and identical for everyone** — product catalog, static config, published content. Cache these in the shared CDN. This is where the real win is.
2. **Per-user** — anything behind auth that varies by identity. Mark these `Cache-Control: private, no-store`. `private` permits the browser cache but forbids the shared one. Do not rely on `Vary: Authorization` to make these safe; it works in theory, but it gives you a cache entry per token, so the hit rate is near zero and one misconfigured origin header undoes it.
3. **Public but varying on something** — locale, currency, device class. Cache these, but set `Vary` on the exact headers that change the response, and make sure the origin sends that `Vary` on every response for the URL.

Two more things to get right. **GET is not the same as safe to cache** — some GETs have side effects (a "mark as read" link, an analytics pixel), and caching those breaks them silently. And **you need invalidation before you need caching**: decide how a changed product gets out of the cache before you put it in. Short TTLs plus explicit purge on write is the usual answer; long TTLs with no purge path is how you end up serving stale prices for a day.

Start with bucket 1 only. Measure the hit rate. Most apps find the public assets and catalog reads are the bulk of the traffic anyway, so you get most of the speedup without touching anything that carries a session.

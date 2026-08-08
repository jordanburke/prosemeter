---
kind: eval-artifact
run: 4
variant: A
replicate: r1
task: T6
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Some of it will work well. The blanket version will leak user data between users, and that's not a hypothetical — it's the standard way this goes wrong.

The problem is that "GET" tells you the request has no side effects. It does not tell you the *response* is the same for everyone. A shared cache is keyed on the URL. `GET /api/me`, `GET /api/orders`, `GET /api/cart` return completely different bodies depending on who's asking, but they're the same URL. First user through populates the cache; the next hundred get that user's data served back to them. The CDN is behaving correctly — it was told the response was cacheable and shared.

That's the failure mode people find out about via a support ticket that says "I'm logged in as someone else."

So the rule isn't "cache GETs," it's **cache responses that don't vary by identity**, and be explicit about which is which. Concretely:

**Default to `private` or `no-store` on anything behind auth.** Whatever your framework does by default, verify it at the edge — check actual response headers in prod, not what you think the code sets. `Cache-Control: private, no-store` on authenticated routes means the CDN won't hold them regardless of what else is configured.

**Opt in explicitly for genuinely shared responses.** Product catalog, public content, config, reference data, search over public documents. `Cache-Control: public, max-age=...` on those specific routes, chosen deliberately.

**Be careful with `Vary`.** `Vary: Authorization` or `Vary: Cookie` is the technically correct way to say "this varies per user," and it does prevent the leak. But it also gives you a cache entry per distinct cookie value, which for most apps means a ~0% hit rate plus the cost of storing all of it. It's a correctness fix, not a performance one. If a route needs `Vary: Cookie`, that's a signal it shouldn't be in the shared cache at all.

**Have an invalidation story before you turn it on.** This is where people actually get hurt after they've avoided the auth leak. A 24-hour TTL on the product catalog is great until someone changes a price and it doesn't take effect. Decide up front: short TTLs, or purge-on-write via the CDN API, or content-hashed URLs for anything immutable. Pick one per route type. `stale-while-revalidate` is worth knowing about — it lets you serve slightly-stale content instantly while refreshing behind it, which usually gets you most of the win at a fraction of the staleness risk.

**Check what's actually slow first.** If p95 is dominated by an unindexed query or an N+1 in one endpoint, a CDN in front of it doesn't fix that — it hides it for cache hits and leaves every miss exactly as slow. Worth ten minutes with the traces before spending a week on cache config.

If you want a version of this I'd support: pick the three or four highest-traffic genuinely-public GETs, put `public, max-age=60, stale-while-revalidate=300` on them, measure hit rate and origin load, and expand from there. That's most of the available win with none of the data-leak exposure. Happy to go through the route list with you and sort them.

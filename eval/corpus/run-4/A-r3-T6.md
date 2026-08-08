---
kind: eval-artifact
run: 4
variant: A
replicate: r3
task: T6
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Partly. Caching GETs in a CDN is a great idea for *some* of your GETs and a data breach for others, and the "every" is where this goes wrong.

The distinction that matters isn't the HTTP verb, it's whether the response varies by who's asking. A shared cache stores one copy of the response for a given URL and serves it to everyone who requests that URL. So the moment you cache a personalized endpoint, user A's response gets served to user B. `GET /api/me`, `GET /api/orders`, anything scoped by session or bearer token — cache that in a shared cache and you're cross-serving user data. This is not a theoretical risk, it's the single most common way this change causes an incident, and it's usually discovered by a customer.

The safety rails, if you want to do this properly:

**Split endpoints into two categories explicitly.** Public and identical-for-everyone: product catalog, config, pricing tiers, static reference data. Those cache beautifully. Anything user-scoped: `Cache-Control: private, no-store`. There's no third category — if you can't confidently say which bucket an endpoint is in, it's private.

**Set the headers deliberately, per endpoint.** Not a global default. `Cache-Control: public, max-age=60, s-maxage=300` on the cacheable ones, `private, no-store` on the rest. And make the default for anything unlabeled be *no caching*, so a new endpoint added next quarter doesn't silently inherit public caching.

**Understand `Vary` before you rely on it.** `Vary: Authorization` technically makes the cache key include the auth header, which sounds like it solves the problem. In practice it's fragile — CDNs vary in how they handle it, the hit rate collapses to near zero anyway since every user has a distinct token, and you've taken on real risk for no benefit. Don't use it to make personalized endpoints "safe." Just don't cache them.

**Have an invalidation story before you turn it on.** The question that sinks CDN caching projects isn't "will it be faster," it's "a merchant just updated a price, how long until customers see it?" If the answer is "up to five minutes and we can't do anything about it," some team is going to be very unhappy. Decide up front whether you're doing short TTLs, surrogate-key purging on write, or `stale-while-revalidate`. Surrogate keys plus purge-on-write is the version that actually scales, but it means the write path has to know which cache tags it invalidates — that's real work, not a config flag.

**Watch for auth-dependent 404s and 403s.** An endpoint that returns 200 for authorized users and 404 for everyone else will cache the 404 and lock people out, or cache the 200 and leak. Error responses need explicit cache directives too.

What I'd suggest: pick the two or three highest-traffic genuinely-public endpoints, measure what fraction of total requests they represent, and cache just those. If that's 60% of your traffic, you've captured nearly all the available win at nearly zero risk, and you can stop there. If it's 3%, the CDN was never the bottleneck and it's worth profiling before spending more on this — the slowness is probably a database query or an N+1, and no amount of edge caching fixes those for logged-in users.

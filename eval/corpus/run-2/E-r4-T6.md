---
kind: eval-artifact
run: 2
variant: E
replicate: r4
task: T6
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will speed some things up and leak user data on the rest. A shared CDN cache stores one copy of a response and serves it to everyone. That is correct for a public product listing. It is a breach for `/api/me`, `/api/cart`, or anything else whose body depends on who asked. The first user's response gets served to the next thousand.

The split is not GET versus POST. It is whether the response varies by identity. GET only tells you the request is safe to repeat, not that the answer is the same for everybody.

**So sort your endpoints into three buckets:**

**Public and identical for all callers** — product catalog, static config, published content. Cache these in the shared CDN. This is where the wins are.

**Varies by user** — anything behind auth. Mark these explicitly:

```
Cache-Control: private, no-store
```

`private` keeps the CDN from storing it while still allowing the browser to. `no-store` blocks both. Use `no-store` for anything sensitive.

**Varies by something other than identity** — locale, currency, device class. These can be shared, but only if you send `Vary` on the exact header that drives the difference. Never `Vary: Cookie` on a shared cache; cookies are near-unique per user, so you get a cache entry per person and a hit rate near zero.

**Two failure modes to plan for before you turn this on:**

Default behavior is the dangerous part. If an endpoint sends no `Cache-Control`, many CDNs apply heuristic caching and store it anyway. Set a default-deny at the origin and opt endpoints in, rather than trusting yourself to remember the header on every new route.

Invalidation is the other half of the job. A cached response is wrong from the moment the underlying data changes until the TTL expires. Decide per endpoint how stale is acceptable, and wire up purge-on-write for anything where the answer is "not very." Short TTLs plus `stale-while-revalidate` get you most of the benefit with a bounded window of wrongness.

Start with your top few public endpoints by traffic, confirm the hit rate and the latency drop, then expand. Blanket-caching everything is how you end up with someone else's account page in your browser.

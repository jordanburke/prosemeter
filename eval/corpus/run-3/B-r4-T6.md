---
kind: eval-artifact
run: 3
variant: B
replicate: r4
task: T6
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It'll speed things up, and it will also leak one user's data to another user if we do it to *every* GET.

The problem is the word "shared." A CDN cache stores one response and serves it to everyone who asks for that URL. That's exactly what you want for a product listing. It's a serious incident for `/api/me` or `/api/orders` — the first user to hit it fills the cache, and everyone after gets their data back.

The split I'd draw:

**Safe to cache in a shared cache** — responses that are identical for every requester. Static assets, public content, product catalogs, marketing pages, published articles. If two anonymous users would get byte-identical responses, it's cacheable.

**Never in a shared cache** — anything that varies by who's asking. Account data, carts, dashboards, anything behind auth. These need `Cache-Control: private` (browser may cache it, CDN may not) or `no-store` for the genuinely sensitive ones.

Two things that catch people out even on the safe set:

- **Personalization you forgot about.** An endpoint that's public but includes a "recently viewed" section or a region-specific price is per-user data hiding in a public-looking response. Read the actual payload, don't assume from the route name.
- **Query params and headers.** Make sure the cache key includes everything that changes the response. If `?page=2` isn't part of the key, page 2 users get page 1. If the response varies by `Accept-Language`, you need `Vary` set correctly.

Then there's invalidation, which is the part that usually bites. Once something is cached at the edge, a deploy doesn't clear it. You need either short TTLs, or purge-on-write wired into whatever updates the data. Decide which before turning this on, not after someone reports stale prices.

Practical suggestion: rather than a blanket policy, start with the endpoints where caching actually buys something — the high-traffic public reads — and set `Cache-Control` explicitly per route. Default everything else to `private`. It's more work up front than a global rule, but a global rule here has a bad failure mode.

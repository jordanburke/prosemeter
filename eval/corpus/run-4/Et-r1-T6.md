---
kind: eval-artifact
run: 4
variant: Et
replicate: r1
task: T6
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will speed things up and it will leak user data, unless you separate the endpoints first. "Every GET" is the part I would push back on.

**The problem**

A shared CDN cache stores one response per URL and serves it to everyone. That is fine for `/api/products`. It is a breach for `/api/me`.

The failure looks like this: user A requests `/api/me`, the CDN stores their profile under that URL, user B requests the same URL, and the CDN hands them A's data. No attack needed. Two users and a cache is enough.

GET does not mean public. It means safe and idempotent. Plenty of GET endpoints return per-user data.

**How to do it safely**

Sort your GETs into three buckets:

- **Public and identical for everyone** — product catalog, static config, published content. Cache these in the shared CDN. This is where nearly all your win is.
- **Per-user** — anything whose response depends on the auth token. Mark them `Cache-Control: private, no-store` and keep them off the CDN entirely. If you want caching here, it belongs in the browser or in a per-user server-side cache keyed by user ID.
- **Varies by something other than the user** — locale, currency, feature flag. These can be shared, but only with a correct `Vary` header, and only if the varying dimension has few values. `Vary: Accept-Language` is fine. `Vary: Authorization` technically works and gives you a cache with one entry per user, which is a cache that never hits.

Set the headers explicitly at the origin. Do not configure this in the CDN dashboard — the origin is where the code knows whether a response is personal, and header rules in a separate console drift from the code that generates them.

**The other thing that will bite you**

Invalidation. Once a response is in a CDN edge with a one-hour TTL, a database update does not change what users see for up to an hour. Decide per endpoint whether stale is acceptable. Where it is not, either use a short TTL with `stale-while-revalidate`, or wire a purge into your write path.

**What I would do**

Pick your three highest-traffic public GETs, cache those, and measure. That is most of the benefit at almost none of the risk. Then expand deliberately, endpoint by endpoint, with someone checking whether each response can differ between two users.

Blanket-caching everything is a config change that takes five minutes and an incident that takes a week.

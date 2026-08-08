---
kind: eval-artifact
run: 2
variant: Ep
replicate: r5
task: T6
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will speed things up for some endpoints and leak data on others. Caching *every* GET in a *shared* cache is the dangerous part, because "shared" means one user's response can be served to another user.

GET means the request has no side effects. It does not mean the response is the same for everyone. Any endpoint whose response varies by who is asking is unsafe in a shared cache:

- `/api/me`, `/api/cart`, `/api/notifications` — personalized, and a cache hit serves user A's data to user B.
- Anything behind an `Authorization` header or session cookie — same problem.
- Anything whose response varies by `Accept-Language`, tenant, or feature flag — wrong variant served.

CDNs skip caching authenticated requests by default, but that default disappears the moment someone adds a broad cache rule at the edge. That is exactly the change being proposed here.

Sort your endpoints into three buckets:

1. **Public and shared** — product catalog, static config, published content. Cache these at the edge with `Cache-Control: public, max-age=60, s-maxage=300`. This is where the win is.
2. **Per-user** — anything derived from the session. Mark these `Cache-Control: private, no-store`. `private` alone still allows the browser to cache; use `no-store` for anything sensitive.
3. **Varies by header** — set `Vary` on whatever actually changes the response (`Accept-Language`, `Accept-Encoding`). Do not `Vary: Authorization` and call it safe. It technically works, but it fragments the cache per token and gives you near-zero hit rate for the memory cost.

Two more things to settle before shipping:

- **Invalidation.** Decide how a cached response gets purged when the underlying data changes. Short `s-maxage` plus `stale-while-revalidate` handles most cases without an explicit purge API.
- **Error responses.** Make sure 500s and 401s are not cacheable. A cached 500 turns a blip into a sustained outage.

The short version: cache the public stuff aggressively, mark the personalized stuff `no-store`, and never let the rule be "all GETs".

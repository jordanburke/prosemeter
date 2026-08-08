---
kind: eval-artifact
run: 5
variant: L
replicate: r1
task: T6
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
No — caching every GET in a shared cache will leak one user's data to another. GET does not mean public, and a shared cache serves whatever it stored to whoever asks next.

The dangerous case is any endpoint whose response depends on who is asking. `GET /api/me`, `GET /api/orders`, `GET /api/notifications`. The CDN stores the first user's response under the URL. The next user hits the same URL, and the edge hands back the first user's data without ever reaching your server. This is not a rare race. It is the normal behavior of a shared cache, and it has taken down real companies.

The rule is the one in the HTTP spec: a response varying by identity must be marked `private`, which means only the browser may store it, not a shared cache.

```
Cache-Control: private, no-store
```

Sort your GETs into three buckets.

**Public and stable.** Static assets, published articles, product catalogs, anything identical for everyone. These belong in the CDN, and they are where the speed comes from.

```
Cache-Control: public, max-age=300, s-maxage=3600
```

**Public but fast-changing.** Cache them, but short, and use `stale-while-revalidate` so the edge serves the old copy while it fetches a fresh one.

**Per-user or authenticated.** Never in a shared cache. Mark them `private, no-store`.

Three traps beyond the obvious ones.

**`Vary` is not a safety net.** `Vary: Authorization` technically keys the cache by token, but tokens rotate, the cardinality explodes, your hit rate goes to zero, and some CDNs strip or normalize the header. Do not rely on it for isolation.

**Query strings and cookies get normalized.** Many CDNs ignore query parameters or strip cookies by default, so `?userId=42` and `?userId=99` can collapse to one cache entry. Check your provider's default cache key.

**Invalidation is the hard part.** Once the edge holds a response for an hour, an update on your server is invisible for an hour. Either keep TTLs short, or wire purge calls into your write path, or version the URL so a change produces a new key.

Your teammate's instinct is right about where the win is. Static assets and public read endpoints on a CDN are a large, cheap speedup. The mistake is the word "every." Make the default `private`, then opt specific endpoints into the shared cache after checking that their response is the same for every caller. An audit of what is already cacheable usually finds most of the available win in a handful of routes.

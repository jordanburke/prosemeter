---
kind: eval-artifact
run: 2
variant: E
replicate: r1
task: T6
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Caching every GET in a shared cache will leak one user's data to another. `GET` means "does not change anything", not "same for everybody", and those are different properties.

The dangerous case is any personalized endpoint. `GET /api/me`, `GET /api/cart`, `GET /api/orders` all return a different body per user while sharing one URL. A shared cache keys on the URL, so the first user to hit it fills the cache and the next user gets that first user's data back. This is a real breach, not a stale-data annoyance, and CDN logs make it hard to notice.

Split your endpoints into three groups:

- **Public and stable.** Product catalogs, docs, config, static assets. Cache these in the CDN with a long `max-age` and be happy.
- **Public and fresh.** Search results, listings, dashboards. Use a short `max-age` plus `stale-while-revalidate` so users get an instant response while the CDN refreshes behind them.
- **Per-user.** Mark these `Cache-Control: private, no-store`. `private` allows the browser to keep a copy but forbids the shared cache from holding one.

Two more things to get right:

1. **Set `Vary` correctly.** If a response changes with `Accept-Language` or `Authorization`, say so, or the CDN will serve the wrong variant.
2. **Default to `private`.** Make personalized the safe default and opt endpoints into public caching one at a time. The other direction fails silently and in production.

Also worth asking what is actually slow. If your latency comes from a database query rather than network distance, a cache in front of that query helps more and carries none of this risk.

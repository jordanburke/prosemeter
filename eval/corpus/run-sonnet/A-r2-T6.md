---
kind: eval-artifact
run: sonnet
variant: A
replicate: r2
task: T6
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Partly — but caching every GET in a shared CDN cache as-is will likely leak private data across users, so don't ship it broadly without sorting responses first.

The core problem: a CDN cache is shared across everyone hitting it. That's fine for a GET that returns the same body for every caller — a product listing, a public article, static config. It's not fine for a GET that returns something scoped to the caller — `/api/me`, `/api/orders`, anything gated by a cookie or auth header. Cache one user's response there, and the CDN will happily serve it back to the next user who hits the same URL. That's an account data leak, not a performance win.

Before turning this on, split your GET endpoints into two buckets:

- **Public/shared responses** — same result for everyone, safe to cache at the edge. Set `Cache-Control: public, max-age=...` and let the CDN cache these.
- **Private/per-user responses** — set `Cache-Control: private` (or `no-store`) so the CDN skips them, and cache those client-side or in a per-user cache instead if you need speed there.

A few other things to work out even for the public bucket:

- **Invalidation.** How does the cache learn that the underlying data changed? Either set a short TTL, or purge specific URLs on write — otherwise users see stale data after an update.
- **Vary headers.** If the same URL returns different content by locale, auth state, or `Accept` header, you need `Vary` set correctly or the CDN will serve the wrong version to the wrong caller.
- **Which endpoints actually need it.** Cache the slow, high-traffic, rarely-changing ones first. Caching low-traffic endpoints for speed isn't worth the invalidation complexity.

So: yes for the truly public GETs, with correct cache-control and invalidation. No for anything user-scoped — that needs a different strategy entirely.

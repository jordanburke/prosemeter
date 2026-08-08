---
kind: eval-artifact
run: sonnet
variant: Et
replicate: r3
task: T6
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Partly — but caching *every* GET endpoint in a shared CDN cache will break things before it speeds anything up. The problem isn't the idea, it's "every."

A shared cache serves the same stored response to every user who hits that URL. That's fine for a public product list. It's dangerous for anything that returns per-user or per-session data — a `/me` endpoint, an order history, anything gated by auth. Cache that in a shared CDN layer and user A can get served user B's response. That's not a slowdown bug, that's a data leak.

A few other things that go wrong with "cache everything":

- **Auth headers get cached along with the body** unless you strip them, so cached responses can carry stale permissions.
- **Cache keys need to include query params and any header the response varies on** (`Vary: Authorization`, `Vary: Accept-Language`), or different users/requests collide on the same cache entry.
- **Staleness**: data that changes often (inventory counts, live status) served from cache can show wrong information for the TTL window.
- **Invalidation gets hard fast.** Once ten endpoints are cached, you need a real plan for purging on writes, not just a TTL and hope.

The workable version: go endpoint by endpoint. Cache the ones that are public, read-heavy, and tolerant of a few seconds or minutes of staleness — set explicit `Cache-Control` and `Vary` headers, short TTLs to start. Leave anything personalized or auth-scoped out, or use `private` cache-control so it stays client-side only, not in the shared CDN layer. Measure which endpoints are actually hot before you spend effort caching cold ones.

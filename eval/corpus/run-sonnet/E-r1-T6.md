---
kind: eval-artifact
run: sonnet
variant: E
replicate: r1
task: T6
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Partly — it'll speed up some endpoints and break others, so "every GET endpoint" is the wrong scope.

CDN caching works well for responses that are the same for everyone: public product listings, static content, a docs page. It works badly for two common cases:

- **Per-user responses.** `GET /api/me`, `GET /api/cart`, `GET /api/notifications` differ by who's asking. Cache one user's response at a shared edge node, and the next visitor who hits that node gets someone else's data. That's not a slowdown, that's a data leak.
- **Frequently-changing data.** `GET /api/inventory/:id` might be technically "public," but if it's stale by even a minute, customers buy things you're out of stock on.

Before caching any endpoint, ask three questions:

1. **Is the response identical for every caller?** If it varies by auth, cookie, or user ID, don't cache it at a shared layer — or vary the cache key correctly (`Vary: Authorization` and equivalent CDN config).
2. **How stale can it be?** Set the CDN TTL to match. Seconds for prices, hours for a blog post.
3. **How do you invalidate it?** If the underlying data changes, you need a purge path — TTL alone won't cut it for anything time-sensitive.

Start with the endpoints that are read-heavy, public, and slow-changing — that's where CDN caching pays off with the least risk.

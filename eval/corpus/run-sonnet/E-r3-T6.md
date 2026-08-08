---
kind: eval-artifact
run: sonnet
variant: E
replicate: r3
task: T6
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Partly — it will speed up some endpoints and break others, so "every GET endpoint" is the wrong scope.

CDN caching works well for responses that are the same for everyone: public product listings, static content, anything not tied to a specific user. It works badly, or dangerously, for two common cases:

1. **User-specific responses.** If a GET returns data scoped to the logged-in user (their profile, their orders, their dashboard), a shared cache can serve User A's response to User B. That's a data leak, not a performance win. You'd need to key the cache on the user (via a `Vary` header or a per-user cache key), which most CDNs support but which cuts your hit rate a lot — you're now caching per-user, not globally.
2. **Stale data after writes.** A GET that reflects state changed by a POST/PUT/DELETE needs its cache entry invalidated or expired fast, or users see old data after making a change. Without invalidation, you trade speed for correctness bugs that are hard to reproduce.

So: audit your GET endpoints first, split them into "safe to cache publicly" (long TTL, shared) and "user-scoped or frequently mutated" (short TTL or no cache, or per-user keys). Add caching to the first group now. For the second group, decide invalidation strategy before you turn caching on, not after.

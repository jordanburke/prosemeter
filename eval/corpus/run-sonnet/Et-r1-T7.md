---
kind: eval-artifact
run: sonnet
variant: Et
replicate: r1
task: T7
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
This can't merge as-is — there's a SQL injection hole. A few issues, worst first:

**1. SQL injection (blocker).** `id` is interpolated straight into the query string. Anyone who controls `id` can break out of the string and run arbitrary SQL. Use a parameterized query instead:

```ts
const rows = await db.query("SELECT * FROM users WHERE id = $1", [id])
```

(swap `$1` for `?` or the placeholder your driver uses).

**2. Caches "not found" forever, with no way to fix it.** If `rows[0]` is `undefined` (no such user), you cache `undefined` under that id. The next call sees `cache.get(id)` return `undefined`, which is falsy, so `if (cached)` never trips — meaning you'll re-query the database every time for a missing user, which is at least safe, but wastes the point of caching for that path. Worth handling explicitly so the behavior is intentional, not accidental.

**3. No TTL or invalidation.** Once a user is cached, this holds their row forever, even after an update elsewhere (name change, deactivation). Either set an expiry on the cache entry or invalidate it on writes to that user.

**4. `SELECT *`.** Pulls every column, including ones this function may not need (and may not want to cache, if any are sensitive). Select only the columns you use.

Once the query is parameterized, I'm fine approving — but the injection issue has to be fixed before merge, not after.

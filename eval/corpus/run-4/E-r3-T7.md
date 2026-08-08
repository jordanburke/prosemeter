---
kind: eval-artifact
run: 4
variant: E
replicate: r3
task: T7
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Blocking on the SQL injection — the rest are worth fixing while you're in here.

**1. SQL injection (must fix).** `id` goes straight into the query string. Someone passes `' OR '1'='1` and reads every user; worse payloads do worse. Use a parameterized query:

```ts
const rows = await db.query("SELECT id, email, name FROM users WHERE id = $1", [id])
```

That's the fix regardless of where `id` comes from. "It's a UUID from our own router" holds until someone calls this function from somewhere else.

**2. `SELECT *` puts every column in the cache.** That includes `password_hash`, tokens, and anything added to the table later. Name the columns you need. It also makes the cache smaller and stops a schema change from silently widening what you expose.

**3. Nothing invalidates the cache.** A user updates their email and this keeps serving the old one forever. Add a TTL, and call `cache.delete(id)` wherever a user row is written.

**4. Misses aren't cached, so unknown IDs hit the database every time.** `rows[0]` is `undefined` for a missing user, `cache.set` stores it, and `if (cached)` reads falsy on the next call. A scan of random IDs turns into unbounded database load. Cache a null sentinel with a short TTL, or check `cache.has(id)` instead of truthiness.

**5. Concurrent misses stampede.** Fifty requests for a cold key all query at once. If this is a hot path, store the in-flight promise so they share one query.

Happy to approve once 1 and 2 are in. 3 and 4 I'd like in the same PR since they're a few lines. 5 only if this is actually hot.

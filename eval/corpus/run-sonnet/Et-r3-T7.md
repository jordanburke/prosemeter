---
kind: eval-artifact
run: sonnet
variant: Et
replicate: r3
task: T7
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Blocking on one issue, plus a few smaller ones worth fixing in the same pass.

**SQL injection (blocking).** The query builds a string with `id` interpolated directly:

```ts
const rows = await db.query(`SELECT * FROM users WHERE id = '${id}'`)
```

If `id` ever comes from user input — a URL param, a query string, a JWT claim someone can tamper with — this lets an attacker read or corrupt other users' data with something like `' OR '1'='1`. Use a parameterized query instead:

```ts
const rows = await db.query('SELECT * FROM users WHERE id = $1', [id])
```

This isn't a style preference — always parameterize, no exceptions, even when you're sure the caller is trusted today.

**Cache never expires or gets invalidated.** `cache.set(id, rows[0])` has no TTL and nothing evicts an entry when the user updates their profile elsewhere. Callers of `getUser` will keep seeing stale data indefinitely. Add a TTL at minimum, and invalidate the entry (or write through) on update.

**Caches "not found" the same as "no cache entry."** If `rows[0]` is `undefined` (no such user), `cache.get(id)` on the next call also returns falsy, so the guard `if (cached) return cached` doesn't distinguish "not cached" from "cached and empty." Not a bug today, but it means you'll hit the database on every lookup for a missing user, every time — worth a cache-negative-result strategy if that's a real path (e.g. bad IDs from another service).

**Select only what you need.** `SELECT *` pulls every column, including anything sensitive you might add later (password hash, etc.) without a deliberate decision to expose it through this path. Name the columns you need.

Nothing else stands out — happy to approve once the query is parameterized.

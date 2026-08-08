---
kind: eval-artifact
run: sonnet
variant: E
replicate: r1
task: T7
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
This has a SQL injection hole — that's the blocker before anything else.

```ts
const rows = await db.query(`SELECT * FROM users WHERE id = '${id}'`)
```

`id` goes straight into the query string. Anyone who controls `id` can break out of the string and run arbitrary SQL. Fix it with a parameterized query:

```ts
const rows = await db.query(`SELECT * FROM users WHERE id = $1`, [id])
```

Three more things worth fixing before this merges:

- **The cache has no expiration.** `cache.set(id, rows[0])` never gets invalidated, so if a user updates their profile, every future read of this function returns stale data forever (or until the cache evicts on its own, if it even does).
- **Missing users poison the cache path.** If `rows[0]` is `undefined` (no matching user), you cache `undefined` under that key. Depending on your cache implementation, that might mean every future lookup for that ID does a full round trip anyway, or worse, returns `undefined` when a user was later created with that ID.
- **`SELECT *` pulls every column,** including ones you probably don't want traveling through a cache — password hashes, tokens, whatever else lives on that row. Select only the columns this function actually needs.

Once the injection is fixed, the parameterization is the must-fix; the TTL and column-selection points are worth a follow-up comment even if you don't block the PR on them.

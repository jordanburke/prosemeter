---
kind: eval-artifact
run: 4
variant: E
replicate: r2
task: T7
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Blocking on the SQL injection. The rest are things I would fix in the same pass.

**The query interpolates `id` straight into SQL.**

```ts
const rows = await db.query(`SELECT * FROM users WHERE id = '${id}'`)
```

`id` is a `string` off the wire. Pass `' OR '1'='1` and you dump the users table. Use a parameterized query:

```ts
const rows = await db.query("SELECT * FROM users WHERE id = $1", [id])
```

That is the whole fix, and it must land before this merges.

**Misses on a missing user are never cached, and worse, they poison the cache.** If the user does not exist, `rows[0]` is `undefined`, you call `cache.set(id, undefined)`, and the next call's `if (cached)` is falsy — so you hit the database every time. Check `cache.has(id)` instead of truthiness, and decide deliberately whether to cache a negative result.

**Entries never expire and nothing invalidates them.** Update a user's email and this function serves the old row until the process restarts. Add a TTL, or clear the key wherever you write to `users`.

**Callers share one object.** You hand out the same reference every time, so any caller that mutates the result mutates it for everyone. Freeze it or return a copy.

**`SELECT *` pulls every column into memory and into the cache.** Name the columns you need. It also means a schema change silently changes what you cache — including any column someone adds later that should not be handed to callers.

**Concurrent misses all hit the database.** Ten simultaneous calls for a cold key run ten queries. If this sits on a hot path, cache the in-flight promise rather than the result.

Happy to pair on it if any of these are awkward with the current db wrapper.

---
kind: eval-artifact
run: 4
variant: Et
replicate: r1
task: T7
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Blocking on the SQL injection. The rest are smaller.

**1. SQL injection — must fix before merge**

```ts
const rows = await db.query(`SELECT * FROM users WHERE id = '${id}'`)
```

`id` is a `string` that comes from outside. A caller passing `' OR '1'='1` reads every user. Passing `'; DROP TABLE users; --` does worse. The `string` type tells you nothing about the contents — TypeScript checks shape, not trust.

Use a parameterized query:

```ts
const rows = await db.query("SELECT * FROM users WHERE id = $1", [id])
```

The driver sends the query and the values on separate channels, so the value can never be parsed as SQL. This is the only fix. Escaping helpers and validation are defense in depth, not a substitute.

**2. Negative results are never cached**

A miss on a nonexistent user leaves the cache empty, so every subsequent lookup for that ID hits the database. If IDs come from user input, that is a trivial way to bypass your cache entirely. Cache the miss, with a shorter TTL:

```ts
const cached = cache.get(id)
if (cached !== undefined) return cached === NOT_FOUND ? undefined : cached
```

Note `!== undefined` rather than truthiness — the current `if (cached)` also misses on any falsy cached value.

**3. No TTL and no invalidation**

`cache.set(id, rows[0])` with no expiry means the entry lives until the process restarts. A user updates their email and every reader sees the old one indefinitely. Add a TTL, and call `cache.delete(id)` from whatever writes to `users`.

**4. `SELECT *`**

You are caching every column, including whatever the schema grows next — password hashes, tokens, internal flags. List the columns you need. It bounds memory and stops a future migration from putting secrets in your cache.

**5. No stampede protection**

Under load, N concurrent requests for a cold key all miss and all hit the database. If this is a hot path, store the in-flight promise rather than the result, so concurrent callers await the same query.

**6. Return type**

`rows[0]` is `undefined` for a missing user, but the signature infers as if it always returns a user. Make it explicit: `Promise<User | undefined>`.

Happy to pair on the query change — that one I would like to see land today, separate from the rest.

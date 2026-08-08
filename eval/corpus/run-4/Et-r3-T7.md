---
kind: eval-artifact
run: 4
variant: Et
replicate: r3
task: T7
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Blocking on the SQL injection. The rest is worth fixing while you are in here.

**1. SQL injection — must fix.**

```ts
db.query(`SELECT * FROM users WHERE id = '${id}'`)
```

`id` is a string off the request. Pass `' OR '1'='1` and the caller gets a user row back. Pass a semicolon and they get whatever the DB user can do. Parameterize it:

```ts
const rows = await db.query("SELECT id, email, name, created_at FROM users WHERE id = $1", [id])
```

Never interpolate into SQL, even for values you believe are UUIDs. If it is a UUID, validate it at the edge *and* parameterize — the validation is not the defense.

**2. `SELECT *` leaks columns.** Whatever is on that table today goes out to every caller — password hash, reset token, internal flags. It also breaks silently when someone adds a column. Name the columns you want.

**3. Missing rows poison the cache path.** If no user matches, `rows[0]` is `undefined` and you `cache.set(id, undefined)`. The next call reads it, `if (cached)` is falsy, and you hit the database again. Every lookup for a missing ID becomes a query. That is a cheap denial-of-service: loop over random IDs and every one reaches Postgres.

```ts
const user = rows[0]
if (!user) return null
cache.set(id, user)
return user
```

**4. No TTL and no invalidation.** Once a user is cached, an update anywhere else in the system never shows up. Either set a TTL on `cache.set` or bust the key in whatever writes the user. Say which one in the PR — right now the cache has no expiry story at all.

**5. Return type.** `getUser` currently infers `Promise<any>`. Give it `Promise<User | null>` so callers have to handle the miss.

**Smaller point.** Two concurrent calls for an uncached ID both hit the database. Fine at your traffic, worth knowing if this ends up on a hot path — the fix is caching the promise, not the value.

Happy to re-review once the first one is in. The others I would take as follow-ups if you are in a hurry, but 1 and 3 I would not merge without.

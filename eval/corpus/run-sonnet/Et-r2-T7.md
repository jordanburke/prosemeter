---
kind: eval-artifact
run: sonnet
variant: Et
replicate: r2
task: T7
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Blocking on one issue, plus a couple of smaller ones worth fixing in the same pass.

**SQL injection (blocking).** `id` gets interpolated straight into the query string:

```ts
const rows = await db.query(`SELECT * FROM users WHERE id = '${id}'`)
```

If `id` ever comes from user input — a route param, a query string — someone can pass `' OR '1'='1` or worse and read or manipulate rows they shouldn't touch. Use a parameterized query instead:

```ts
const rows = await db.query('SELECT * FROM users WHERE id = $1', [id])
```

(Syntax depends on your driver — `?` for mysql2, `$1` for `pg`.) This isn't a style preference, it's a correctness fix — string interpolation into SQL should never ship.

**Cache poisoning on missing users.** If `rows[0]` is `undefined` (no matching user), the code still does `cache.set(id, undefined)`. Depending on how `cache.get` treats a stored `undefined`, later calls for that same `id` may skip the DB query and keep returning nothing, even after the user gets created. Guard the cache write:

```ts
const user = rows[0]
if (user) cache.set(id, user)
return user
```

**No TTL or invalidation.** The cache never expires and nothing invalidates it on user update. If a user's row changes elsewhere, `getUser` will keep serving the stale cached version indefinitely. Worth confirming this is intentional — if `cache` is a proper cache library it may already handle TTL, but it's not visible here.

Once the SQL injection is fixed, happy to approve.

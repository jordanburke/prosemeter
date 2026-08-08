---
kind: eval-artifact
run: sonnet
variant: E
replicate: r2
task: T7
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
This has a SQL injection bug — that has to block the merge. Everything else is secondary.

**Blocking issue: SQL injection.**
```ts
const rows = await db.query(`SELECT * FROM users WHERE id = '${id}'`)
```
`id` goes straight into the query string. Anyone who controls `id` can break out of the string and run arbitrary SQL. Use a parameterized query instead:
```ts
const rows = await db.query('SELECT * FROM users WHERE id = $1', [id])
```
(adjust placeholder syntax to whatever driver this uses — `?`, `$1`, named params).

**Worth fixing before merge:**

- **No cache expiry.** `cache.set(id, rows[0])` never expires. If the user's row changes later (name, email, plan), this endpoint serves stale data forever. Add a TTL.
- **Caches empty results as `undefined`.** If `rows` is empty, `rows[0]` is `undefined`, and you cache that. Every future call for that id returns `undefined` from cache and skips the DB — including once the user does exist. Guard against caching misses, or give it a short TTL too.
- **`SELECT *`.** Pulls every column including ones you may not want cached or returned (password hash, internal flags). Select only the fields the caller needs.

**Smaller notes:**
- No error handling around the `db.query` call — a failure here will throw uncaught up the stack.
- No type on the return value — worth typing the row shape so callers get real autocomplete instead of `any`.

Fix the injection first — that's a real vulnerability, not a style nit.

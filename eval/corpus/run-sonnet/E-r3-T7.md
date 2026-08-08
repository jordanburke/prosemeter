---
kind: eval-artifact
run: sonnet
variant: E
replicate: r3
task: T7
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Blocking on one issue, two more worth fixing before merge.

**SQL injection (blocking).** The query builds a string with `${id}` interpolated straight into SQL. Anyone who controls `id` can break out of the string and run arbitrary SQL. Use a parameterized query instead:

```ts
const rows = await db.query("SELECT * FROM users WHERE id = $1", [id])
```

(Adjust the placeholder syntax to your driver — `$1`, `?`, or `:id` depending on what you use.) This isn't a style preference; treat it as a hard blocker.

**Cache poisoning on missing rows.** If `rows[0]` is `undefined` (no user with that ID), the code caches `undefined` under that key anyway. Every future lookup for that ID returns a cache hit of `undefined` instead of hitting the database and finding the user still doesn't exist — that's usually fine, but if the user gets created later, the cache never sees it change. Guard the cache write:

```ts
const user = rows[0]
if (user) cache.set(id, user)
return user
```

**Select `*` on a users table.** Pulling every column means the cache — and every caller — now carries whatever sensitive fields exist on that table (password hash, tokens, whatever). Select only the columns callers need.

Fix the injection before this merges. The other two I'd raise as follow-up comments, not blockers.

---
kind: eval-artifact
run: sonnet
variant: A
replicate: r2
task: T7
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Found a blocker and a couple of things worth fixing before this merges.

**Blocker: SQL injection.**
```ts
const rows = await db.query(`SELECT * FROM users WHERE id = '${id}'`)
```
`id` is interpolated straight into the query string. Anyone who controls `id` can break out of the quotes and run arbitrary SQL. Use a parameterized query instead:
```ts
const rows = await db.query('SELECT * FROM users WHERE id = $1', [id])
```
This needs to change no matter what — even if `id` comes from a trusted internal source today, that assumption breaks the first time this function gets called from somewhere new.

**Caches a miss as a hit.** If the query returns no rows, `rows[0]` is `undefined`, and this still calls `cache.set(id, undefined)`. Next call, `cache.get(id)` returns `undefined` too — same as before you cached anything — but depending on your cache implementation, a cached `undefined` may report as a "hit" for size/eviction purposes, or worse, mask a real "user not found" case that should be re-checked later (e.g. after the user record is created). Worth an explicit check: only cache when a row exists.

**No TTL / no invalidation.** Once a user's row changes elsewhere, this cache has no way to know. If `cache` doesn't already expire entries or get invalidated on user updates, this will silently serve stale data forever. Worth confirming the cache instance handles that, since it's not visible in this function.

**Minor: `SELECT *`.** Pulls every column even if the caller only needs a few fields. Not urgent, but naming the columns you need keeps the payload (and the cache) smaller and avoids surprise breakage if the table gains new columns later.

Fix the injection issue and I'm fine approving — the cache correctness points are worth a follow-up if not this PR.

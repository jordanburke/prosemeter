---
kind: eval-artifact
run: 4
variant: A
replicate: r2
task: T7
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Blocking on one thing, then a few smaller notes.

**SQL injection — has to be fixed before this merges.** `id` is interpolated straight into the query string. If `id` reaches this function from a route param or request body, a caller can pass `' OR '1'='1` and read every user, or worse depending on what the DB role is allowed to do. Parameterize it:

```ts
const rows = await db.query("SELECT * FROM users WHERE id = $1", [id])
```

The driver sends the value out-of-band from the statement, so there's no parse step where the input can become syntax. Worth grepping for other template-literal queries while you're in here — this pattern rarely appears exactly once.

Smaller things, none of them blocking:

**Negative results aren't cached, and `if (cached)` is the wrong check.** If a lookup misses, `rows[0]` is `undefined`, you `cache.set(id, undefined)`, and then `if (cached)` is falsy forever — every subsequent request for that ID hits the database again. That's a free cache-miss amplifier for anything that scans nonexistent IDs. Use `cache.has(id)` and decide deliberately whether misses get cached (usually yes, with a short TTL, to blunt lookup-storm patterns).

**No TTL and no invalidation.** Once a user is in the cache, this returns the stale row indefinitely. If anything in the app updates a user, that update is invisible here. Either give entries a TTL or have the write path evict the key. Which one depends on how fresh this needs to be — but "never expires, never invalidated" isn't a choice you want to make by omission.

**`SELECT *`** pulls every column, which means whatever's in the users table today plus whatever gets added later. If there's a password hash, a token, or a PII column in there, it's now sitting in an in-process cache and going wherever the return value goes. Select the columns you need.

**No return type.** Inferred as whatever `db.query` gives back, likely `any`. An explicit `Promise<User | undefined>` gets you the null-handling checked at the call sites.

Also worth a thought: if this runs in more than one process, each one gets its own cache with its own idea of the truth, and invalidation gets meaningfully harder. Fine if it's intentional — just want to make sure it is.

Happy to pair on the parameterization if useful. The rest can be a follow-up.

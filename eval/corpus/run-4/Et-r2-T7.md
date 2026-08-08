---
kind: eval-artifact
run: 4
variant: Et
replicate: r2
task: T7
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Blocking on one thing, then three smaller notes.

**SQL injection.** The `id` goes straight into the query string. A caller passing `' OR '1'='1` reads every user in the table, and worse payloads do worse. Use a parameter — the driver escapes it and the value can never be parsed as SQL:

```ts
const rows = await db.query("SELECT id, email, name FROM users WHERE id = $1", [id])
```

That "it's just an internal ID" argument does not hold. IDs arrive from route params, and the type annotation is a compile-time claim about a value that shows up at runtime as whatever the client sent.

**The cache never handles a miss.** When no user matches, `rows[0]` is `undefined`, you store `undefined`, and `if (cached)` reads falsy on every later call. So every lookup for a non-existent ID hits the database forever. That is the shape of a cheap denial-of-service — loop over random IDs and every one is a full query. Store a sentinel for the negative case, or return early before writing to the cache.

**No TTL and no invalidation.** Once a user is cached, an email change never shows up. Add an expiry, and delete the key wherever you write to the user row.

**`SELECT *` puts the whole row in cache.** Password hashes, tokens, whatever gets added to the table next quarter — it all ends up in memory and in whatever this function returns. Name the columns you need.

One small thing: the return type is inferred from the driver and is probably `any`. Annotate it as `Promise<User | undefined>` so callers have to deal with the missing case.

Happy to approve once the query is parameterized. The rest I would take in a follow-up if you are in a hurry.

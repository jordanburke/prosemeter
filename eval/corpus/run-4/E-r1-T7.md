---
kind: eval-artifact
run: 4
variant: E
replicate: r1
task: T7
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Blocking on this one — there's a SQL injection in the query. A few other issues below it, but that's the one that has to change.

**SQL injection (blocking).** `id` goes straight into the query string. A caller passing `' OR '1'='1` reads every user in the table. Worse payloads do worse. Use a parameterized query and let the driver handle quoting:

```ts
const rows = await db.query("SELECT id, email, name FROM users WHERE id = $1", [id])
```

Never fix this by escaping the string yourself. Parameters are the fix.

**Caching a miss as a hit.** When no row matches, `rows[0]` is `undefined` and you cache it. The next call's `if (cached)` sees a falsy value, misses, and hits the database again. So lookups for nonexistent IDs never cache and every one becomes a query — a cheap way to hammer the database with junk IDs. Check `cached !== undefined`, and store a sentinel for known-missing rows if you want negative caching.

**`SELECT *`.** This pulls whatever columns the table has today, including the password hash and anything added later, then puts them in a cache and returns them to the caller. Name the columns you want.

**No TTL or invalidation.** Once a user is cached, an update elsewhere never shows up. Set an expiry, and clear the key wherever users get written.

**Cache stampede.** When a hot key expires, every concurrent request misses and all of them query at once. Worth a single-flight wrapper if this is on a hot path.

**Return type.** The signature infers `Promise<any>`. Give it an explicit `Promise<User | undefined>` so callers have to handle the missing case.

Happy to pair on the parameterized version if that's quicker.

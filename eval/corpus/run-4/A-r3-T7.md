---
kind: eval-artifact
run: 4
variant: A
replicate: r3
task: T7
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Blocking on one thing, then a few smaller notes.

**SQL injection — must fix before merge.**

```ts
const rows = await db.query(`SELECT * FROM users WHERE id = '${id}'`)
```

`id` is a `string` that arrives from outside. Nothing here validates or escapes it. Someone passes `' OR '1'='1` and gets every user in the table; passes `'; DROP TABLE users; --` and it's worse. The type annotation gives no protection at all — `string` means "is a string," not "is safe."

Parameterize it:

```ts
const rows = await db.query("SELECT * FROM users WHERE id = $1", [id])
```

(Adjust the placeholder syntax to your driver — `$1` for `pg`, `?` for mysql2.) The driver sends the query and the values on separate channels, so the value can never be parsed as SQL. This is not a hardening measure to consider later; it's the only correct way to write this line.

**Cache poisoning follows from the same bug.** Because the key is the raw `id` and the query is string-built, a crafted `id` both extracts data *and* writes the result into the cache under an attacker-chosen key. So the injection isn't a one-shot read, it's persistent. Worth flagging explicitly because it changes the severity from "bad" to "drop everything."

Smaller things, non-blocking but I'd take them:

**Negative results aren't cached, and misses aren't distinguishable.** If the user doesn't exist, `rows[0]` is `undefined`, you `cache.set(id, undefined)`, and then `if (cached)` is falsy forever after — so every lookup for a nonexistent id hits the database, every time. That's a free amplification vector: hammer `getUser` with random ids and you're driving unbounded query load. Either don't cache the miss, or cache a sentinel and check with `cache.has(id)` rather than truthiness.

**`SELECT *` in a cached path.** Whatever columns exist today get cached and returned, including any added later — `password_hash`, `mfa_secret`, internal flags. If this value is ever serialized toward a client, a future migration silently leaks. Name the columns you need.

**No TTL or size bound visible.** Depends on what `cache` is, so maybe this is handled — but if it's a bare `Map`, it grows without limit and never expires, which is a slow memory leak plus indefinitely stale user data. If it's an LRU with a TTL configured elsewhere, ignore this.

**Concurrent misses stampede.** Ten simultaneous calls for an uncached id all miss and all hit the database. Caching the in-flight promise rather than the resolved value fixes it cheaply:

```ts
const inflight = new Map<string, Promise<User | undefined>>()
```

That one's a genuine "later if it matters" — mention it, don't gate on it.

Happy to re-review once the parameterized query is in. The rest we can take in a follow-up if you'd rather keep this PR small.

---
kind: eval-artifact
run: sonnet
variant: A
replicate: r3
task: T7
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
One blocker, plus a couple of things worth fixing before this merges.

**Blocker — SQL injection.** The query builds with string interpolation:

```ts
const rows = await db.query(`SELECT * FROM users WHERE id = '${id}'`)
```

If `id` ever comes from user input (path param, query string, request body), someone can pass `' OR '1'='1` or worse and read or manipulate rows outside their scope. Use a parameterized query instead:

```ts
const rows = await db.query("SELECT * FROM users WHERE id = $1", [id])
```

(Adjust placeholder syntax to whatever driver you're on — `?`, `$1`, named params.)

**Not-found handling.** If `id` doesn't match a row, `rows[0]` is `undefined`, and you cache `undefined` under that key. `if (cached)` then treats every future lookup for that id as a cache miss — you're back to hitting the DB every time, silently. Worth an explicit check:

```ts
const row = rows[0]
if (!row) return undefined // or throw NotFoundError
cache.set(id, row)
```

**`SELECT *`.** Pulling every column means the cache — and any caller of this function — gets fields like a password hash or internal flags that probably shouldn't leave this layer. Select only the columns you need.

**No TTL or invalidation.** Once a user is cached, it's cached forever unless something explicitly evicts it. If the user record can change (email, role, status), a stale cache serves wrong data indefinitely. Worth deciding on a TTL or an explicit invalidation path (e.g., clear on update) before this ships.

The SQL injection is the one I'd block on — the rest I'd flag as follow-ups if you want to ship fast, but they're real gaps.

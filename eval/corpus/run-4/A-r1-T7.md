---
kind: eval-artifact
run: 4
variant: A
replicate: r1
task: T7
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Can't approve this one — there's a SQL injection in it. A few other things too, but that's the blocker.

**SQL injection (must fix)**

```ts
await db.query(`SELECT * FROM users WHERE id = '${id}'`)
```

`id` is a `string` that comes from outside. If it arrives from a route param or query string, an attacker sends `' OR '1'='1` and gets every user, or `'; DROP TABLE users; --` and has a considerably better day than you do. The `string` type gives you no protection here — TypeScript validates shape, not content.

Parameterize it:

```ts
const rows = await db.query("SELECT id, email, name, created_at FROM users WHERE id = $1", [id])
```

Placeholder syntax depends on the driver (`$1` for `pg`, `?` for mysql2) but the principle is the same: the value never becomes part of the SQL string.

**`SELECT *`**

Two problems beyond style. First, whatever columns exist today go into the cache and out to callers — including `password_hash`, `mfa_secret`, or whatever gets added to that table next quarter by someone who has no idea this function exists. Second, a column rename silently changes your return shape. Name the columns you actually need.

**The cache has no invalidation and no TTL**

Once a user is cached, this function will return that snapshot until the process restarts. Any update to the user — email change, role change, deactivation — won't be visible through this path. If roles or permissions are read through here, "we revoked their access and they still had it" becomes a security finding rather than a staleness annoyance.

You need at least a TTL, and ideally an explicit invalidation wherever users are written. Also worth confirming the cache is bounded — an unbounded `Map` keyed on user ID is a memory leak with extra steps on a large user base. An LRU with a max size and a TTL covers both.

**Missing users are cached as `undefined`**

If no row matches, `rows[0]` is `undefined`, and `cache.set(id, undefined)` stores it. Then `if (cached)` is falsy on every subsequent call, so you re-query the database every single time for IDs that don't exist. That's a free amplification vector — hammer the endpoint with random IDs and every one is a guaranteed DB round trip. Either don't cache misses, or cache them deliberately with a sentinel and a short TTL, and use `cache.has(id)` rather than truthiness for the lookup.

**Shared mutable object**

Every caller gets the same object reference out of the cache. One caller doing `user.name = "..."` corrupts it for everyone. Either freeze it on the way in or return a copy.

**Return type**

We ask for explicit return types on exported functions. Right now this infers to `any` from the driver's row type, and that `any` propagates to every call site. Give it a `Promise<User | undefined>` and let the compiler check the mapping.

Rough shape of where I think it lands:

```ts
export async function getUser(id: string): Promise<User | undefined> {
  const cached = cache.get(id)
  if (cached !== undefined) return cached

  const rows = await db.query<UserRow>("SELECT id, email, name, created_at FROM users WHERE id = $1", [id])
  const user = rows[0] ? toUser(rows[0]) : undefined
  if (user) cache.set(id, user) // LRU with TTL
  return user
}
```

The injection fix is non-negotiable; the rest I'm happy to discuss. If the cache invalidation story is genuinely hard here, a 30-second TTL is a reasonable place to start rather than trying to wire up write-through on this PR.

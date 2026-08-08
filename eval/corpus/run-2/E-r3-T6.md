---
kind: eval-artifact
run: 2
variant: E
replicate: r3
task: T6
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will speed up some endpoints and leak user data on others. GET does not mean public, and a shared cache does not know the difference. Cache selectively, not by method.

The danger case is any GET that varies by user. `/api/me`, `/api/cart`, `/api/notifications` all return 200 with a body that depends on the auth cookie or bearer token. A shared CDN cache keyed on URL stores the first user's response and serves it to everyone who asks for the same path. That is a real breach, and it is the classic way this goes wrong.

Split your endpoints into three buckets.

**Public and identical for everyone.** Product listings, docs, static config. Cache these in the CDN. Set a real TTL and let it work:

```
Cache-Control: public, max-age=300, s-maxage=3600
```

**Per-user.** Anything shaped by identity. Keep these out of the shared cache entirely:

```
Cache-Control: private, no-store
```

`private` allows the browser to cache it but forbids the CDN from doing so. Use `no-store` for anything sensitive.

**Public but changes often.** Cache with a short `s-maxage` plus `stale-while-revalidate` so users get an instant response while the CDN refreshes in the background.

Three things to get right.

**Set headers on the origin, explicitly, on every route.** Do not rely on CDN defaults or path rules — a new endpoint added later will inherit the wrong behavior silently.

**Watch your `Vary` header.** If a response differs by `Accept-Language` or `Accept-Encoding`, say so with `Vary`, or you will serve the wrong variant. Never let a shared cache serve content that varies by `Authorization` — mark it `private` instead.

**Plan invalidation before you turn it on.** Decide now how a price change reaches users. Either keep TTLs short enough that staleness is tolerable, or wire a purge call into your write path.

One more thing worth checking: measure where the time actually goes first. If your slowness is a slow database query on a per-user endpoint, the CDN cannot help, and the fix is an index or a server-side cache like Redis keyed by user.

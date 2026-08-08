---
kind: eval-artifact
run: 3
variant: E
replicate: r2
task: T6
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will speed up some endpoints and leak user data on others. Do not apply it to every GET.

The problem is that a shared CDN cache stores one response per URL and serves it to everyone. GET means "safe" — it does not change server state. It does not mean "the same for all users". Any endpoint whose response depends on who is asking will hand one user's data to the next.

The dangerous set:

- `/api/me`, `/api/cart`, `/api/notifications` — anything keyed on the session
- Endpoints where the response varies by auth header, cookie, or role
- Search or list endpoints filtered by permissions, where an admin's response gets served to a regular user
- Anything with a `Set-Cookie` header, which a shared cache would replay to other clients

The safe set is content that is the same for everyone: product catalogs, public pages, config, static assets, published articles.

So split them rather than blanket-caching. Mark public responses explicitly:

```
Cache-Control: public, max-age=300, s-maxage=3600
```

And mark everything user-specific so no shared cache touches it:

```
Cache-Control: private, no-store
```

`private` means browser-only, never the CDN. Make that the default and opt endpoints into `public` one at a time. A default of "cache unless told otherwise" is the shape that causes incidents.

Three more things to get right:

**Vary.** If a response differs by `Accept-Language` or `Accept-Encoding`, list those in a `Vary` header so the CDN keys on them. Never rely on `Vary: Authorization` for user data — it works in theory and fails whenever a proxy normalizes headers. Use `private` for that.

**Invalidation.** A five-minute TTL means five minutes of stale data after a write. Decide per endpoint whether that is acceptable, and wire up purge-on-write for the ones where it is not.

**Freshness matters more than hit rate.** Prices, inventory, and balances going stale cost more than the latency you saved.

Last point: check where the latency actually is before doing any of this. If your slow endpoints are the personalized ones, CDN caching cannot help them, and the fix is a database index, a query change, or an origin-side cache keyed by user. Measure first.

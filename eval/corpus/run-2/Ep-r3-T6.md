---
kind: eval-artifact
run: 2
variant: Ep
replicate: r3
task: T6
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Caching every GET in a shared cache will leak user data between users. GET means safe to repeat, not safe to share — those are different properties, and a shared CDN cache only respects the second one.

The failure looks like this. User A requests `/api/profile`, the CDN stores the response under that URL, and User B requests the same URL and gets A's profile. The CDN keys on the URL, not on the `Authorization` header or the session cookie, unless you tell it to. This is a routine cause of real breaches, not a theoretical risk.

So split your endpoints by who the response belongs to.

**Cacheable in a shared cache**: responses identical for every caller. Product catalogs, public config, static reference data, marketing content. Mark these `Cache-Control: public, max-age=300`.

**Never shared**: anything shaped by identity. Send `Cache-Control: private, no-store` on those, and make sure it's the *default* so a new endpoint is safe until someone deliberately opens it up. An allowlist beats a blocklist here, because the cost of forgetting one is a data leak.

The second problem is staleness. A user updates something, gets redirected to a page served from cache, and sees the old value — so they do it again. Anything a user can mutate needs either a short TTL or explicit purge on write.

Two things that make this safer if you want more coverage:

- **`Vary: Authorization`** keys the cache per token. It works, but hit rates collapse, so you get the risk of caching with little of the speed.
- **Cache at the edge with a per-user key** if your CDN supports custom cache keys. More control, more config to get wrong.

Ask what's actually slow before any of this. If the p95 is a slow database query, a CDN in front of it doesn't help the users who miss the cache — and those are the ones complaining. Profile first, then cache the handful of endpoints that are genuinely hot and genuinely public.

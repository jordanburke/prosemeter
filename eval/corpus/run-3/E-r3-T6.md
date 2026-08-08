---
kind: eval-artifact
run: 3
variant: E
replicate: r3
task: T6
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Caching every `GET` in a shared cache will leak one user's data to another user. A shared CDN cache keys on the URL, not on who asked. So `GET /api/me` gets stored from the first request and served to everyone after.

That's the blocker. `GET` means safe to repeat, not safe to share.

**The rule: only per-user responses go in a private cache.** Split your endpoints into two groups.

*Shareable* — same bytes for every caller. Product catalog, pricing tiers, public profiles, static config. These belong in the CDN:

```
Cache-Control: public, max-age=300, s-maxage=3600
```

*Personal* — varies by session, token, or role. Anything behind auth. These must never enter a shared cache:

```
Cache-Control: private, no-store
```

Set `private, no-store` as the default at the framework layer and opt endpoints into `public` one at a time. Defaulting the other way means one new endpoint ships a data leak.

**Three things that bite even on the shareable set:**

1. **`Vary` is easy to get wrong.** If a response differs by `Accept-Language` or `Accept-Encoding`, say so in `Vary` or the CDN serves the wrong variant. `Vary: Cookie` technically works for auth but fragments the cache so badly it's pointless — use `private` instead.
2. **Invalidation is the real work.** A five-minute TTL means five minutes of stale prices after an update. Decide per endpoint whether that's acceptable, and wire purges into your write path where it isn't.
3. **Some `GET`s aren't safe to repeat.** Search endpoints that write analytics, or anything with side effects, will behave oddly behind a cache.

**On the speed goal:** measure before you build this. If the latency is a slow database query, a CDN hides it only for the requests that hit cache — and cold requests still pay full price. Check where the time actually goes first. Often the win is an index or a fixed N+1, not a cache layer.

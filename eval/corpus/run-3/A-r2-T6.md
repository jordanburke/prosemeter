---
kind: eval-artifact
run: 3
variant: A
replicate: r2
task: T6
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It'll speed things up right up until it serves someone else's data to the wrong user, and then it's a security incident rather than a perf win.

The problem is the word "every." GET being safe and side-effect-free doesn't mean the *response* is shareable. A shared CDN cache stores one copy per cache key — typically URL plus whatever you've told it to vary on — and hands that copy to everyone who asks. So `GET /api/me` gets cached with the first user's profile in it, and the next user gets that profile. Same for `/api/orders`, `/api/notifications`, anything scoped to the caller by session or token rather than by URL.

The split you want is by *who the response belongs to*, not by HTTP verb:

**Safe to cache in a shared cache** — same bytes for everyone: static assets, public product pages, published content, reference data, config. Cache these hard, with long TTLs and content-hashed URLs where you can.

**Never in a shared cache** — anything personalized or auth-scoped. These need `Cache-Control: private, no-store` (`private` permits the browser cache but forbids the CDN; add `no-store` for genuinely sensitive things). If your origin currently sends no cache headers at all and you turn on a blanket CDN rule, you're relying on the CDN's defaults, which is exactly how this goes wrong.

**In between** — same for everyone but changes often. Short TTL plus `stale-while-revalidate` gets you most of the benefit with bounded staleness:

```
Cache-Control: public, max-age=60, stale-while-revalidate=300
```

Two other things that bite people:

- **`Vary` is not a substitute for `private`.** `Vary: Authorization` technically keys the cache per token, but it fragments your cache to near-uselessness and depends on every layer honoring it correctly. Don't route auth-scoped responses through a shared cache and hope `Vary` saves you.
- **You need an invalidation story before you need caching.** A five-minute TTL means five minutes of a user staring at data they just changed and swearing the save didn't work. Decide up front whether you're doing purge-on-write or living with the TTL.

Concretely, what I'd do: default to `private, no-store` at the origin, then explicitly opt specific routes into public caching as you verify each one is genuinely user-independent. Allowlist, not blocklist — with a blocklist, the day someone adds a personalized endpoint and forgets to exclude it is the day it leaks.

Also worth asking first: is the CDN even the bottleneck? If the app is slow because of N+1 queries or a chatty waterfall of client requests, CDN caching won't touch that, and you'll have taken on correctness risk for nothing. Profile before you cache.

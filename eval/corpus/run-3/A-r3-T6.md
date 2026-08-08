---
kind: eval-artifact
run: 3
variant: A
replicate: r3
task: T6
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It'll speed things up right up until it serves someone else's data to the wrong user. `GET` means "safe to read," it does not mean "safe to share."

The distinction that matters is **shared cache vs. private cache**. A CDN node holds one copy of a response and hands it to everyone who asks for that URL. So the question for each endpoint isn't "is this a GET," it's "would I be comfortable if a stranger got this exact bytes back?"

The endpoints where blanket caching goes wrong:

- **Anything personalized.** `GET /api/me`, `/api/cart`, `/api/notifications`. Same URL, different answer per user — the response varies by `Authorization` or cookie, not by path. First user to hit it populates the cache; everyone after gets their profile. This is the one that turns into an incident report.
- **Anything permission-filtered.** `GET /api/documents` returns different rows for an admin than for a viewer. Same failure mode, more subtle, because the URL genuinely looks generic.
- **Anything fast-moving.** Inventory counts, prices, order status, feature flags. Caching works fine here; what bites you is the *invalidation*, and a stale price is a support ticket or worse.

The rule of thumb I'd use: **cache by what the response depends on, not by HTTP verb.**

- Truly public and identical for everyone — product catalog, static config, published content — `Cache-Control: public, max-age=300, s-maxage=3600`. Great CDN candidate, do it.
- Per-user — `Cache-Control: private, max-age=60` (browser may cache, CDN must not), or `no-store` if it's sensitive. `private` is the keyword that keeps it out of the shared cache.
- Anything in between — needs a per-endpoint decision, not a default.

A few specifics worth knowing before you turn anything on:

**`Vary` is not the escape hatch you'd hope.** `Vary: Authorization` is technically correct — it tells the CDN to key the cache by that header — but with per-user tokens your hit rate goes to roughly zero and you've added complexity for no speedup. And if you ever *miss* a `Vary` header the response actually varies on, that's exactly the leak.

**The safe default is opt-in.** Set `Cache-Control: no-store` (or `private`) at the framework level and let individual endpoints opt into public caching explicitly. If a new endpoint ships without anyone thinking about caching, the failure mode should be "slower than it could be," not "leaked."

**Have an invalidation story before you cache.** Purge-on-write, or short TTLs plus `stale-while-revalidate`, or content-hashed URLs. "We'll figure it out" turns into a 24-hour stale response and a manual purge at 2am.

Realistically, if you profile it, most of the win is in a small number of high-traffic public endpoints. I'd start by finding those in your access logs, cache them properly, and leave the authenticated surface alone.

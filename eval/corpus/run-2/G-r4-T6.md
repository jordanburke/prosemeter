---
kind: eval-artifact
run: 2
variant: G
replicate: r4
task: T6
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will speed some things up and leak private data. GET does not mean cacheable, and a shared cache is the dangerous place to learn that.

The problem is the word "shared." A shared cache stores one copy and serves it to everyone. So `GET /api/me` gets cached from the first user who calls it, and the next user gets that person's profile. Same for `/api/cart`, `/api/notifications`, and anything else that varies by who is asking. This is a real and common breach, not a theoretical one.

Sort your endpoints into three buckets before you cache anything.

**Public and identical for everyone.** Product listings, docs, config, static assets. Cache these in the CDN, set a long TTL, and you get the speedup you are after.

**Per-user.** Anything reading a session or token. Mark these `Cache-Control: private, no-store` so the CDN never holds them. A browser cache is fine; a shared one is not.

**Public but changing.** Prices, stock counts, feeds. Cache with a short TTL, or use `stale-while-revalidate` so users get an instant stale response while the CDN refreshes behind them.

Two more traps.

**GET can still have side effects in practice.** Plenty of codebases have a `GET /api/track/view` or a GET that bumps a counter. Cache it and the side effect stops firing. Grep for writes inside GET handlers before you flip anything on.

**`Vary` is easy to get wrong.** If a response differs by `Accept-Language` or `Authorization`, the CDN needs `Vary` on that header or it serves the wrong variant. `Vary: Authorization` on a per-user endpoint technically works but gives you a cache entry per token, so you get the risk with none of the hit rate. Use `private, no-store` instead.

What I would do: pick the five highest-traffic public endpoints and cache those first. That is where most of the win lives, and it carries almost no risk. Then measure. Blanket-caching everything trades a large, quiet security hole for a speedup you have not confirmed you need.

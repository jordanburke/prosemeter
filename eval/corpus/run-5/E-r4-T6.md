---
kind: eval-artifact
run: 5
variant: E
replicate: r4
task: T6
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will speed things up and it will leak private data between users. Do not cache every GET. Cache the GETs that return the same bytes to everyone.

The danger sits in the word "shared." A shared cache serves one stored response to many people. If a GET returns something specific to the caller — the logged-in user's profile, their cart, their notifications, their search history — the first user's response gets stored and handed to whoever asks next. That is not a slow bug. It shows up in production within minutes of the first real traffic.

The method tells you nothing about safety. `GET` means the request does not change server state. It does not mean the response is the same for everyone.

Sort your endpoints into three buckets.

**Public and stable.** Static assets, product catalogs, published articles, public API reference. Cache these hard in the CDN, with a long `max-age` and content hashes in the URL so a new version gets a new path.

**Public but changing.** Prices, stock counts, leaderboards, feed pages. Cache with a short TTL, or cache long and purge on write. Add `stale-while-revalidate` so users get a fast response while the CDN refreshes behind them.

**Private.** Anything shaped by who is asking. Mark these `Cache-Control: private, no-store`. The browser may keep them; the CDN must not.

Get the headers right, because the default is the risky direction.

- Send `Cache-Control: private` on every authenticated response. Most CDNs honor it and skip storing.
- Send `Vary: Authorization` where a path serves both public and private variants, so a response cached for one identity is not reused for another. Better still, put private data on separate paths and skip the variant problem.
- Never let a proxy default decide. Set the header explicitly on every route, including error responses. A cached 500 or a cached 302 to a login page is its own outage.

Two more traps.

**Personalization hides in odd places.** Localized currency, A/B test buckets, feature flags, and locale-based content all vary per user without looking private. Each needs a `Vary` header or a distinct URL.

**Invalidation is the hard part.** Decide up front how a cached object gets purged when the data changes. Short TTLs are the simple answer and cost you hit rate. Purge-on-write is better and needs your write path to call the CDN API.

So tell your teammate: yes to a CDN, no to a blanket rule. Start with static assets and genuinely public endpoints, measure the hit rate, and expand from there.

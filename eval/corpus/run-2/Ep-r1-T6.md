---
kind: eval-artifact
run: 2
variant: Ep
replicate: r1
task: T6
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
That will leak user data. A shared CDN cache stores one copy of a response and serves it to everyone who asks for the same URL. Cache `GET /api/me` and the second user gets the first user's profile.

The problem is that `GET` means "safe to repeat", not "same for everyone". Plenty of GET endpoints return per-user data: account settings, cart contents, permission-filtered lists, anything shaped by the session. The CDN keys on the URL, not on the `Authorization` header or session cookie, so it cannot tell those users apart. Every one of these is a breach waiting on a cache hit.

Split the endpoints into three groups.

**Public and shared** — product catalog, pricing tiers, static config, published content. Cache these in the CDN, and this is where the real speedup lives. Use `Cache-Control: public, max-age=...` plus `stale-while-revalidate` so users get an instant response while the CDN refreshes behind them.

**Per-user** — anything that varies by who is asking. Mark these `Cache-Control: private, no-store`. `private` alone still permits the browser to cache it, which is usually fine; add `no-store` for anything you would not want sitting on disk. Set this as the framework default so a new endpoint is safe until someone deliberately opens it up.

**Varies by something other than identity** — locale, currency, device class. These can be shared, but only among users who match. Set `Vary` on the header that drives the difference, or better, put the dimension in the URL path. `Vary` is fragile in practice; CDNs handle it inconsistently, and a broad `Vary: Accept-Encoding, Cookie` fragments your cache until the hit rate collapses.

Two more things before you ship this:

- **Check freshness requirements.** An endpoint that is technically public but must reflect a change immediately — inventory counts, live scores — needs a short TTL and a purge on write, not a long `max-age`.
- **Verify what your origin sends today.** Many frameworks send no `Cache-Control` at all, and the CDN then applies its own default. That default is what makes this a footgun, so audit the current headers before you point traffic at a cache.

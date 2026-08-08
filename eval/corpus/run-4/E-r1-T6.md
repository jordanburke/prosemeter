---
kind: eval-artifact
run: 4
variant: E
replicate: r1
task: T6
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Caching every GET in a shared cache will leak one user's data to another. Please don't ship that as written.

The problem is "shared." A CDN keys entries on the URL, not on who asked. `GET /api/me` returns Jordan's profile, the CDN stores it, and the next person to hit that URL gets Jordan's profile back. Same for `/api/orders`, `/api/notifications`, and anything else that varies by session. The method being GET says the request is safe, not that the response is public.

`Vary: Authorization` or `Vary: Cookie` looks like the fix and mostly isn't. Cookie values differ per user, so the hit rate collapses to zero and you get the risk without the speedup. Some CDNs also normalize or ignore `Vary` on cookies entirely.

Here's what I'd do instead. Split the endpoints into three buckets:

- **Public and shared** — reference data, product catalogs, config, static content. Cache these at the edge with a long `s-maxage` and `stale-while-revalidate`. This is where the win is.
- **Private per-user** — anything behind auth. Mark them `Cache-Control: private, no-store` so the CDN never touches them. Cache them in a per-user layer instead: Redis keyed by user ID, or the browser's own cache.
- **Never cache** — anything with a token, a signed URL, or a one-time value in it.

Then set the default to `no-store` and opt endpoints in one at a time. Defaults decide what happens to the endpoint someone adds next month, and the safe default is not caching.

Two more things once you start. You need a way to purge or version keys, because a wrong response cached for a day is much worse than a slow one. And measure first — if the latency is coming from a slow database query, edge caching hides it for the cached paths and leaves the origin just as saturated underneath.

---
kind: eval-artifact
run: 4
variant: Et
replicate: r2
task: T6
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Do not do it as a blanket rule. A shared cache in front of every GET will serve one user's data to another user.

Here is the failure. Your `/api/me` endpoint is a GET. The CDN caches the first response it sees and hands that same body to the next request for the same URL. The URL carries no identity — the identity lives in a cookie or an `Authorization` header, and a shared cache keys on the URL. So user A's profile goes to user B. It is a real breach, it is silent, and you find out from a support ticket.

Two more problems come along with it:

- **Invalidation.** Once a stale response is in a hundred edge nodes, you need purge to get it out. If your CDN keys purge by URL only, you will be purging paths you cannot enumerate.
- **GETs with side effects.** Most codebases have one or two — a tracking pixel, a "mark as read", a token refresh. Caching those quietly turns them off.

**The approach that works** is opt-in, not opt-out.

1. Set `Cache-Control: no-store` as the default for every API response. Do it in one place, in middleware.
2. Go through the routes and find the ones whose response depends on nothing but the URL. Public catalogs, config, static reference data. Usually a short list.
3. Give those `Cache-Control: public, s-maxage=300, stale-while-revalidate=60`. `s-maxage` applies to the shared cache and leaves the browser alone. `stale-while-revalidate` keeps latency flat while the edge refetches.
4. For anything user-specific that you still want cached, use `private` so only the browser holds it, never the CDN.
5. Set `Vary` honestly on anything that varies by header, and treat `Vary: Cookie` as a sign the response should not be in a shared cache at all.

If your CDN supports surrogate keys — Fastly, Cloudflare with cache tags — tag responses by entity so you can purge everything touching a product in one call. Without that, plan your TTLs to be short enough that staleness is survivable, because purge will not save you.

Measure first, though. If the slowness is database time on authenticated reads, a CDN does not touch it and you want caching closer to the data.

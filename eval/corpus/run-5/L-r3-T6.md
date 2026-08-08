---
kind: eval-artifact
run: 5
variant: L
replicate: r3
task: T6
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will speed things up and it will also leak private data between users, because a shared cache does not know that a `GET` was personalized. Cache the endpoints that return the same bytes to everyone. Never cache the ones whose response depends on who is asking.

Here is the danger. A shared CDN cache stores one copy of a response and hands it to whoever asks for that URL next. `GET /api/me` returns Alice's profile. The CDN stores it. Bob requests the same URL and gets Alice's profile. Nothing in HTTP prevented that, because the URL was identical and your response did not say otherwise. This class of bug has hit real companies and it is the reason the blanket rule is wrong.

Three properties decide whether a `GET` is safe to cache publicly.

**Is the response the same for every user?** A product catalog, a blog post, a public price list, a static config — yes. Anything reading a session, a cookie, or an `Authorization` header — no.

**Is it safe when slightly stale?** A category listing tolerates a minute of staleness. An account balance or an inventory count during a flash sale does not.

**Is the `GET` actually a read?** Some endpoints named `GET` mutate state — a counter, a "mark as seen", a tracking pixel. Caching them silently breaks the behavior, because the origin stops seeing the request at all.

Say the safe cases explicitly. `Cache-Control: public, max-age=300, s-maxage=600` lets shared caches hold it. Add `stale-while-revalidate=60` and the CDN serves the stale copy instantly while it refreshes in the background, which gives you the latency win without a cliff at expiry.

Say the unsafe cases explicitly too. Personalized responses need `Cache-Control: private, no-store`. Do not rely on the CDN guessing from the presence of a cookie — some do, some do not, and defaults change.

Two more mechanisms matter.

**`Vary`.** If a response differs by `Accept-Language` or `Accept-Encoding`, list those headers in `Vary` so the CDN keys the cache on them. Do not use `Vary: Cookie` as your privacy control; cookie strings are near-unique per user, so your hit rate collapses to nothing and you have paid for a cache that never hits.

**Invalidation.** A five-minute TTL means a content fix takes five minutes to appear, or you purge. Decide up front which you want, and wire a purge call into whatever publishes content. Content-hashed URLs sidestep the whole problem for static assets: change the bytes, change the URL, cache forever.

So the shape to propose instead: default to `no-store`, then opt endpoints in one at a time, starting with the ones that are both public and hot. Verify each with a real check — request it with two different sessions and confirm the bodies differ and the `Age` header behaves as expected. Add a CI test that fails if an authenticated response ever comes back with `public` in `Cache-Control`.

That gets your teammate most of the speed, with a blast radius you can reason about.

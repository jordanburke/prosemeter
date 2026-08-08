---
kind: eval-artifact
run: 4
variant: A
replicate: r2
task: T6
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It'll speed things up right up until it leaks one user's data to another user, which is the failure mode you really don't want to discover in production.

The problem: a shared CDN cache is keyed on URL, not on identity. `GET /api/me` returns different bytes for every logged-in user, but the CDN sees one URL. First user to hit a cold edge node populates it, and everyone else routed to that node gets that user's profile back. Same for `/api/cart`, `/api/notifications`, anything scoped to the caller. That's a real incident, not a theoretical one — it's happened to plenty of companies with more CDN experience than us.

So the split I'd draw isn't "GET vs non-GET," it's **who is this response for**:

**Safe to cache shared** — same bytes for every caller. Static assets, public product pages, marketing content, published articles, config that isn't tenant-scoped. Give these long TTLs and be aggressive.

**Never cache shared** — anything derived from the session, an auth token, or a tenant ID. These need `Cache-Control: private, no-store`, or `private, max-age=N` if browser-local caching is acceptable. `private` is the keyword that tells shared caches to keep out.

**Cacheable with care** — responses that vary on a small, enumerable dimension like locale or currency. `Vary` handles this, but be careful: `Vary: Authorization` technically works and in practice destroys your hit rate, since every distinct token is its own cache entry. At that point you're paying CDN cost for a near-zero hit rate.

Two more things that bite people:

**Staleness.** Once something is at the edge with a long TTL, it's there until it expires. If a user edits their profile and the old version is cached for an hour, that reads as a bug and generates support tickets. You want purge-on-write wired up before you turn caching on, and most CDNs support surrogate keys / cache tags so you can invalidate by entity rather than by URL.

**GET isn't automatically safe.** Some of our GET endpoints have side effects — anything that bumps a counter, marks-as-read, or writes an audit row. Caching those silently stops the side effect from happening, and the symptom shows up somewhere completely unrelated.

My suggestion: don't do it blanket. Pull the top endpoints by request volume, and for each one ask "is this response identical for all callers?" You'll probably find a small number of public endpoints that account for most of the traffic, cache exactly those, and get most of the benefit with none of the risk. If reads on authenticated endpoints are the actual bottleneck, the right tool is a server-side cache keyed by user ID — Redis in front of the DB — not a shared edge cache.

Happy to go through the endpoint list with you if you want to pick the safe set.

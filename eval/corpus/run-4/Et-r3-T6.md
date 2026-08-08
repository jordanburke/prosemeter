---
kind: eval-artifact
run: 4
variant: Et
replicate: r3
task: T6
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Not every GET. Cache the ones that are the same for everybody, and you get a real speedup. Cache the ones that vary per user, and a shared CDN will serve one person's data to the next person who asks.

**The dangerous case.** `GET /api/me` returns your profile. The CDN stores it under the URL. The next user hits the same URL, the edge has a hit, and they get your profile. The response was personal but the cache key was not. Auth headers and cookies are not part of the key unless you make them part of it.

**What is safe to cache at the edge:**

- Static assets with hashed filenames — cache these forever.
- Public reference data: product catalogs, docs, config, feature flags for anonymous users.
- Anything whose response is a pure function of the URL.

**What is not:**

- Anything behind auth.
- Anything that varies by cookie, session, tenant, locale, or role.
- Anything that returns different data based on a header the CDN ignores.

**How to draw the line in practice.** Default to `Cache-Control: private, no-store` and opt endpoints in, rather than caching everything and hunting leaks. For the personal ones you still want cached, use `private, max-age=N` — that permits the browser cache and forbids the shared one. That gets most of the win with none of the leak risk.

If you genuinely need shared caching of varying responses, the cache key has to include what it varies on. `Vary: Accept-Encoding` is fine. `Vary: Cookie` technically works and in practice destroys your hit rate, since every distinct cookie value is its own entry. Better to move the varying part into the path or a query param.

**The second problem: staleness.** A CDN with a long TTL will keep serving a deleted record. Decide the invalidation story per endpoint before you turn caching on — purge on write, short TTL, or `stale-while-revalidate`.

**Where I would start.** Find your top ten GET endpoints by volume. Sort them into public and personal. Cache the public ones aggressively and measure. That is probably 80% of the traffic and none of the risk.

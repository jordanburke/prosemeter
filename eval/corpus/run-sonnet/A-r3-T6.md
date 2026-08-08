---
kind: eval-artifact
run: sonnet
variant: A
replicate: r3
task: T6
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Not as a blanket policy — it'll work for some endpoints and break others, and the failure mode is data leaking between users.

A CDN cache is shared across everyone hitting it. That's fine for a GET that returns the same response to any caller — a public product listing, a static config, a marketing page. It's a serious bug for a GET that returns anything scoped to the requester — `/me`, `/orders`, `/dashboard`, anything gated by an auth header or session. Cache the first user's response, and the CDN will happily serve it to the next user who hits the same URL, cookie or auth header ignored, because the CDN doesn't know your app's authorization rules.

Even for endpoints that are safe to share, you still have to decide:

- **How stale is acceptable?** A TTL that's too long serves outdated data; too short and you're barely caching anything.
- **How does it invalidate on write?** If the underlying data changes, the cached GET needs to expire or be purged — otherwise you've traded slowness for wrongness.
- **What varies the response?** Locale, currency, feature flags — anything that changes the body needs a `Vary` header, or those variants collide into one cached entry.

So the real approach: go endpoint by endpoint, not blanket. Cache the ones that are public, non-personalized, and genuinely slow, with explicit `Cache-Control` and `Vary` headers and a real invalidation story. Leave anything user-scoped out of the shared cache entirely — if it needs speeding up, that's a job for a per-user cache (browser, or a keyed server-side cache), not a CDN.

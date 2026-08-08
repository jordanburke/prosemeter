---
kind: eval-artifact
run: 2
variant: E
replicate: r2
task: T6
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Caching every GET in a shared cache will leak one user's data to another. GET does not mean public. Any endpoint returning per-user data — `/api/me`, `/api/cart`, a search scoped to the caller's org — gets stored on the first request and served to the next person who asks. That is a serious bug, not a slow rollout.

The split is by who the response belongs to, not by HTTP method.

**Safe for the shared cache:** responses identical for everyone. Product catalogs, public content, config, static assets. Mark them `Cache-Control: public, max-age=...`.

**Never in a shared cache:** anything varying by user, session, or auth token. Mark them `Cache-Control: private, no-store`, and make that the default so a new endpoint is safe until someone deliberately opts it in.

If you do cache authenticated responses, the cache key has to include what the response varies on. `Vary: Authorization` handles the header, but it also drops your hit rate to near zero, because each user gets their own entry. At that point the CDN buys you little and you would do better with a per-user cache close to the app.

Two more things that bite:

- **Cache keys ignore query strings by default on some CDNs.** Check that, or `/search?q=a` and `/search?q=b` return the same thing.
- **Invalidation is the hard part.** Decide up front how a changed record clears its cached copies. Short TTLs plus `stale-while-revalidate` avoid most of it and are usually enough.

Before any of this, measure. If the latency is coming from a slow database query or an N+1 in the API, a CDN just serves the slow response faster to the second caller. Profile one slow endpoint first and see what the time actually goes to.

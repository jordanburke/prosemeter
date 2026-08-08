---
kind: eval-artifact
run: 3
variant: E
replicate: r4
task: T6
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Caching every GET in a shared cache will leak user data. A shared cache stores one copy per URL and hands it to everyone. The moment a GET returns something personal, the first user's response goes to the next user who asks.

`GET /api/me` is the obvious one. `GET /orders` scoped to the session is the same bug wearing different clothes.

The dividing line is who the response belongs to, not the HTTP verb:

- **Same for everyone** — product catalogs, static assets, public pages. These are safe for `Cache-Control: public, max-age=...` in a shared cache.
- **Specific to a user** — anything shaped by a session cookie or auth header. These need `Cache-Control: private, no-store`, and the CDN must never hold them.

Two more traps once you start:

**Vary is not a safety net.** `Vary: Authorization` looks like it partitions the cache per user, but CDNs treat `Vary` inconsistently, and a request with no auth header can still collide with a cached one. Do not lean on it for anything sensitive.

**Stale data is its own problem.** A GET can be public and still change often. Cache it too long and users see yesterday's prices. Use short TTLs with `stale-while-revalidate`, or key the URL on a content hash so a change makes a new URL.

Start narrow. Pick the handful of endpoints that are genuinely public and genuinely hot, cache those, and default everything else to `private`. Getting this wrong once means a user seeing another user's account page, and that is not a bug you get to fix quietly.

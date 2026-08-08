---
kind: eval-artifact
run: 2
variant: Ep
replicate: r4
task: T6
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will speed up some endpoints and leak user data on others. `GET` means "does not change anything," not "is the same for everyone."

The danger is any `GET` whose response depends on who is asking. `/api/me`, `/api/cart`, `/api/notifications`, anything scoped by a session cookie or a bearer token. A shared cache keys on the URL. User A requests `/api/me`, the CDN stores that response, and user B requests the same URL and gets A's data. That is the whole failure, and it is not a rare edge case — it is what happens the second two logged-in users hit the same path.

**Split by audience, not by method:**

- **Public and identical for everyone** — product catalog, static config, published content. Cache these in the CDN. This is the real win.
- **Per-user** — mark `Cache-Control: private, no-store`. `private` allows the browser to cache it but forbids the CDN. Use `no-store` for anything sensitive.
- **Public but varies by header** — locale, currency, device. These need a correct `Vary` header, and `Vary: Cookie` on a site that sets a cookie for every visitor gives you a cache hit rate near zero. Move the varying part into the URL instead.

Then check freshness. A CDN will serve stale data for the full TTL, so an endpoint that must reflect a write within seconds needs a short TTL or an explicit purge on write. `stale-while-revalidate` is the usual middle ground: serve the cached copy, refresh in the background.

Two things to verify before you turn it on. Confirm your CDN is not configured to strip `Set-Cookie` and cache the rest — some do that by default, and it turns a per-user response into a shared one. And confirm your origin sets explicit `Cache-Control` on every route, because a CDN applying a default TTL to unlabeled responses is how the accidents happen.

My suggestion: start with an allowlist of paths you have checked, not a blanket rule with exceptions. Exceptions get forgotten, and the failure mode here is one user seeing another user's account.

---
kind: eval-artifact
run: 2
variant: G
replicate: r2
task: T6
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Caching every GET in a shared CDN will leak user data. A shared cache stores one copy per URL and serves it to everyone. Any GET that returns something specific to the caller will get handed to the next person who asks for the same URL.

The classic version of this bug is `/api/me` or `/api/account`. User A calls it, the CDN stores A's profile, user B calls it and sees A's data. Same URL, different user, one cached copy. Auth headers do not save you, because a shared cache keys on the URL, not on who asked.

So the rule is: cache by what the response depends on, not by the HTTP verb.

**Safe to cache in a shared CDN:**

- Static assets with hashed filenames. Give these a long `max-age` and `immutable`.
- Public data that is the same for everyone: product listings, docs, public profiles, config.
- Anything where the URL fully determines the response.

**Not safe:**

- Anything that varies by user, session, cookie, or auth token.
- Anything that varies by role or permission, even if the URL looks public. A GET on `/api/documents/42` may return the doc for one user and a 403 for another.
- Anything that varies by locale or region unless that is in the URL or handled by `Vary`.

Mark the private ones explicitly with `Cache-Control: private, no-store`. Do not rely on the default. Many CDNs will cache a response with no cache headers at all, using their own heuristics, which is how this bug usually ships.

If a response varies on a header, say so with `Vary`. But be careful: `Vary: Cookie` in practice means no cache hits, because every user has a different cookie. That is correct and useless at the same time. The better move is to make the variation part of the URL, or to not cache that route.

The other half of the problem is invalidation. Once a response is in a hundred edge nodes, you cannot easily take it back. Short TTLs are the simple answer. `stale-while-revalidate` is the better one, because it serves the cached copy instantly while it fetches a fresh one behind the scenes.

What I would do:

1. Default everything to `no-store`.
2. Opt specific public routes into caching, one at a time.
3. For each one, ask "would it be fine for any stranger to see this exact response?" If the answer is not an immediate yes, leave it out.

There is also a real win available with far less risk: cache the static assets and the bundle aggressively. That is usually where the page-load time actually goes. Per-user API responses are better served by a cache keyed on the user, either in your own service or in the browser via `Cache-Control: private`.

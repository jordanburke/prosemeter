---
kind: eval-artifact
run: 2
variant: G
replicate: r3
task: T6
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Do not do this. Caching every GET in a shared cache will leak one user's data to another user, and that is a breach, not a bug.

The problem is the word **shared**. A CDN cache stores one response per URL and serves it to everyone who asks for that URL. `GET /api/me` returns Alice's profile. Alice's response gets cached. Bob requests the same path and gets Alice's profile back. The CDN has no idea the response depended on a cookie or an auth header, because you did not tell it.

Anything scoped to a user is unsafe here — profiles, carts, order history, notifications, permission checks, anything behind a login.

**What is actually safe to cache in a shared cache:**

- Static assets with hashed filenames.
- Public reference data — country lists, product catalogs, published articles.
- Responses that are identical for every caller, signed out or signed in.

That is the test. **If two different users can get two different bodies from the same URL, it does not belong in a shared cache.**

**If you want to cache anyway, do it right:**

1. Mark every user-scoped response `Cache-Control: private, no-store`. `private` allows the browser to cache it and forbids the CDN. Set this as the default and opt in to public caching, not the other way round.
2. Use `Cache-Control: public, max-age=...` only on the responses you have checked by hand.
3. Set `Vary: Authorization` where a response really does differ by caller — but treat it as a backstop, not the plan, because it shreds your hit rate and some CDNs handle it poorly.
4. Watch out for `Set-Cookie` on a cacheable response. Cache that and you hand one user's session to everyone else.

**Second problem, less scary but more common.** Not every GET is safe to serve stale. Inventory counts, prices, and live status will go wrong if they sit in a cache for ten minutes. Pick a TTL per endpoint based on how stale the data may be, and set up a way to purge on write.

**What I would suggest.** Find the top endpoints by request volume first. Some of them are probably public and hot, and caching those three or four gets you most of the speedup with none of the risk. Then look at whether the slowness is really network latency at all — if the server takes 800ms to build the response, a CDN hides that from repeat visitors and does nothing for the first one.

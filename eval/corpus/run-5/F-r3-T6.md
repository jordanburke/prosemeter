---
kind: eval-artifact
run: 5
variant: F
replicate: r3
task: T6
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
## Will caching every GET in a shared CDN cache work?

No. Some GETs will get much faster, and some will leak one user's data to another user. The method tells you a request is safe to repeat; it does not tell you the response is the same for everyone.

A shared cache sits between your users and your servers. It stores one copy of a response and hands that copy to everyone who asks for the same URL. "Shared" is the whole point and the whole danger: the copy is not per-user unless you make it so.

Split your GET endpoints into two piles before you cache anything.

**Safe to cache in a shared cache.** The response depends only on the URL. A product page, a public article, a price list, a JavaScript bundle. Two different users asking for the same URL should get the same bytes.

**Not safe.** The response depends on who is asking. `/api/me`, `/api/cart`, `/api/orders`, a dashboard, anything that reads a session cookie or an `Authorization` header. Cache one of these in a shared cache and the first user's response gets served to the second. That is a data breach, not a performance regression.

## How does the cache know which is which?

You tell it, with the `Cache-Control` response header. It has no other way to know.

- `Cache-Control: public, max-age=300` — any cache may store this for 5 minutes.
- `Cache-Control: private, max-age=60` — the user's own browser may store it; a shared cache may not.
- `Cache-Control: no-store` — nobody stores it.

Default every authenticated endpoint to `private` or `no-store`, then opt individual public endpoints into `public`. Opting in is safe to get wrong; opting out is not.

Most CDNs will not cache a response that carries a `Set-Cookie` header, and many skip requests carrying an `Authorization` header. Treat that as a backstop, not a design. The behaviour differs by vendor and by configuration, and a config change can silently remove your only protection.

## What else varies besides the user?

Anything the response depends on that is not in the URL. Each one is a way to serve the wrong copy.

The `Vary` header names the request headers the cache must also match on. `Vary: Accept-Encoding` keeps a gzip response away from a client that cannot read it. `Vary: Accept-Language` keeps the French copy away from English readers.

Use `Vary` carefully. Each header you add multiplies the number of stored copies, and `Vary: User-Agent` effectively disables caching, because there are thousands of distinct user-agent strings. If a response varies by user, do not solve it with `Vary: Cookie` — mark it `private` instead.

Query strings are part of the URL, so `?page=2` caches separately from `?page=3`. That is right. It also means tracking parameters like `utm_source` split your cache into many copies of one page. Strip them at the CDN.

## What breaks after you turn it on?

Stale data, and it is the complaint you will actually get.

A cached response lives until it expires. Update a price and users keep seeing the old one for the rest of the `max-age`. Two habits keep this manageable:

- **Version the URL for anything you can rename.** Static assets built with a content hash in the filename can carry a one-year `max-age`, because a change produces a new URL. The old copy is never wrong; it is just never requested again.
- **Purge on write for anything you cannot.** Every CDN has a purge API. Call it from the code path that changes the data, so the cache clears when the content does.

Two headers earn their keep here. `stale-while-revalidate` lets the CDN serve the slightly-stale copy and fetch a fresh one in the background, so nobody waits. `ETag` lets the CDN revalidate cheaply — it sends the tag, and your server replies `304 Not Modified` with no body when nothing changed.

## Is the speedup worth it?

For public, high-traffic, read-heavy endpoints, yes — the CDN serves from a location near the user and never touches your origin. That removes both the network round trip and the database query.

For per-user endpoints, the shared cache was never available to you, so the win is not on the table. Look at a per-user cache instead: `private` responses in the browser, or Redis in front of your database.

Start with your highest-traffic public endpoint. Measure the hit rate and the origin load before and after. Then move to the next one. Turning caching on everywhere at once means that when something serves the wrong data, you will not know which change did it.

---
kind: eval-artifact
run: 5
variant: L
replicate: r5
task: T6
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Do not do this. A shared CDN cache serves one stored copy to everyone, so any GET that returns per-user data will leak one user's data to another. Cache the endpoints that return the same bytes for every caller, and mark the rest private.

## The core problem

"Shared" is the word that matters. A CDN stores one response and hands it to every request that matches the cache key — usually just the method and the URL.

So `GET /api/me` gets stored once. The first user to hit that path fills the cache. Every user after them gets that person's profile, name, and email. The request carried a different session cookie, but the cache key did not include it, so the CDN never looked.

This is not a rare edge case. It is the most common way user data leaks through a CDN, and it has hit large companies in public incidents.

## GET does not mean cacheable

GET means the request does not change server state. It says nothing about whether the response is the same for everyone.

Sort your GET endpoints into three groups.

**Same for everyone, changes rarely.** Product catalogs, static config, public article bodies, assets. Cache these hard at the edge. This is where the speed-up you want actually lives.

**Same for everyone, changes often.** Stock levels, live scores, feeds. Cache these with a short TTL, or with stale-while-revalidate so users get an instant response while the edge refreshes behind them.

**Different per user.** Anything behind a login that reflects identity — cart, profile, orders, permissions, personalized results. Never store these in a shared cache.

## The headers that enforce it

Mark private responses explicitly. Do not rely on the CDN guessing.

```
Cache-Control: private, no-store
```

`private` tells shared caches to stay out while still allowing the browser's own cache. `no-store` means nobody keeps a copy.

For public content, be explicit about both audiences:

```
Cache-Control: public, max-age=60, s-maxage=3600
```

`max-age` governs browsers, `s-maxage` governs the CDN. Splitting them lets you hold content at the edge far longer than in browsers you cannot purge.

If a response varies by a request header, say so:

```
Vary: Accept-Language, Accept-Encoding
```

`Vary` adds that header to the cache key. Do not try `Vary: Cookie` as a way to make per-user responses safe — cookie strings differ on nearly every request, so your hit rate collapses to zero and you get the risk without the speed.

## Two failure modes beyond the leak

**Stale data users cannot escape.** A user updates a setting, the page still shows the old value, and refreshing does not help because the edge copy has an hour left. Plan for purging before you set a long TTL, and prefer versioned URLs for content you cannot purge.

**Cached errors.** A 500 or a 401 stored at the edge is served to healthy requests for the life of the TTL. Set the error paths to `no-store` in your framework's default.

## What I would do

Set a safe default. Make every response `Cache-Control: private, no-store` unless a handler opts in. That way a new endpoint is never accidentally public.

Then pick your three or four highest-traffic public endpoints, measure their current latency, cache those, and measure again. You will get most of the win from a small list, and you will get it without putting user data on the edge.

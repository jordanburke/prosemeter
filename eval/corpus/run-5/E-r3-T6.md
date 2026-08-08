---
kind: eval-artifact
run: 5
variant: E
replicate: r3
task: T6
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will speed the app up and it will leak private data between users. The rule your teammate is reaching for — GET is safe to cache — is about the HTTP method, not about who is allowed to see the response. A shared cache stores one copy per URL and serves it to everyone who asks for that URL.

Picture the failure. Alice requests `/api/me`. The CDN caches her profile under that URL. Bob requests `/api/me` a second later, the CDN sees a hit, and Bob gets Alice's name, email, and account id. No code was wrong. The cache did exactly what it was told.

Three properties separate an endpoint that is safe to cache in a shared cache from one that is not.

The response must not vary by user. Anything that reads a session cookie, an auth header, or a tenant id returns different bytes for different callers under the same URL. Those belong in a private cache, so send `Cache-Control: private, no-store` and let the browser hold them, not the CDN.

The response must tolerate being stale. A product catalog can be a minute old. An account balance, an inventory count during checkout, or a feature-flag payload cannot. Staleness tolerance is a product decision, not an infrastructure one, so ask the person who owns the feature.

Every input must be in the cache key. A CDN keys on URL by default. If your response depends on an `Accept-Language` header, an `Accept` header, or a geo lookup, you must declare that with `Vary` or add it to the cache key explicitly. Otherwise the first caller's variant is served to everyone.

Some GETs are not even safe to cache once. A GET that writes — increments a view counter, issues a token, marks something read — breaks when the cache absorbs the request and the origin never sees it. If you have those, that is a separate bug worth fixing regardless.

Here is what to do instead of caching everything.

Split the routes. Put public, cacheable data on its own paths, and keep per-user data on paths the CDN is configured never to store. A path split is easier to reason about and to audit than a header rule scattered across handlers.

Set headers explicitly on every endpoint. Default to `private, no-store`, and opt specific routes into `public, max-age=N, s-maxage=N`. A default of "cache unless told otherwise" fails open, which is the wrong direction for a leak.

Use `stale-while-revalidate` on the cacheable ones. It serves the cached copy instantly and refreshes in the background, which gets most of the speed with a much smaller staleness window.

Add ETags. Even an uncacheable response can return `304 Not Modified`, which saves the bytes without saving the body anywhere shared.

One last thing. Before doing any of this, find out where the time actually goes. If your slow pages are slow because of a database query without an index or a waterfall of sequential requests, a CDN in front of it hides nothing and you will have taken on the leak risk for no gain.

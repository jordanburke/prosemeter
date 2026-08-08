---
kind: eval-artifact
run: 5
variant: F
replicate: r5
task: T6
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
## Will caching every GET endpoint in a shared CDN cache speed the app up?

It will speed up some endpoints and leak user data on others. The plan is right about the mechanism and wrong about the scope.

A shared cache is one a CDN keeps on behalf of every visitor. One response gets stored and handed to everyone who asks for the same URL. That is where the speed comes from — the second request never reaches your servers.

It is also where the danger comes from. If the response depends on who is asking, the first user's data goes to the second user. `GET /api/me` returns Alice's profile, the CDN stores it under that URL, and Bob gets Alice's profile. No error appears anywhere. You find out from a support ticket.

The trap is that `GET` means "does not change anything," not "is the same for everyone." Those are separate properties, and only the second one makes a response cacheable in a shared cache.

## Which GETs are actually safe?

The ones where the URL fully determines the response.

Static assets qualify — scripts, styles, images, fonts. So does public reference data: a product catalog, a docs page, a list of countries, a price list. Anything anonymous users see identically.

Anything shaped by a cookie, an `Authorization` header, or a session does not qualify. Mark those `Cache-Control: private, no-store` so no shared cache touches them. `private` means a browser may keep its own copy but a CDN may not.

The middle case needs care. If a response varies by language or region, add `Vary: Accept-Language` so the CDN keys the cache on that header as well as the URL. `Vary` on a header with many distinct values, like `User-Agent`, splits the cache so finely that almost nothing hits.

## What else breaks?

Stale data, and it is worse than it sounds.

Once a CDN stores a response with a one-hour lifetime, that hour is a promise you cannot take back by deploying. Users see old data until it expires. Plan for this in two ways. Give assets immutable names — a content hash in the filename — so a new deploy is a new URL and nothing is ever stale. And keep lifetimes short for data that changes, then use the CDN's purge API when you need it gone now.

`stale-while-revalidate` is the setting worth knowing. It lets the CDN serve the old copy immediately while fetching a fresh one behind the scenes. Users get cache speed and near-current data.

## What should we do instead?

Cache by policy per route, not by method.

Sort your endpoints into three buckets: public and cacheable, per-user and never shared, and public but changing. Set an explicit `Cache-Control` on each. Make the default `no-store`, so a new endpoint is safe until someone thinks about it — the failure mode of forgetting is then a slow response, not a data leak.

Then check whether caching is even the fix. If your slow endpoints are the personalized ones, none of this helps them, and the real work is in the database or the API. Look at your slowest routes by total time before you build any of it.

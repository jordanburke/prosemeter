---
kind: eval-artifact
run: 5
variant: E
replicate: r2
task: T6
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
No, not every GET endpoint. Caching the public ones in a shared CDN will speed the app up a lot. Caching the personalized ones will serve one user's data to another, which is a security incident, not a performance win.

The split is what "shared" means. A shared cache stores one response and hands the same bytes to everyone who asks for that URL. So the question for each endpoint is whether the response depends on who is asking.

Three groups.

Safe to cache in a shared cache: responses that are the same for everyone. Product catalogs, blog posts, public config, static reference data. These are the real win — the CDN serves them from an edge near the user and your origin never sees the request.

Never cache in a shared cache: responses that vary by user. `/api/me`, cart contents, order history, anything behind a session. Mark these `Cache-Control: private, no-store`. `private` means a browser may cache it but a CDN may not.

The dangerous middle: endpoints that are usually public but sometimes personalized. `/api/products` that shows member pricing when you are logged in. These look cacheable in testing, because you test logged out. Treat them as private until you split the personalized part into its own request.

Two mechanics matter once you have sorted endpoints into those groups.

`GET` being safe and idempotent does not make it cacheable. Those are different properties. HTTP says a GET does not change server state; it says nothing about whether the response is the same for two callers.

The cache key is the URL, and by default nothing else. Two users hitting the same URL with different `Authorization` headers get the same cached entry unless you tell the CDN otherwise. `Vary: Authorization` fixes the correctness problem but usually destroys the hit rate, since every distinct token becomes its own cache entry. Splitting the endpoint is almost always better than varying it.

Then there is staleness, which is the other half of the job. A cached response is a copy that can be wrong. Decide per endpoint how stale is tolerable, and pick a tool to match.

Short TTLs are the simplest answer, and good enough for data that changes slowly.

Versioned or hashed URLs give you infinite TTLs, because a change produces a new URL. This is the right pattern for assets and works for API data whose version you control.

Explicit purges give you freshness on demand, but you have to actually wire the purge into every write path, and the one you forget is the bug.

`stale-while-revalidate` serves the old copy instantly while fetching a new one in the background. It is the best default for read-heavy endpoints that tolerate a few seconds of lag.

Start with the endpoints that are both public and hot — those give you most of the speedup for none of the risk. Before you turn anything on, check that your CDN is not already caching something it should not be, and that error responses are not being cached; a cached 500 with a long TTL takes the app down until it expires.

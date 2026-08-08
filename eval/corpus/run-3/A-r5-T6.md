---
kind: eval-artifact
run: 3
variant: A
replicate: r5
task: T6
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It'll speed things up right up until it leaks one user's data to another user. **GET is safe to cache; it is not automatically safe to cache in a *shared* cache.** Those are different claims and the gap between them is where the incident lives.

The dangerous class is any GET whose response varies by *who is asking*: `/api/me`, `/api/cart`, `/api/notifications`, a dashboard, anything personalized. A shared CDN cache keyed on URL alone will store the first user's response and serve it to everyone else who requests the same path. This is a real and recurring class of outage — it's been the cause of several publicized data exposures at large companies, and it's usually discovered by a customer, not by you.

So the sorting rule isn't the HTTP verb, it's **who the response belongs to**:

**Safe for a shared cache** — responses identical for all callers: product catalogs, public content, config/feature-flag payloads without user targeting, reference data, static assets. These should be cached aggressively and probably already are underused.

```http
Cache-Control: public, max-age=300, stale-while-revalidate=60
```

**Private only** — anything derived from the session, auth token, or cookie:

```http
Cache-Control: private, no-store
```

`private` permits the browser to cache it but forbids shared caches. For genuinely sensitive things, `no-store` and be done.

The other problems even where it's safe by ownership:

- **Staleness and invalidation.** Once it's in a CDN with a 5-minute TTL, an edit takes up to 5 minutes to appear, everywhere, and "it's fixed on my machine but not for the customer" becomes a support category. Have a purge path before you turn caching on, and prefer short TTLs plus `stale-while-revalidate` over long ones.
- **`Vary` is a footgun.** If a response legitimately varies by `Accept-Language` or `Accept-Encoding`, you need `Vary` on those headers — but `Vary: Cookie` in practice means near-zero hit rate (every session cookie is unique), so it looks like a fix while quietly buying you nothing. If you find yourself reaching for `Vary: Cookie`, the honest answer is that response isn't shared-cacheable.
- **GET that isn't actually read-only.** If any endpoint mutates state on GET — it happens, usually a legacy `?action=` route — caching it will make the mutation stop happening intermittently, which is a genuinely miserable bug to chase.
- **Error responses.** Make sure a 500 or an auth failure doesn't get cached and pinned for the TTL.

### What I'd actually propose

Default the whole API to `Cache-Control: private, no-store`, then **opt specific endpoints in** to shared caching after looking at each one. Allowlist, not blanket. It's more work up front and it's the difference between a performance win and a postmortem.

And before doing any of it, check where the time is actually going. If p95 is dominated by one slow database query, edge caching your fast endpoints won't move the number the users feel. Caching is very good at hiding a slow origin — which is useful, and also means it can mask a problem you'd rather fix.

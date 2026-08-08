---
kind: eval-artifact
run: 3
variant: B
replicate: r2
task: T6
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It'll speed things up right up until it serves one user's data to another user. "Every GET" is the part I'd push back on — the method tells you the request is safe to repeat, not that the response is safe to share.

A shared CDN cache stores one response per URL and hands it to everyone who asks for that URL. So the question for each endpoint isn't "is this a GET," it's **"would I be comfortable showing this exact response to a stranger?"** Anything personalized fails that test:

- `GET /api/me` — first user to hit it populates the cache, everyone after gets their profile.
- `GET /api/orders` — same response for every customer.
- Anything where the response varies by session cookie, `Authorization` header, tenant, or role.

That's the serious failure. There's a milder one too: **stale data**. Once a response is in the CDN with a 10-minute TTL, an update to the underlying record doesn't reach users until it expires. Fine for a product catalog, bad for an inventory count or an order status page.

**The split I'd actually make:**

- **Public and identical for everyone** — catalog data, static config, published content, anything you'd serve logged-out. Cache it in the CDN, `Cache-Control: public, max-age=...`. This is where the real win is, and it's usually a small number of high-traffic endpoints.
- **Personalized or authenticated** — mark it `Cache-Control: private, no-store`. `private` means browsers may cache it but shared caches must not. You can still cache these *per user* in the browser or in your app layer; just not in the shared tier.

Two mechanics worth knowing before you turn anything on:

- **`Vary` is not a safety net.** `Vary: Authorization` technically makes the cache key include the token, but it fragments the cache so badly you get near-zero hit rate — and it fails open if any layer drops the header. Don't use it to make private data "safe to cache." Use `private` instead.
- **Prefer `stale-while-revalidate` over long TTLs.** It serves the cached copy instantly while refreshing in the background, so you get CDN speed without a long stale window. Good middle ground for content that changes but not by the second.

My suggestion: list the GET endpoints, mark each one public or private, and start with the public ones that carry the most traffic. You'll get most of the benefit from a handful of routes, and you won't be one misconfigured header away from a data leak. Worth having a second person check the public list before it ships.

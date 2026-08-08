---
kind: eval-artifact
run: 3
variant: B
replicate: r1
task: T6
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It'll speed things up, and it'll also leak one user's data to another user. The second part is the problem.

The trap is that `GET` means "this request doesn't change anything." It does **not** mean "the response is the same for everyone." Plenty of GET endpoints return personalized data — `/api/me`, `/api/cart`, `/api/notifications`, anything that varies by auth token. A shared CDN cache stores the first response it sees under a key that's usually just the URL, and then hands that response to whoever asks next. So user A's cart gets served to user B.

The distinction you want is **public vs. private**:

- **Public** — same bytes for every caller. Product catalog, blog posts, config, static assets, public search results. Safe to cache in a shared CDN, and you should.
- **Private** — varies by who's asking. Anything behind auth. These must be marked `Cache-Control: private, no-store` so the CDN refuses to hold them at all.

The safe way to roll this out is to default everything to no caching and opt endpoints in one at a time, rather than caching everything and hoping you catch the exceptions. The failure mode of the opt-out approach is a data leak you find out about from a customer.

Two more things that bite people:

**Invalidation.** Once a response is in the CDN it's there for its full TTL, even if the underlying data changed a second later. Either use short TTLs, or wire up purge calls on write. `stale-while-revalidate` is a good middle ground — serve the cached copy instantly while fetching a fresh one in the background.

**Vary headers.** If a response legitimately differs by `Accept-Language` or `Accept-Encoding`, the CDN needs a `Vary` header to key on that too. Get it wrong and you serve German content to English speakers. And never `Vary: Authorization` as a workaround for private data — it technically works but gives you a cache entry per user, which is all cost and no benefit.

Happy to go through the endpoint list with you and sort them into the two buckets — it's usually a quick pass and it's the part that matters.

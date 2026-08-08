---
kind: eval-artifact
run: 4
variant: E
replicate: r2
task: T6
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will speed things up and leak user data. GET does not mean public.

A shared CDN cache stores one copy per URL and serves it to everyone. Any endpoint whose response depends on who is asking — `/api/me`, `/api/orders`, anything reading a session cookie or an `Authorization` header — will get cached under the first user's response and handed to the next user who asks. That is the failure mode, and you find out about it from a customer.

Split your GETs into three buckets:

- **Public and identical for everyone** — product catalog, static config, marketing content. Cache these in the shared CDN with a long `max-age`. This is where your real win is.
- **Per-user** — anything behind auth. Mark them `Cache-Control: private, no-store`. The browser may hold them; the CDN must not.
- **Public but varying** — responses that change by locale, currency, or device. Cache them, but set `Vary` on exactly the headers that matter. Every value in `Vary` multiplies your cache entries, so keep the list short.

Two more things worth doing:

- **Default to `no-store`** and opt endpoints in one at a time. A missing header should fail safe, not fail open.
- **Plan invalidation before you set a TTL.** A ten-minute stale price is a support ticket. Either keep TTLs short or wire up purge-on-write.

Start with the public bucket alone. That is most of the speed with none of the risk.

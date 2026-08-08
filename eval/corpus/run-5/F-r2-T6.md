---
kind: eval-artifact
run: 5
variant: F
replicate: r2
task: T6
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
## Will caching every GET in a shared CDN cache work?

No. It will speed some things up and leak private data on the rest.

A shared cache is one store used by every visitor. A CDN edge saves one response and hands that same copy to whoever asks next. That is safe when the response is the same for everyone. It is a data breach when it is not.

`GET` says the request does not change anything on the server. It says nothing about whether the response is the same for every user. Those are different properties, and only the second one makes a response cacheable in a shared cache.

## What breaks?

Any endpoint whose response depends on who is asking.

- **User-specific data.** `GET /api/me`, `/api/cart`, `/api/notifications`. The first user to hit an edge fills the cache, and the next user gets that person's profile or basket.
- **Permission-filtered lists.** `GET /api/documents` returns what *you* may see. Cached, it returns what the first caller may see, to everyone.
- **Anything varying by header.** Responses that differ by `Accept-Language`, `Accept`, or an auth token collapse into one cached copy unless you name those headers in `Vary`.
- **Fast-changing data.** Prices, stock counts, live scores. Nothing is leaked, but users act on stale numbers.

Most CDNs will not cache a response carrying `Set-Cookie` or an `Authorization` request header, which stops some of this by default. Do not rely on that. Defaults differ between providers, an app that authenticates with a bearer token in a non-standard header can slip through, and one misconfigured route is enough.

## What should we do instead?

Mark each endpoint on purpose, and default to not caching.

Use `Cache-Control` on the response to say what each one is:

- `public, max-age=31536000, immutable` — for static assets with a content hash in the filename. This is where nearly all the win is.
- `public, s-maxage=60` — for genuinely shared data, like a public product list. `s-maxage` applies to shared caches only, so browsers can keep a shorter lifetime.
- `private, no-store` — for anything user-specific. `private` means browsers may cache it but shared caches may not; `no-store` means nobody keeps a copy.

Then add two things. Set `Vary` on any response that legitimately differs by a request header, so the cache keys on that header instead of ignoring it. Add `stale-while-revalidate` to cacheable responses, which lets the edge serve the slightly-old copy while it fetches a fresh one — you get cache speed without a cliff when entries expire.

Verify before you trust it. Log in as two different users and request the same endpoints, watching the `Age` and `X-Cache` response headers. A cache hit on a personalized route is the bug you are looking for, and it is much cheaper to find in staging than in the incident channel.

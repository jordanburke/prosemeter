---
kind: eval-artifact
run: 2
variant: G
replicate: r5
task: T6
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Caching every GET in a shared CDN cache will leak user data. Some of those GETs return responses that differ per user, and a shared cache serves whatever it stored first to everyone who asks next. One user's account page gets handed to the next hundred visitors.

The word doing the work is **shared**. A browser cache holds one user's data on that user's machine, so a per-user response is fine there. A CDN cache is one box in front of everyone. Anything stored in it must be identical for every requester, or it is a data breach.

The other wrong assumption is that GET means safe to cache. GET means the request does not change server state. It says nothing about whether the response is the same for all callers, and that is the property a shared cache actually needs.

Three buckets, and each needs different handling:

1. **Truly public and stable.** Static assets, marketing pages, public product data. Cache these hard at the edge: `Cache-Control: public, max-age=31536000, immutable` for fingerprinted assets, shorter for content that changes.
2. **Public but changes.** A public feed, a price list. Cache at the edge with a short TTL, or use `s-maxage` plus `stale-while-revalidate` so the edge serves fast and refreshes behind the scenes.
3. **Per-user or auth-gated.** Anything behind a login. Mark these `Cache-Control: private, no-store`. The `private` directive tells shared caches to keep out while still allowing the browser to hold it.

Two things to get right on the way in:

- **Set the headers per route, not globally.** A blanket rule at the CDN config layer is how the leak happens. Let each endpoint declare what it is, and make `private, no-store` the default for anything that reads the session.
- **Watch `Vary`.** If a response really does differ by header, such as `Accept-Language`, you must send `Vary` naming that header or the cache will mix them up. Do not try to `Vary: Authorization` your way to caching per-user data. It technically works and it is a footgun, since one misconfigured hop drops the header and you are back to serving the wrong user.

So the honest answer: yes to a CDN cache, no to caching everything. Sort the endpoints into the three buckets first. The public ones will give you most of the speedup anyway, since they are usually the bulk of the bytes.

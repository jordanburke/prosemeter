---
kind: eval-artifact
run: 3
variant: B
replicate: r5
task: T6
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It'll speed things up right up until it serves one user's data to another user. That's the risk, and it's not hypothetical — it's one of the more common ways apps leak data.

The problem is the word "every." GET means "this request doesn't change anything." It does **not** mean "the response is the same for everyone." A shared CDN cache stores one response per URL and hands it to whoever asks next. So `GET /api/me` gets cached with your profile in it, and the next person to hit that URL gets your profile. Same for `/api/orders`, `/api/notifications`, anything scoped to the caller by a session cookie or auth header.

So the split I'd draw:

**Safe to cache in a shared CDN** — responses that are identical for every caller and don't depend on who's asking. Product catalog, public content, config, static assets, marketing pages. These are usually a big win, especially with a long TTL and content-hashed URLs.

**Never in a shared cache** — anything personalized or behind auth. If you want to cache those at all, it has to be `Cache-Control: private`, which permits the user's own browser to cache it but forbids the CDN.

The mechanism that keeps them apart is `Cache-Control`, set per endpoint. Something like:

- Public data: `Cache-Control: public, max-age=300, s-maxage=3600`
- User data: `Cache-Control: private, no-store`

Default everything to `private, no-store` and opt individual endpoints into public caching deliberately. Opt-out is how you get a leak — someone adds an endpoint, forgets the header, and it inherits the permissive default.

Two more things to watch:

- **`Vary`.** If a response legitimately differs by header (language, content type), you need `Vary` naming that header, or the CDN will serve one variant to everyone. But `Vary: Authorization` is not a safe way to cache per-user data — it technically works and is a trap, because you're now keying a shared cache on a secret and depending on the CDN getting it exactly right.
- **Invalidation.** Once something is cached for an hour, it's stale for an hour. Decide upfront whether you're purging on write or just accepting the staleness window, and pick TTLs you're comfortable being wrong for.

Happy to go through the endpoint list with you and sort them into the two buckets — it's usually a quick pass and worth doing explicitly rather than guessing.

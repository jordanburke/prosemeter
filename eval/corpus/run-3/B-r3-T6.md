---
kind: eval-artifact
run: 3
variant: B
replicate: r3
task: T6
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
For some endpoints, yes, and it'll help a lot. For "every GET endpoint," no — and the failure mode is bad enough to be worth being careful about.

**The serious risk: leaking one user's data to another.** A shared CDN cache stores a response and serves it to whoever asks for the same URL next. If `/api/me` or `/api/notifications` gets cached, the first user's response gets handed to the second user. Same URL, different person, and the CDN has no idea the response depended on who was logged in. This is a real incident pattern, not a theoretical one — it happens when a blanket caching rule gets applied without auditing what's behind each route.

So the dividing line isn't "is it a GET." It's **does the response depend on who is asking.**

- **Cacheable in a shared cache:** the same bytes for everyone. Product catalog, public content, config, static reference data.
- **Not cacheable in a shared cache:** anything personalized, anything behind auth, anything varying by session, cookie, or token.

**Practical rules for doing this safely:**

1. **Opt in, never opt out.** Default everything to `Cache-Control: no-store` and explicitly mark the endpoints you've reviewed as cacheable. A default-cache policy means the next endpoint someone adds is cached before anyone's thought about it.
2. **Use `private` for per-user responses.** `Cache-Control: private, max-age=60` lets the browser cache it but tells shared caches to keep out. That still gets you a win on repeat views without the leak.
3. **Everything that varies must be in the cache key.** If the response differs by locale, currency, or feature flag, either put it in the URL or set `Vary` correctly. Getting `Vary` wrong is the second most common way this goes sideways.
4. **Never cache anything with `Set-Cookie`** in a shared cache. You'd be handing out someone's session.

**The other half is staleness.** GET doesn't mean the data doesn't change. A one-hour TTL on something users edit means they'll update it and see the old value, which reads as a bug. Two ways to handle it:

- **Short TTLs** — 30 to 60 seconds is often enough to absorb a traffic spike while staying fresh enough that nobody notices.
- **Explicit invalidation** — cache aggressively and purge on write. More work, much better results. Versioned URLs make this easier since the new version just has a different key.

**What I'd do:** list the GET endpoints, sort them into public and per-user, and start by caching only the public ones. That's usually where the traffic is anyway, so you get most of the speedup for a fraction of the risk. Then look at whether the per-user ones justify `private` browser caching.

Happy to go through the endpoint list with you if it's useful.

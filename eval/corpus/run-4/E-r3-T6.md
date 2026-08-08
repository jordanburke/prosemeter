---
kind: eval-artifact
run: 4
variant: E
replicate: r3
task: T6
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Don't do it blanket — a shared cache in front of every GET will serve one user's data to another user.

The failure mode is simple. `GET /api/me` returns Jordan's profile, the CDN stores it under that URL, and the next person to hit the path gets Jordan's profile back. The CDN keys on URL, not on your session cookie or bearer token. Any endpoint whose response varies by identity is a leak waiting to happen, and it'll look fine in testing because you're the only one logged in.

"GET is safe to cache" also assumes your GETs have no side effects. Worth checking — plenty of codebases have a GET that bumps a counter or extends a session.

What actually works:

- Split the surface. Public, identical-for-everyone responses go in the shared cache. Anything behind auth does not.
- Send `Cache-Control: private, no-store` on authenticated responses, and make that the default so a new endpoint is safe until someone opts it in.
- Set `Cache-Control: public, max-age=..., s-maxage=...` explicitly per endpoint you want cached, one at a time.
- Add `Vary: Authorization, Accept-Encoding` so a cached entry can't cross an auth boundary even by mistake.
- Plan invalidation before you turn anything on. A long TTL with no purge path means stale data you can't fix without a support ticket.

For per-user data that's genuinely hot, use a short private cache in the browser or a keyed server-side cache like Redis. Both give you the speed without the shared-key problem.

And measure first. If p95 is dominated by a slow query rather than transfer, the CDN won't move it much.

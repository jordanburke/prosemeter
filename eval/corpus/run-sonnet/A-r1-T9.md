---
kind: eval-artifact
run: sonnet
variant: A
replicate: r1
task: T9
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
"Too many clients already" means Postgres has hit `max_connections` and is rejecting new ones — that's the literal error, not a symptom of something else. Your app's connections are failing, so requests fail, hence the 502s. The pods are probably restarting because health checks can't reach the DB, or the app is crash-looping on unhandled connection errors — and restarting doesn't help, because the constraint is on the DB side, so it hits the same wall again immediately.

Since nothing shipped today, likely causes: a traffic spike, a slow connection leak that's been building for a while and only just tipped over the limit, a stuck long-running query or transaction holding connections open, or another process (cron job, batch job, migration, someone else's pod) that started consuming connections around when this began.

First things to do, in order:
1. Check current connections vs. the limit: `SELECT count(*) FROM pg_stat_activity`, and see who's holding them: `SELECT * FROM pg_stat_activity WHERE state != 'idle'`, grouped by `application_name`/`client_addr`.
2. If restarts are making it worse — each restart opening more connections without cleanly releasing dead ones — scale replicas down temporarily instead of letting it thrash.
3. Kill any long-idle-in-transaction connections holding slots (`pg_terminate_backend`) once you've identified the culprits.
4. Once stable, check your app's connection pool config: pool size × pod count vs. the DB's `max_connections`. If that math already exceeds the limit, that's the root cause on its own, and this will recur under load with no leak required.
5. Add a pooler (pgbouncer) if you don't already have one, so app-level connections don't map 1:1 to DB-level connections.

Priority right now: free up connections to stop the bleeding, then find the leak or config mismatch so it doesn't come back.

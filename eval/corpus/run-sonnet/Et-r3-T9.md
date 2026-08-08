---
kind: eval-artifact
run: sonnet
variant: Et
replicate: r3
task: T9
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your database has hit its max connection limit — that's exactly what `FATAL: sorry, too many clients already` means. Postgres has a `max_connections` cap, every slot is full, and new connections (including your app's) get rejected outright. That rejection is what's surfacing as 502s.

The climbing restart count is likely your own health checks or readiness probes failing because the pod can't get a database connection either, so the orchestrator keeps cycling it — which doesn't fix anything and may be making the connection churn worse.

Nothing shipped today, so look for a slow leak or a load change rather than a bad deploy:

- **A connection leak.** Something stopped releasing connections back to the pool — a code path that opens a connection and doesn't close it on error, a hung query, a recent traffic pattern hitting an uncommon branch.
- **Pool misconfiguration vs. replica count.** If pods scaled up (autoscaling, a recent redeploy of *another* service) and each pod holds its own connection pool, total connections can exceed `max_connections` even with unchanged code.
- **A stuck long-running query or lock** holding connections open longer than usual.

**What to do first:**

1. **Check current connections now**: `SELECT count(*), state FROM pg_stat_activity GROUP BY state;` — see if they're mostly `idle`, `idle in transaction`, or `active`. A pile of `idle in transaction` points straight at a leak.
2. **Free up headroom immediately** if you're fully down: kill the oldest idle connections to get the service breathing — `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND state_change < now() - interval '10 minutes';` — a stopgap, not a fix.
3. **Check pod count vs. pool size.** Multiply your app's per-pod pool max by the current pod count and compare against `max_connections`. If autoscaling added pods recently, that math alone may explain it.
4. **Put a pooler in front (PgBouncer) if you don't have one**, so app-level connections don't map 1:1 to Postgres-level connections. That's the durable fix if this is a scaling issue rather than a leak.

Stop the restart loop once you free connections — it's not helping and adds noise to your investigation.

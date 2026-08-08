---
kind: eval-artifact
run: sonnet
variant: Et
replicate: r2
task: T9
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Postgres has hit `max_connections` and is refusing new ones. The 502s and the climbing restart count are downstream of that, not separate problems.

Likely chain: something exhausted the connection pool — a connection leak (queries that open a connection and never release it, especially on an error path), a spike in pod replicas from autoscaling, or a stuck query holding connections open. Once Postgres hits the limit, new connection attempts fail with `FATAL: sorry, too many clients already`. Your health checks then fail, Kubernetes restarts the pod, and the restarting pod immediately tries to open a fresh batch of connections on startup — which fail for the same reason. That's why restarts are climbing instead of helping: each restart adds connection pressure instead of relieving it.

First things to do, in order:

1. **Stop the restart loop from making it worse.** If you can, pause or scale down the deployment (or a subset of pods) rather than let Kubernetes keep respawning pods that immediately fail to connect.
2. **Check `pg_stat_activity`** for connection count and state. Look for a pile of `idle in transaction` connections — that's the classic leak signature.
3. **Check what changed an hour ago that isn't a deploy** — a traffic spike, a cron job, a batch process, an autoscaling event, or a downstream dependency (another service) that started timing out and causing your app to hold connections longer than usual.
4. **Once stable, put a connection pooler in front of Postgres** (PgBouncer, or your cloud provider's built-in pooler) if you don't have one — it caps the connections Postgres actually sees regardless of how many app instances scale up.
5. **After the fire's out**, check your app's connection pool config (max pool size × pod count vs. `max_connections`) — this is usually the root cause: nothing leaked, the math just didn't account for autoscaling.

Start with 1 and 2 in parallel — stop the bleeding, then find the leak.

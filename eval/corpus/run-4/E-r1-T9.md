---
kind: eval-artifact
run: 4
variant: E
replicate: r1
task: T9
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
You're out of Postgres connections, and the pod restarts are making it worse. Cut the connection demand first, then find what started it.

Here's the loop. Something pushed connection count past `max_connections`. New connections got refused with that FATAL. The app's health check couldn't reach the database, so Kubernetes marked the pod unhealthy and killed it. The replacement pod started up and opened a fresh pool on boot — while the dead pod's connections sat on the server waiting to time out. So each restart adds connections instead of freeing them, and the crash loop feeds itself. That's why it's getting worse an hour in with nothing shipped.

**Right now:**

1. **Look at the server side.** `SELECT state, count(*) FROM pg_stat_activity GROUP BY state;` — compare the total to `SHOW max_connections`. If a large share is `idle` or `idle in transaction`, those are orphans from dead pods or leaked transactions.
2. **Kill the orphans** to buy room: terminate backends that are `idle in transaction` and older than a few minutes. That usually stops the bleeding immediately.
3. **Scale the deployment down**, not up. Fewer replicas means fewer pools. Scaling up is the instinct here and it's exactly wrong.
4. **Loosen the liveness probe** — raise the failure threshold or timeout — so pods stop getting killed while they're merely slow. The restarts are amplifying the problem, not fixing it.

**Then find the trigger.** Nothing shipped, so look at what changed anyway:

- **Traffic.** A spike, a new client, a batch job, a retry storm from an upstream service.
- **A slow query.** One query grabbing a lock or scanning a big table makes every request hold its connection longer, and connection count is arrival rate times hold time. Check `pg_stat_activity` for long-running queries and for blocked ones.
- **Someone else's connections.** A migration, an analytics tool, a colleague's psql session, a new service pointed at the same database.
- **Infra.** A failover, a restart, or a config change that lowered `max_connections`.

**The durable fix is a pooler.** PgBouncer in transaction mode lets hundreds of app connections share a few dozen server ones, and it means a pod restart can't strand connections. Alongside that: cap the per-pod pool size so `replicas × pool_size` stays comfortably under `max_connections`, add a startup probe so slow boots don't read as failures, and alert on connection utilization instead of learning about it from 502s.

I can take the `pg_stat_activity` dig if someone else handles the scale-down.

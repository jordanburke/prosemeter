---
kind: eval-artifact
run: 4
variant: E
replicate: r2
task: T9
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
You are out of Postgres connections, and the pod restarts are making it worse, not better. Treat this as a feedback loop rather than a single fault.

Here is the shape of it. Something pushed connection count past `max_connections`. New connections then get refused, the app fails its health check, Kubernetes kills the pod, and the replacement opens a fresh pool on startup — while the dead pod's connections may not be reaped for minutes. Each restart adds pressure. That is why the restart count climbs and why it will not settle on its own.

**Do this first, before diagnosing.** Run against the database:

```sql
SELECT state, count(*) FROM pg_stat_activity GROUP BY state;
```

If `idle in transaction` is a big share, those are leaked connections holding slots. Kill the ones older than a few minutes:

```sql
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE state = 'idle in transaction' AND state_change < now() - interval '5 minutes';
```

That usually buys immediate relief. Then check total connections against `max_connections` and against your pool math: pods × pool size must sit under the limit, with room left for migrations and your own psql sessions.

**Nothing shipped, so look for what else changed an hour ago.** Candidates, roughly in order of how often they turn out to be the answer:

- **The pod count grew.** An HPA scaled up on a traffic bump, and each new pod brought a full pool. Check the replica count history.
- **A batch job or analytics tool connected.** Cron, a data export, someone's BI dashboard, a colleague's local app pointed at prod.
- **A slow query started piling up.** One unindexed query getting slower under growing data holds connections longer, and connection count is a function of query duration. Check `pg_stat_activity` for long-running queries.
- **The database restarted or failed over** and reset its limits or dropped the pooler.

**Once it is stable, fix the structure.** Three things, in order:

1. **Cap the pool per pod** so `pods × max_pool_size` cannot exceed `max_connections` even at peak autoscale. Most Node apps default to a pool far larger than they need.
2. **Put PgBouncer in front** in transaction mode. This is the real fix — it decouples pod count from database connections entirely, and it means autoscaling stops being a database event.
3. **Separate the liveness probe from database health.** A pod that cannot reach the database should not be killed, because restarting it makes the connection problem worse. Use readiness to pull it from the load balancer instead.

I would start with the `pg_stat_activity` query — it will tell you in thirty seconds whether this is leaked transactions or genuine volume, and those lead to different fixes.

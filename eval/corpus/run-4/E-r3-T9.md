---
kind: eval-artifact
run: 4
variant: E
replicate: r3
task: T9
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
You're out of Postgres connections, and the restarts are making it worse — that's the loop to break first.

The sequence fits: connections hit `max_connections`, new ones get refused, the app throws, the health check fails, Kubernetes kills the pod. The replacement pod starts and immediately opens a full pool. Meanwhile Postgres hasn't reaped the dead pod's connections yet, so total demand goes **up** with each restart. That's why it's escalating an hour in with nothing shipped.

**Do this now, in order:**

1. Look at the real numbers:
   ```sql
   SELECT state, count(*) FROM pg_stat_activity GROUP BY state;
   SHOW max_connections;
   ```
   Compare against pool size × replica count. If that product exceeds `max_connections`, the math alone explains it.

2. Check for `idle in transaction`. A pile of those means code opened a transaction and never committed — those connections are held hostage. Terminate ones idle over a few minutes with `pg_terminate_backend`, which usually restores service in seconds.

3. Stop the restart loop. Scale replicas down, or loosen the liveness probe so a pod that's failing to connect isn't killed and rebuilt. Fewer pods means fewer pools competing.

4. Once it's stable, cap the pool per pod so pods × pool + headroom stays under `max_connections`. Leave room for migrations and for your own psql session.

**Then find why it started.** Nothing shipped, so look at what changed around it: a traffic spike, an HPA scale-up that quietly doubled pods, a cron or batch job that opened connections and held them, a long-running query blocking others, or a failover that reset the connection budget. `pg_stat_activity` with `query_start` and `xact_start` sorted oldest-first will usually name the culprit.

**The durable fix is a pooler.** Put PgBouncer in transaction mode between the app and Postgres. Then pod count stops driving connection count, and an autoscaling event can't take the database down again. Worth scheduling this week whatever we find today.

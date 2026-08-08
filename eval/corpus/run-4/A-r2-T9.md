---
kind: eval-artifact
run: 4
variant: A
replicate: r2
task: T9
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
That error is Postgres refusing new connections because `max_connections` is exhausted. The 502s follow directly — the API can't get a connection, requests fail, health checks fail, Kubernetes kills the pod, the pod comes back and immediately opens a fresh pool, which makes the connection pressure worse. The climbing restart count isn't a side effect, it's feeding the problem. That's the loop to break first.

**Do this now, before diagnosing:** confirm the shape from the database side.

```sql
SELECT state, count(*) FROM pg_stat_activity GROUP BY state;
SELECT count(*), usename, application_name FROM pg_stat_activity GROUP BY 2,3 ORDER BY 1 DESC;
```

What you see tells you which problem you have. A large `idle in transaction` count means connections are being held open across application work and never released — a leak. A large `active` count means real queries are piling up, probably behind a lock or a slow query. Mostly `idle` means the pools are just sized too large in aggregate.

Also check `SHOW max_connections;` and multiply your per-pod pool size by the current replica count. If pool_size × replicas is at or above max_connections, the math never worked and something merely changed the timing.

**To stop the bleeding**, in rough order:

- **Scale the deployment down.** Counterintuitive, but fewer pods means fewer pools means connections free up. Going from 10 pods to 4 may restore service immediately.
- **Kill the stuck sessions** if you see `idle in transaction` with old `state_change` timestamps:
  ```sql
  SELECT pg_terminate_backend(pid) FROM pg_stat_activity
  WHERE state = 'idle in transaction' AND state_change < now() - interval '10 minutes';
  ```
- **Relax the liveness probe** or raise its failure threshold so the pods stop cycling while you work. The restart loop is amplifying everything.

**On "nothing shipped today" — I'd hold that loosely.** It rules out a deploy of *your* code and nothing else. Things that change without a deploy and produce exactly this: a traffic increase pushing pool utilization past a threshold that was always marginal; a cron or batch job that runs at this hour and holds long transactions; a connection leak that's been present for weeks and only manifests after enough uptime; an autoscaler that added pods in response to load; a database-side change (parameter group update, failover, maintenance window) made by someone outside the team; a dependency that got slower, causing your handlers to hold connections longer. Check whether anything scaled, and check the DB's own event log.

**The real fix, once it's stable:** put PgBouncer in front in transaction mode. Application pools then talk to the bouncer instead of Postgres directly, and total backend connections stay bounded no matter how many pods you run. This is the structural answer — without it you're one scale-up away from the same outage. Also worth setting `idle_in_transaction_session_timeout` on the database as a backstop so a leaked transaction can't hold a slot indefinitely.

What does `pg_stat_activity` show? That'll tell us whether we're chasing a leak or a sizing problem, and they have different fixes.

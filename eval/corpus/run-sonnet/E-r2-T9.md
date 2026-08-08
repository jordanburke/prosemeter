---
kind: eval-artifact
run: sonnet
variant: E
replicate: r2
task: T9
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Postgres hit its `max_connections` limit, so new connections get rejected — that's the 502. The climbing restart count is a symptom, not the cause: your pods likely crash on that FATAL error, Kubernetes restarts them, and the new pod opens more connections into an already-full pool, so it fails again. That's a loop that won't self-heal.

**Do first: see who's holding the connections.**
```sql
SELECT pid, usename, application_name, state, state_change
FROM pg_stat_activity
ORDER BY state_change;
```
Look at the `state` column. If you see a pile of connections stuck in `idle` or `idle in transaction`, something is opening connections and not closing them — a leak, not real load.

**Likely causes, in rough order of likelihood given "nothing shipped today":**
- A connection pool leak that's been slow-building and just crossed the limit (a long-lived bug, triggered now by normal traffic growth or a slow query holding connections longer than usual).
- A traffic spike from somewhere upstream, unrelated to your code — check whether request volume actually jumped in the last hour.
- Another service or a cron/batch job started hitting the same database and wasn't accounted for in the connection budget.

**Immediate mitigation, in order:**
1. Kill idle/stuck connections to free headroom right now: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle in transaction' AND state_change < now() - interval '5 minutes';`
2. If pods are restart-looping, that's making it worse — each restart adds connections during startup. Consider scaling replicas down temporarily to stop the thundering herd while you investigate.
3. Check your app's connection pool config (max pool size × pod count) against Postgres's `max_connections`. If pool size × replica count can exceed `max_connections`, that's the structural bug, and traffic growth will trip it again even after this clears.

**After the immediate fire:**
- Put a connection pooler (PgBouncer) in front of Postgres if you don't have one — it caps total connections regardless of pod count.
- Add alerting on connection count so this doesn't reach FATAL again before anyone notices.

Start with `pg_stat_activity`. It'll tell you in one query whether this is a leak or a real spike.

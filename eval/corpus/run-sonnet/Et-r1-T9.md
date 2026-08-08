---
kind: eval-artifact
run: sonnet
variant: Et
replicate: r1
task: T9
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Postgres has hit its `max_connections` limit — that error is the database refusing new connections, not a bug in your service. The rising restart count is likely making it worse: each crash-looping pod comes back up, opens a fresh batch of connections on startup, and if the old ones haven't been released yet, you get a thundering herd that keeps the primary pinned at the limit.

First step, before touching config: connect to Postgres directly (not through the app) and look at `pg_stat_activity` to see who's actually holding connections —

```sql
SELECT client_addr, application_name, state, count(*)
FROM pg_stat_activity
GROUP BY 1, 2, 3
ORDER BY count(*) DESC;
```

That tells you whether it's your service, a batch job, another team's service, or a pile of idle/idle-in-transaction connections that never got closed.

Then, to get breathing room right now: terminate the idle or idle-in-transaction connections that are hogging slots —

```sql
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle in transaction' AND now() - state_change > interval '5 minutes';
```

That should let 502s clear immediately, since new connections can succeed once slots free up.

"Nothing shipped today" points at a traffic-driven cause, not a code change: an autoscaling event that added pods (each opening its own connection pool, multiplying total connections), a scheduled job, or a slow leak that finally tipped over the limit. Check autoscaling events and traffic graphs for the last hour once the fire's out.

Root fix, once stable: put a connection pooler (PgBouncer) in front of Postgres so pods share a small pool of real connections instead of each holding their own, and cap each app pod's pool size so total connections across all pods stays under `max_connections` with headroom.

---
kind: eval-artifact
run: sonnet
variant: A
replicate: r2
task: T9
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
`FATAL: sorry, too many clients already` means Postgres hit `max_connections` and is rejecting new connections outright. That's your 502s — the app can't open a connection, the request fails, the health check fails, the pod gets marked unhealthy and restarted. The restart itself doesn't fix anything, because the new pod boots up, tries to open its own pool of connections, and hits the same wall. That's why the restart count keeps climbing — it's a loop, not separate incidents.

**First step: stop the restart loop before debugging further.** A crash-looping pod keeps adding connection attempts on top of an already-saturated database, which makes recovery harder. If you can, pause the deployment's restarts or scale replicas down temporarily so the herd of reconnect attempts stops hammering Postgres.

**Second: check what's actually holding the connections.**
```sql
SELECT count(*), state, application_name FROM pg_stat_activity GROUP BY state, application_name ORDER BY 1 DESC;
```
Look for a pile of connections sitting in `idle` or `idle in transaction` — that's usually a leak (connections opened and never released, or a transaction never committed/rolled back) rather than genuine load. If it's mostly `active`, you're actually just out of capacity.

**Third: figure out why it started an hour ago with no deploy.** Since nothing shipped, look outside your own code:
- A cron job, batch job, or scheduled task that runs periodically and opens connections without a pool/limit.
- Another service or a new consumer that started hitting this database around that time.
- A slow query that started running long (bad data, table growth, a stale query plan) and is now holding connections instead of releasing them quickly.
- Autoscaling — did pod count increase? More pods with a fixed per-pod pool size means more total connections against the same `max_connections`.

**Immediate relief while you find the root cause:** if you have a superuser session, kill idle-in-transaction connections that have been sitting for a while:
```sql
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE state = 'idle in transaction' AND state_change < now() - interval '10 minutes';
```
That buys headroom without touching `max_connections` itself, which is a bigger, riskier change to make live.

**Longer-term fix, once things are stable:** put a connection pooler (PgBouncer) in front of Postgres if you don't already have one. It lets many app connections share a small number of real database connections, so pod scaling or a leak doesn't directly translate into exhausting `max_connections` again.

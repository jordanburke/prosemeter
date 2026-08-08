---
kind: eval-artifact
run: 4
variant: A
replicate: r1
task: T9
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
That error is Postgres refusing connections because you've hit `max_connections`. The 502s are downstream of that — the app can't get a connection, requests fail, health checks fail, Kubernetes kills the pod.

And here's the part that makes this urgent: **the restarts are feeding the problem.** A pod dies, its connections don't get cleaned up instantly on the Postgres side, the replacement pod boots and immediately opens a fresh pool, and now there are more connections than before. That's a positive feedback loop. It won't recover on its own, and it gets worse the longer it runs.

"Nothing shipped today" is consistent with this rather than against it. Connection exhaustion is nearly always either a slow leak that finally crossed the threshold, or a change in load or topology rather than a change in code.

**First, get visibility — one query:**

```sql
SELECT state, count(*), max(now() - state_change) AS oldest
FROM pg_stat_activity
GROUP BY state ORDER BY 2 DESC;
```

Also `SHOW max_connections;` and group by `application_name` / `client_addr` to see which service owns them. This takes thirty seconds and determines everything else.

What the answer means:

- **Lots of `idle in transaction`** — this is the most common cause by a wide margin. Somewhere a transaction is opened and not committed or rolled back, usually because an error path skips the cleanup, or a request awaits something slow (an HTTP call to a third party) while holding the transaction open. If the third party got slow an hour ago, that alone explains everything with no deploy required.
- **Lots of `active` with long runtimes** — a query got slow. Check for a missing index, a table that crossed a size threshold and flipped the plan, or a lock. Look at `pg_locks` and `pg_blocking_pids`.
- **Lots of plain `idle`** — pools are just sized too large in aggregate. Count it: pods × pool size. If you scaled up replicas recently, or an HPA scaled you up under load, you can blow past `max_connections` with zero code change. This is my other leading theory given "nothing shipped."

**What I'd do first, in order:**

1. **Stop the crash loop from amplifying.** If pods are cycling, they're generating connection churn faster than Postgres reclaims it. Temporarily scaling the deployment *down* is counterintuitive but often the fastest path to stability — fewer pods, fewer pools, some capacity recovers, the survivors stop dying.

2. **Reclaim connections held by nothing.** If you found idle-in-transaction sessions:

```sql
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE state = 'idle in transaction' AND state_change < now() - interval '5 minutes';
```

Read the `SELECT` output before running the terminate, and don't sweep up your own session. This buys headroom immediately but it's a tourniquet — the leak is still there.

3. **Only then consider raising `max_connections`.** It's tempting and it's mostly wrong. Each Postgres backend costs real memory, and raising it on a saturated box can push you into swap or OOM, which is a much worse afternoon. If you do it as an emergency measure, raise it modestly and know it's temporary. On most managed Postgres this needs a restart anyway, which is its own outage.

**Then find what changed an hour ago.** Not a deploy, so: traffic spike, a scheduled batch job or cron that opens connections, an HPA scale-up event, a failover or maintenance window on the database, a dependency getting slow and stretching transaction lifetimes, someone's `psql` session or a BI tool left connected. Overlay the connection-count graph on the deploy/scaling timeline and the start point usually names itself.

**The durable fix is a pooler.** PgBouncer (or your provider's equivalent) in transaction mode, sitting between the app and Postgres. Hundreds of app-side connections multiplex onto a small number of real backends, and pod restarts stop being a database event. Alongside that: hard-cap each pod's pool so `pods × pool_size` provably stays under `max_connections` even at max HPA replicas, set a statement timeout and an idle-in-transaction timeout so a stuck transaction can't hold a connection forever, and alert on connection count at 70% of max so you get warned instead of paged.

If you paste the `pg_stat_activity` output I can tell you which branch you're on.

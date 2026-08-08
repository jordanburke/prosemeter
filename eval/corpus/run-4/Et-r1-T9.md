---
kind: eval-artifact
run: 4
variant: Et
replicate: r1
task: T9
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
You are in a connection exhaustion crash loop. The pods are fighting each other for Postgres connections, and each restart makes it worse.

**The loop**

`FATAL: sorry, too many clients already` means Postgres hit `max_connections`. Your app cannot get a connection, so health checks fail, so Kubernetes restarts the pod. The restarting pod opens a fresh pool on startup — while Postgres is still holding the dead pod's connections open, because it has not noticed they are gone yet. Fewer connections available, more pods fail, more restarts. That is why the restart count climbs and why it does not recover on its own.

The 502s are the load balancer finding no healthy pod behind the service.

**First: confirm, do not assume**

```sql
SELECT count(*), state, application_name
FROM pg_stat_activity
GROUP BY state, application_name
ORDER BY count DESC;

SHOW max_connections;
```

If `count` is at or near `max_connections`, confirmed. Look at the `state` breakdown — that tells you which fix applies.

**Then: read the state column, it names the cause**

- **Mostly `idle in transaction`** — code opened a transaction and did not commit or roll back. A bug, or a slow external call inside a transaction. This is the most common cause and the one worth fixing.
- **Mostly `active`, long-running** — a query got slow, requests piled up behind it, and the pool drained. Something changed in the data, not the code.
- **Mostly `idle`, spread across many pods** — pool sizing. Total connections is pods × pool size, and you crossed the limit. An autoscaling event an hour ago would do exactly this without a deploy.

Check `pg_stat_activity.query_start` for the oldest sessions. That usually points straight at the culprit.

**Stop the bleeding, in this order**

1. **Scale the deployment down** to two or three pods. Counterintuitive during an outage, but it breaks the loop — fewer pods means enough connections for those pods to actually start and pass health checks. Partial service beats none.
2. **Kill the stuck sessions** if you found `idle in transaction`:
   ```sql
   SELECT pg_terminate_backend(pid) FROM pg_stat_activity
   WHERE state = 'idle in transaction' AND state_change < now() - interval '10 minutes';
   ```
   Read the rows before you terminate them. Note what query they were running — that is your root cause and it will be gone once you kill them.
3. **Wait for pods to stabilize**, then scale back up gradually, watching connection count as you go.

**"Nothing shipped today" does not mean nothing changed**

Things that produce this without a deploy: an HPA scaling out on morning traffic, a cron job or batch import opening its own connections, a config or feature flag change, a data volume crossing a threshold that turned a fast query slow, or a connection leak that has been growing for days and crossed the limit this morning. Check your autoscaler events and your scheduled jobs for the last two hours.

**Once it is stable**

- Set pool size so pods × pool + headroom < `max_connections`. Leave room for migrations, `psql`, and your monitoring.
- Put PgBouncer in transaction mode in front of Postgres. This is the real fix — it decouples app connection count from database connection count, so pod scaling stops being a database event.
- Add `statement_timeout` and `idle_in_transaction_session_timeout` on the database side. Postgres then cleans up leaks itself instead of waiting for you.
- Alert on connection count at 70% of max, so you get warning next time instead of an outage.
- Fix the health check. A pod that cannot reach the database should report unready, not unhealthy — unready takes it out of rotation without restarting it, which breaks the loop automatically.

Start with the scale-down. It is reversible and it buys you room to diagnose.

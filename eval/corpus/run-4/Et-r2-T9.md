---
kind: eval-artifact
run: 4
variant: Et
replicate: r2
task: T9
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
You have run out of Postgres connections, and the pod restarts are making it worse, not better.

`FATAL: sorry, too many clients already` means open connections have hit `max_connections`. Each pod holds a pool. When a pod cannot reach the database it fails health checks and gets killed, a new pod starts and opens a fresh pool, and the connections from the dead pod may not be released for a while. So restarts consume connections rather than freeing them. That is the loop you are in, and it will not settle on its own.

**Do this first, in this order.**

1. See who holds the connections. Run `SELECT state, count(*) FROM pg_stat_activity GROUP BY state`. The shape tells you which problem you have.
2. If most are `idle in transaction`, that is your cause. Something opened transactions and stopped closing them — a slow query, a hung external call inside a transaction, a migration tool, an analytics job someone kicked off. Find them with `query_start` and terminate the oldest with `pg_terminate_backend(pid)`. That gives you headroom immediately.
3. If they are spread across many client addresses and mostly `idle`, you have too many pods times too large a pool. Count your pods and multiply by pool size. Compare that to `SHOW max_connections`. If the math exceeds the limit, scale the deployment down until it fits — fewer pods serving traffic beats every pod crashlooping.

**On "nothing shipped today."** Something still changed. The candidates are traffic growth crossing the threshold, an HPA scaling pods up and pushing the connection math over the line, a scheduled job that started an hour ago, or a slow query that got slower as a table grew and started holding connections longer. Check your autoscaler event history and your cron schedule for the hour before the 502s. One of those will match.

**Once it is stable.** Cap the pool size per pod and make the arithmetic explicit: `pods_max × pool_size + headroom ≤ max_connections`. Leave real headroom for migrations and for someone connecting with psql during an incident. Then put PgBouncer in transaction mode in front of the database — it decouples pod count from connection count and this class of outage stops happening. Set `idle_in_transaction_session_timeout` too, so a hung transaction releases itself instead of waiting for you.

Raising `max_connections` is tempting and I would not lead with it. Each connection costs memory in Postgres, so you can trade a connection outage for an out-of-memory one. Fix the count first.

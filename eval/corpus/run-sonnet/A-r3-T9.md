---
kind: eval-artifact
run: sonnet
variant: A
replicate: r3
task: T9
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
`FATAL: sorry, too many clients already` means Postgres hit `max_connections` and is refusing new ones. The climbing restart count is likely making it worse, not just a symptom: if pods are crash-looping, each restart opens a fresh batch of connections on startup before dying, which is a connection storm hitting an already-exhausted limit.

First step — stop the bleeding, not find the root cause yet:

1. **Check current connections against the limit.** Run `SELECT count(*) FROM pg_stat_activity;` and compare to `SHOW max_connections;`. Confirm this is really the ceiling and not something else wearing the same error message.
2. **Scale down or pause the crash-looping pods.** If they're restarting and reconnecting in a loop, they're actively consuming the connection budget the healthy instances need. Dropping replicas temporarily (even to zero, if you can absorb the downtime) lets connections drain and the DB recover, rather than fighting a moving target.
3. **Look at `pg_stat_activity` for what's actually holding connections** — idle-in-transaction sessions, a long-running query, or a lock someone's holding. That tells you whether this is a leak (connections opened and never closed) or a legitimate spike.

Once it's stable, dig into "nothing shipped today" — that only rules out app code, not everything else:

- An autoscaler event (HPA scale-out) that added pods without anyone deploying
- A dependent service restarting and reconnecting en masse
- A database-side event — failover, restart, or a config change to `max_connections` itself
- A connection pool misconfigured on the app side (no `max` set, or a pool-per-pod default that doesn't account for replica count) — this is the most common actual cause, and it's invisible until pod count crosses a threshold

If you don't already have PgBouncer or an equivalent in front of the database, this is the strongest argument for adding one — it caps total backend connections regardless of how many app instances exist, so a pod storm can't repeat this.

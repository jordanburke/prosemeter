---
kind: eval-artifact
run: sonnet
variant: E
replicate: r3
task: T9
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Postgres has hit its `max_connections` limit, and the restarting pods are making it worse, not better. Fix the connection count first — don't just restart harder.

The error means every connection slot on the primary is in use, so new connections get rejected outright. The rising restart count is likely a death spiral: each pod fails its health check because it can't connect, Kubernetes restarts it, the new pod (and often the old one's connections, if they aren't cleaned up promptly) both compete for the same fixed pool of slots, and the count of clients trying to connect grows faster than the count of slots freed.

Since nothing shipped today, this is almost certainly a connection leak or a load spike, not a code regression. Common causes: a connection pool with no upper bound, connections not released after use, a slow query holding connections open longer than usual, or a genuine traffic spike pushing normal usage over the limit.

**First things to do, in order:**

1. **Stop the restart loop.** Scale the deployment down, or pause the health check restarts, so pods stop hammering the connection pool while you diagnose. Restarting a pod that can't connect doesn't fix the shortage — it just adds another contender for the same slots.
2. **Check `pg_stat_activity`** (from a single direct `psql` session, since connections are scarce) to see who holds the connections — one service hogging them, or broad and even.
3. **Check for a connection pooler.** If you're not running PgBouncer or similar in front of Postgres, that's very likely the gap — direct app-to-Postgres connections don't scale past `max_connections` cleanly under load.
4. **Once stable, raise `max_connections` or add pooling** as the real fix, not just a stopgap.

Stop the restart loop first. Everything else is diagnosis you can only do once connections stop churning.

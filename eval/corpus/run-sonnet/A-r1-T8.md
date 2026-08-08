---
kind: eval-artifact
run: sonnet
variant: A
replicate: r1
task: T8
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Here's how I'd approach it, roughly in order:

1. **Confirm the diagnosis first.** Check `pg_stat_activity` and `pg_stat_statements` to make sure this is really read volume and not a handful of unindexed queries doing sequential scans — a couple of missing indexes can be cheaper to fix than standing up new infrastructure, and you don't want to add a replica to mask a query problem.

2. **Provision the replica.** Streaming replication, same Postgres major version as the primary. If you're on a managed service (RDS, Cloud SQL, etc.), this is close to one click; self-hosted takes more setup (WAL shipping, replication slots).

3. **Decide how reads get routed.** Two common approaches:
   - Explicit in application code — separate read/write connection pools, and the call site decides which to use.
   - A proxy layer (pgbouncer/pgpool, or a cloud provider's built-in split) that routes based on query type or transaction state. Less code churn, but another moving piece and less deterministic guarantees about what goes where.

4. **Handle replication lag.** The replica is eventually consistent — async by default. Any read-after-write path (user updates their profile, immediately reloads) can see stale data. Decide case by case: keep read-your-writes-critical paths on the primary, move everything else to the replica. Only consider synchronous replication if you truly need it — it costs write latency.

5. **Roll out conservatively.** Start with the clearly-safe, high-volume, non-critical reads — dashboards, list views — not everything at once. Watch the impact, then expand.

6. **Monitor.** Replica lag, replica CPU/connection count, and confirm primary load actually drops as expected.

7. **Plan for replica failure.** Requests should degrade gracefully back to the primary if the replica goes down, not fail outright. Update runbooks accordingly.

8. **Revisit later if needed.** If the single replica saturates too, that's the point to look at connection pooling, caching, or query optimization rather than just adding a second replica reflexively.

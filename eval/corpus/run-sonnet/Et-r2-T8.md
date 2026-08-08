---
kind: eval-artifact
run: sonnet
variant: Et
replicate: r2
task: T8
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Here's how I'd sequence it.

**1. Confirm the diagnosis first.** Check `pg_stat_activity` and slow-query logs to make sure the load really is read-heavy, not a handful of expensive queries or missing indexes that a replica would just mask. A replica adds capacity; it doesn't fix a bad query plan.

**2. Stand up the replica using streaming replication.** Most managed Postgres offerings (RDS, Cloud SQL, etc.) do this with one setting. Self-hosted, you're setting up a physical streaming replica with `pg_basebackup` and `primary_conninfo`. Either way, verify the replica is caught up and staying caught up before it takes traffic.

**3. Split the app's connection layer, not the queries themselves.** Add a second connection pool pointed at the replica. The cleanest approach is a routing layer at the data-access boundary: writes and any read that must be immediately consistent go to the primary, everything else goes to the replica. Don't scatter `if (isRead)` checks through the codebase — put the decision in one place (a repository layer or query wrapper).

**4. Handle replication lag explicitly.** Streaming replication is asynchronous by default, so the replica can be milliseconds to seconds behind. Decide per code path what's safe to read stale: a dashboard is fine, "read your own write right after submitting a form" usually isn't. For the latter, route to the primary or read-after-write from a session-sticky source.

**5. Monitor lag and connection health from day one.** Track replication lag as a first-class metric, alert on it, and watch replica connection count separately from the primary's.

**6. Roll out gradually.** Start by moving one low-risk, high-volume read path to the replica, watch lag and error rates for a few days, then move the rest. Don't cut everything over at once — you want a fast rollback if lag spikes or a query plan behaves differently on the replica.

**7. Plan for failover, even if you don't build it yet.** A read replica isn't a standby by default — decide now whether it should also serve as a failover target later, since that affects whether you set it up as a logical or physical replica.

Start with step 1. It's cheap to check and it tells you whether a replica is actually the right fix.

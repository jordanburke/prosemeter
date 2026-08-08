---
kind: eval-artifact
run: sonnet
variant: E
replicate: r1
task: T8
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Add the replica in stages, so you can back out at any point instead of finding a problem after every read query already depends on it.

**1. Confirm the shape of the problem first.**
Pull query stats (`pg_stat_statements`) to check that the load really is read-heavy, not a handful of missing indexes or one bad query hogging the primary. A replica doesn't fix a slow query — it just gives that slow query more places to run slowly.

**2. Provision the replica.**
Use your cloud provider's managed streaming replication (RDS read replica, Cloud SQL replica, etc.) rather than hand-rolling WAL shipping. Put it in the same region as the primary to keep replication lag low.

**3. Add a read/write split at the connection layer, not scattered through the app.**
One pool for the primary (all writes, plus reads that must be fresh), one pool for the replica (everything else). Don't make every call site decide — wrap it in a data-access layer so the choice is made in one place.

**4. Design for replication lag from day one.**
Streaming replication is asynchronous, so the replica can be milliseconds to seconds behind. Anything that reads its own write immediately after (checkout confirmation, "did my update save") must go to the primary. Everything else — dashboards, listings, search — can tolerate the lag.

**5. Move read traffic over gradually.**
Start with your least critical, most read-heavy endpoint. Watch replica lag and error rates. Expand to the next endpoint once that one's stable, rather than flipping every read at once.

**6. Monitor lag and failover behavior.**
Alert on replication lag exceeding a threshold you've defined as acceptable, and know your plan if the replica falls badly behind — usually falling back to the primary for reads until it catches up.

The core risk isn't setting up the replica — it's forgetting that its data is a few seconds old. Design the read/write split around that from the start.

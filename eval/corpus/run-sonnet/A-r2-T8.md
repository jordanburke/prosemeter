---
kind: eval-artifact
run: sonnet
variant: A
replicate: r2
task: T8
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Here's how I'd approach it, roughly in order.

**1. Confirm the diagnosis first.** Pull `pg_stat_activity` and your metrics dashboard to check the actual read/write split and where the saturation is coming from — CPU, connections, or I/O. A replica only helps if the load is genuinely read-heavy. If a handful of slow queries or missing indexes are the real cause, fix those first; a replica just spreads the same waste across two machines.

**2. Stand up the replica.** Use your cloud provider's managed streaming replication if you're on RDS/Cloud SQL/etc. — it's turnkey and keeps failover options open later. Size it the same as the primary to start; you can right-size once you see real traffic on it.

**3. Add a routing layer in the app.** Don't scatter "which connection do I use" decisions through the codebase. Add a thin layer — two connection pools (`primaryPool`, `replicaPool`) and a rule for which queries go where. The simplest rule: all writes and anything in a transaction go to primary; standalone reads go to replica.

**4. Handle replication lag deliberately, not by accident.** Streaming replication is asynchronous by default, so the replica is always slightly behind. The dangerous case is read-after-write: a user updates their profile, then immediately reloads and reads from the replica before the write has propagated, and sees stale data. Decide per-endpoint: does this read need to be consistent right after a write? If yes, route it to primary (or read your own writes from a cache/session for a few seconds). Don't try to solve this globally — it's a per-feature call.

**5. Roll out gradually.** Start by moving one low-risk, high-volume read endpoint to the replica. Watch replica lag (`pg_stat_replication` / `replica_lag` metric) and primary load under real traffic before moving more.

**6. Monitor lag and alert on it.** Set an alert if lag exceeds a threshold (a few seconds, tuned to what your reads can tolerate) — a lagging replica silently serving stale data is worse than an obvious outage.

**7. Decide what the replica is for beyond load.** If you also want it as a failover target, that's a separate piece of work (promotion process, DNS/connection-string cutover) — worth deciding now so you don't box yourself in on step 2's setup.

Start with step 1 — if the bottleneck turns out to be a couple of bad queries, you may not need the replica at all yet.

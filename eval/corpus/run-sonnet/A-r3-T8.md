---
kind: eval-artifact
run: sonnet
variant: A
replicate: r3
task: T8
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
The core risk with a read replica isn't provisioning it — it's replication lag surfacing as bugs. Plan around that first, then handle the mechanics.

**1. Audit read paths before touching infrastructure.** Go through the endpoints hitting the primary and sort them into: reads that can tolerate a few hundred ms of staleness (listings, feeds, historical data), and reads that can't (anything right after a write in the same user flow — "read your own write" cases like showing a record immediately after creating it). That second bucket needs to keep hitting the primary, or you need a strategy for it (see step 4).

**2. Provision the replica.** Use your database's managed streaming replication (RDS/Cloud SQL read replica, or native Postgres streaming replication if self-hosted). Confirm you can monitor replication lag as a first-class metric before anything else moves.

**3. Add routing in the app, not ad hoc per query.** Two connection pools — `writePool` (primary) and `readPool` (replica) — with a clear rule for which one a given code path uses. A proxy like PgBouncer or Pgpool can also do this, but application-level routing is usually easier to reason about and test.

**4. Handle the read-your-own-write cases explicitly.** Options: route those specific reads to the primary, read from the replica but fall back to primary if lag exceeds a threshold, or accept eventual consistency and tell the UI to hold optimistic state until confirmed.

**5. Roll out gradually.** Start with the lowest-risk, highest-volume read endpoints — the ones causing the saturation. Canary one endpoint, watch replica lag and primary load under real traffic, then expand.

**6. Alert on lag and replica health.** Set a threshold (depends on your tolerance — often a few seconds) and alert before it becomes user-visible staleness. Also have a plan for replica failure: does traffic fail back to primary automatically, or does it 500?

Do the audit in step 1 before writing any routing code — it's what tells you which reads are safe to move and which aren't, and skipping it is how "add a replica" turns into "silent data bugs in production."

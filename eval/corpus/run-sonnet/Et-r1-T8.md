---
kind: eval-artifact
run: sonnet
variant: Et
replicate: r1
task: T8
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
I'd treat this as a staged rollout, not a flip of a switch, since read-replica lag can turn into silent bugs if we route the wrong reads to it.

**1. Confirm the split first.** Pull real numbers on read vs. write load and which queries dominate the saturation. If a handful of heavy reports or dashboard queries are the actual cause, moving just those may fix the problem without touching the rest of the app.

**2. Stand up the replica.** Use the managed option if we're on RDS/Cloud SQL/etc. — streaming replication, one command, built-in monitoring for lag. Self-managed streaming replication works too but adds ops burden we don't need for this.

**3. Route deliberately, not globally.** Add a read/write split at the data-access layer — a thin wrapper or a second connection pool pointed at the replica — rather than editing every call site. Writes always go to the primary. Reads that can tolerate slight staleness go to the replica.

**4. Solve read-after-write explicitly.** This is the sharp edge: a user writes, then immediately reads their own write, and the replica hasn't caught up yet, so they see stale data. Handle it per case — route session-critical reads (a user's own just-written data) to the primary, and send everything else (feeds, listings, other users' data) to the replica.

**5. Monitor lag from day one.** Alert on replication lag, not just replica uptime. If lag grows under load, we need to know before users do.

**6. Roll out gradually.** Start with one low-risk, high-volume read path behind a flag, confirm behavior and lag stay sane under real traffic, then expand. Don't cut everything over at once.

**7. Plan the failure mode.** Decide now what happens if the replica falls behind or goes down — fall back to primary, or degrade gracefully — so it's not a decision made at 2 a.m.

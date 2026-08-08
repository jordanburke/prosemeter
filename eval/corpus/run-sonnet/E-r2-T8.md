---
kind: eval-artifact
run: sonnet
variant: E
replicate: r2
task: T8
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Here's how I'd approach it, in order.

**1. Confirm the diagnosis first.** Check `pg_stat_activity` and query stats to make sure it's read load saturating the primary, not lock contention, a missing index, or a handful of slow queries. Adding a replica to mask a bad query is the wrong fix — check for that before provisioning hardware.

**2. Stand up the replica.** Use your provider's managed streaming replication (RDS read replica, Aurora reader, or manual `pg_basebackup` + streaming replication if self-hosted). Confirm it stays in sync under load — watch replication lag, not just that it exists.

**3. Decide what's allowed to read stale data.** Replication is async, so replica reads lag the primary by some amount — usually milliseconds, sometimes more under load. Go through your read paths and sort them:
   - Fine to read from the replica: dashboards, reports, search, anything list-y or historical.
   - Must read from the primary: anything right after a write in the same request (read-your-writes), balance checks before a transaction, anything where staleness causes a bug, not just a UI glitch.

**4. Route traffic at the application layer, not blindly.** Add a read/write split in your data access layer — a wrapper that sends `SELECT`s to the replica pool and everything else to the primary. Don't rely on a proxy that guesses based on SQL syntax alone; be explicit for the read-your-writes cases from step 3.

**5. Roll out gradually.** Start with the lowest-risk, most replica-load-heavy path (probably the largest read endpoint). Watch replication lag and error rates. Expand from there.

**6. Add monitoring before you need it.** Alert on replication lag, replica CPU, and primary CPU. If lag grows under load, you're back to square one for that path.

**7. Plan for replica failure.** Decide now whether the app falls back to the primary if the replica is unhealthy, or fails the read — don't discover this during an incident.

Start with step 1. If it turns out to be a missing index or one bad query, you may not need the replica at all.

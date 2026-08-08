---
kind: eval-artifact
run: 4
variant: E
replicate: r2
task: T8
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
A read replica is the right move, but I would spend a day proving the reads are actually irreducible before adding a server. Saturation often turns out to be a handful of bad queries.

**First, find out what is burning the primary.** Turn on `pg_stat_statements` and sort by `total_exec_time`. In my experience two or three queries account for most of the load, and an index or a fixed N+1 buys you a year of headroom for an afternoon of work. Check `pg_stat_user_tables` for sequential scans on big tables while you are in there. If this step solves it, stop — a replica is permanent operational cost.

**If the load is real, provision the replica with streaming replication.** Managed Postgres gives you this in a console click. Self-hosted, you set up a physical standby with a replication slot, and you monitor slot lag so a stalled replica cannot fill the primary's disk with WAL.

**Then route reads explicitly, at the application layer.** I would not use a proxy that guesses. Create two pools in the Node app, `primary` and `replica`, and make every call site choose. Explicit beats magic here, because the failure mode of guessing wrong is a user not seeing their own write.

**Deal with replication lag before you move any traffic.** The replica is behind by milliseconds normally and by seconds under load. So:

- **Writes and read-after-write go to the primary.** If a request writes and then reads the same data, or the user just submitted a form and is about to see the result, use the primary. This is the rule people forget and the one that generates the bug reports.
- **Analytics, reports, dashboards, search, and list views go to the replica.** These tolerate a few seconds of staleness.
- **Anything that computes a value it then writes back goes to the primary.** Reading a stale balance and writing a derived number is a correctness bug, not a freshness one.

**Move traffic in stages.** Start with your heaviest read-only endpoint — usually a report or a listing page. Watch primary CPU, replica lag, and that endpoint's error rate for a few days. Then move the next one.

**Wire up the operational parts before you rely on it.** You need lag alerting (`pg_last_xact_replay_timestamp`), a documented answer for what happens when the replica dies, and connection pool limits sized so both pools together stay under `max_connections`. If the replica going down should degrade rather than fail, add a fallback to the primary — but cap it, or a replica outage becomes a primary outage.

One caution: a replica does not help write contention, lock waits, or connection exhaustion. If any of those are part of what you are seeing, sort them separately. Worth a look at the wait events in `pg_stat_activity` during the business-hours peak before you commit to this.

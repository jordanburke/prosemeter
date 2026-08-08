---
kind: eval-artifact
run: 4
variant: A
replicate: r1
task: T8
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
A read replica is a reasonable answer, but I'd want to do a couple of things before and around it, because replicas solve *volume* and don't solve *waste* — and a saturated primary is often more waste than volume.

**First, confirm what's actually saturating it.**

Half an hour with `pg_stat_statements` sorted by `total_exec_time` usually tells the story. What I'd want to know:

- Is this genuinely spread across many cheap queries (real volume — replica helps), or a handful of expensive ones (fix the queries — replica just moves the pain)?
- Any sequential scans on large tables? A missing index can be a 100x difference and takes an afternoon.
- Any N+1s from the ORM? Very common, very invisible in aggregate metrics, and a replica happily serves 500 tiny queries per request just as inefficiently as the primary did.
- Is it CPU-bound, I/O-bound, or lock-bound? `pg_stat_activity` wait events. If we're blocking on locks, more read capacity changes nothing.
- Are we connection-thrashing? If there's no pooler in front, we may be paying Postgres backend-fork costs rather than query costs.

I'm not saying skip the replica. I'm saying if 60% of the load is one unindexed report query, we should know that before we take on the operational complexity, and we'll want that fixed either way.

**Assuming the volume is real, here's how I'd sequence it.**

*Provision.* Streaming replication, same major version, same instance class to start. If we're on RDS/Aurora/Cloud SQL this is largely a console operation. Set `hot_standby_feedback` deliberately — on, and long analytical queries on the replica can block vacuum on the primary and cause bloat; off, and those queries get cancelled by replication conflicts. My default is off with a modest `max_standby_streaming_delay`, then revisit if we start seeing cancellations.

*Get lag observable before routing anything.* `pg_stat_replication` on the primary, dashboard the byte lag and the time lag, alert on it. Lag is the thing that will bite us and we should be able to see it before we depend on it.

*Decide the routing model.* This is the real design decision, and I'd argue for **explicit over automatic**. Two connection pools in the app, `readPool` and `writePool`, and call sites choose. Automatic "route SELECTs to the replica" middleware is seductive and it's how you get subtle bugs, because it can't know that this particular SELECT happens to be inside a transaction that just wrote, or that this read is the one the UI needs to be immediately consistent.

*Then the actual hard part: read-your-writes.* Replication is asynchronous. A user submits a form, we write to the primary, we redirect, the next request reads from the replica, and the row isn't there yet. Now they think it failed and submit again. This is the number one way replica rollouts go wrong, and it shows up as weird intermittent bug reports rather than as an outage.

Options, roughly in order of how much I like them:

- **Route reads that follow a write in the same user flow back to the primary.** Sticky-to-primary for a short window after any write in that session. Simple, coarse, effective. Usually a small amount of middleware.
- **Never route anything inside a transaction to the replica.** Non-negotiable — a transaction has to be on one connection.
- **LSN tracking** — capture `pg_current_wal_lsn()` after a write, and have the replica read wait until it's caught up past that point. Correct and precise, more machinery.

*Roll out incrementally.* Start with the reads that are obviously safe and obviously heavy: analytics, reporting, exports, admin dashboards, search. These tolerate seconds of staleness by nature, and they're often the queries hurting the primary most. Ship that, watch primary CPU, watch lag, watch error rates. Then expand into the user-facing read paths one at a time, each with a deliberate answer to "what breaks if this data is two seconds old?"

*Size the connection pools together.* Two pools now, and the total across all pods still has to fit under each server's `max_connections`. Easy to accidentally double the connection count and trade a CPU problem for a connection-exhaustion problem.

**Things I'd want decided up front, not discovered later:**

- What happens on replica failure? The app should degrade to the primary, not error. Fail-open, with an alert.
- What happens on replica lag spikes? Ideally the same — if lag exceeds a threshold, shed back to primary automatically.
- Is this also our failover story, or is that separate? Different requirements, worth being explicit.
- How do we test it? Staging with artificially injected lag is the only way to catch read-your-writes bugs before users do.

**Rough shape:** a day or two on query analysis and the cheap wins, a day to provision and instrument, a few days for the routing layer and pool split, then a phased rollout over a couple of weeks. The query-analysis step is the one I'd most resist skipping — it's cheap and it changes how much of the rest we need.

Happy to take the `pg_stat_statements` pass and bring the findings back before we commit to the shape.

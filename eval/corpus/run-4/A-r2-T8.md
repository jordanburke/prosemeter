---
kind: eval-artifact
run: 4
variant: A
replicate: r2
task: T8
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Reasonable direction, but I'd want to confirm the diagnosis before adding infrastructure. A read replica is real operational weight — replication lag to reason about, failover to think about, a routing layer in the app — and if the actual problem is three unindexed queries, we'd be paying that cost permanently to avoid an afternoon of work.

**First: is it really read volume?**

Turn on `pg_stat_statements` if it isn't already and sort by `total_exec_time`. In my experience this comes back one of two ways. Either load is spread broadly across many queries, in which case yes, we've genuinely outgrown one box and a replica is the answer. Or two or three queries dominate — a missing index, an N+1 from an ORM, a dashboard doing a full scan every thirty seconds — and fixing those buys back more headroom than a replica would, for a fraction of the effort.

Also check `pg_stat_activity` during a peak: what's the actual concurrency, and how much of it is `idle in transaction`? Connections held open across application-level work will saturate a primary at surprisingly low query rates, and a replica doesn't help with that at all.

**If it is genuinely read volume, here's the sequence.**

1. **Connection pooling first, if we don't have it.** PgBouncer in transaction mode. This is cheap, reversible, and frequently recovers enough capacity to defer the whole project. It also becomes the routing layer later, so it's not throwaway work.

2. **Stand up a streaming replica** and let it run with no traffic for a week. Watch `pg_stat_replication` for lag under real peak load. We need to know the lag distribution — not the average, the p99 and the worst case during our heaviest write windows — because that number determines what we can safely route.

3. **Classify reads before routing any.** This is the part that decides whether the project succeeds. Replication is asynchronous, so a replica read can return data older than a write the same user just made. Three buckets:
   - **Safe to route** — analytics, reporting, search, admin dashboards, anything where seconds of staleness is invisible. Route these first, they're usually a large share of the load.
   - **Never route** — read-after-write within a request, anything feeding a subsequent write, anything under a transaction. These stay on the primary.
   - **Needs a decision** — user-facing reads right after a user action. "I saved it and it's not there" is the bug we'll get. Options: route the user to the primary for a short window after their own write, or use `synchronous_commit` selectively, or just leave these on the primary.

4. **Make routing explicit, not automatic.** I'd rather have `db.replica.query(...)` at the call site than middleware that guesses from the SQL verb. Verb-sniffing breaks on CTEs with writes, on functions that write, and on anyone who wraps a read in a transaction. Explicit is greppable and reviewable.

5. **Roll out one endpoint at a time**, behind a flag, watching error rates. Start with the reporting queries — highest load, lowest staleness risk.

**Things I'd want settled up front:** what happens when the replica falls over or lags badly — does the app fail, or fall back to the primary and possibly finish the job of saturating it? Who gets paged on replication lag, and at what threshold? And are we planning to use this replica for failover too, because that changes the sizing and the placement.

Want me to run `pg_stat_statements` and bring the top-20 to standup? That'll tell us in about an hour which branch we're on.

---
kind: eval-artifact
run: 4
variant: E
replicate: r3
task: T8
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
I'd add the replica, but I'd spend the first day proving reads are really the problem — a saturated primary is often a handful of bad queries, and a replica just gives those queries a second machine to be slow on.

**First, find where the load goes.** Turn on `pg_stat_statements` and sort by `total_exec_time`. Check `pg_stat_activity` during the business-hours peak for what's actually running. In my experience two or three queries account for most of it, and an index or a fixed N+1 buys more headroom than a replica — for a fraction of the work. Do that pass first, and keep the numbers so you can tell whether the replica helped later.

**Then decide what can move.** Replicas lag, usually milliseconds but seconds under load. So sort every read into one of two buckets: tolerates stale data, or doesn't. Reports, search, list views, and exports move happily. Anything read immediately after a write does not — a user saving their profile and getting the old value back is a bug report, not a performance win.

**Route explicitly, not automatically.** I'd expose two pools in the Node app and make callers choose:

```ts
const rows = await db.replica.query(...)  // reports, lists
const rows = await db.primary.query(...)  // after writes, in transactions
```

Explicit routing beats a proxy that guesses from the SQL. It's obvious in review which bucket a query is in, and there's no magic to debug at 2am. Default the pool to primary, so a new query is correct until someone opts it out.

**Handle read-your-writes.** Pick one approach and hold to it. Simplest: after a write, pin that user's session to the primary for a few seconds. More precise: capture the write's LSN and have the replica wait for it. Start with the pin.

**Roll it out gradually.** Stand up the replica, watch `pg_stat_replication` for lag under real load, then move one endpoint. Watch it for a day. Move the rest in batches, heaviest first.

**Set up the operational bits before you depend on it.** Alert on replication lag and on the replica being down. Decide what the app does when lag spikes — I'd fall back to the primary above a threshold, which trades load for correctness. And know your failover story: if the replica is only for reads, losing it should degrade, not page.

One caution: long-running queries on the replica can conflict with replay and either get cancelled or stall replication, depending on `hot_standby_feedback`. If we point analytics at it, tune that deliberately.

Rough shape: a day on query analysis, a day to provision and observe, then a week of moving endpoints. Most of the win may land on day one.

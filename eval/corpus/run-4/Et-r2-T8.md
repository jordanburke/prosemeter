---
kind: eval-artifact
run: 4
variant: Et
replicate: r2
task: T8
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
A replica is probably right, but I would spend a day confirming the diagnosis before spending a week on the infrastructure. A replica adds a permanent correctness problem — stale reads — and it is worth being sure you need it.

**First, find out what is saturating the primary.**

Check `pg_stat_statements` ordered by `total_exec_time`. In most saturated databases I have seen, a handful of queries account for most of the load, and one or two are missing an index or doing a sequential scan that a `WHERE` clause change would kill. That fix is hours, not weeks, and it is free. Also check CPU against I/O — if you are I/O bound with a low cache hit ratio, more RAM or a bigger instance buys you months for a fraction of the effort.

If the load is spread evenly across many legitimate queries, the replica is the answer. Move on.

**Then set it up.**

Use your provider's managed streaming replica — RDS, Cloud SQL, whatever you are on. Do not hand-roll replication. Put it in the same region unless you have a specific reason, because cross-region lag will hurt.

In the app, create a second connection pool pointed at the replica. Keep it separate from the primary pool so you can size and monitor them independently.

**Now the part that decides whether this goes well: routing.**

Make replica reads opt-in per query, never automatic. An automatic "route all SELECTs to the replica" layer will silently break read-after-write. The user updates their profile, the next page load reads from a replica that is 200ms behind, and their change appears to have vanished. That bug is intermittent, hard to reproduce, and lands on support rather than on you.

So: default everything to the primary, then move specific read paths over one at a time. Start with the ones that tolerate staleness — dashboards, reports, search, list views, analytics. Leave anything a user just wrote to on the primary. Anything inside a transaction stays on the primary by definition.

**Guard the edges.**

- Monitor `pg_stat_replication` lag and alert on it. Decide up front what the app does when lag spikes — I would fail reads back to the primary above a threshold, accepting the load rather than serving wrong data.
- Make the replica connection read-only at the database user level, so a misrouted write fails loudly instead of doing something strange.
- Check whether your ORM or query builder can be told which pool to use cleanly. If it cannot, that shapes the design more than anything else here.

**Expect this to take longer than it looks.** The replica takes an afternoon. Auditing every read path and deciding which ones tolerate lag is the real work, and it is worth doing deliberately.

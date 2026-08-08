---
kind: eval-artifact
run: 1
variant: G
replicate: r2
task: T2
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. Both are true. You got the write side.

An index is a second copy of some of your data, sorted. The database keeps it in a B-tree beside the table. When you read, that sorted copy lets the engine jump straight to the rows you want instead of scanning the whole table. That's the win everyone talks about.

But the copy has to stay correct. So every `INSERT` writes the row **and** walks the tree to put a new entry in the right slot. Every `DELETE` removes both. Every `UPDATE` that touches an indexed column removes the old entry and adds a new one. You added work to every write in exchange for less work on some reads.

It gets worse than "one extra write":

- **Page splits.** When the leaf page the new entry belongs in is full, the engine splits it in two and fixes up the parent. That's a burst of extra I/O, and it can cascade up the tree.
- **Random I/O.** Table rows often append at the end. Index entries land wherever the sort order says, which is all over the disk.
- **More WAL.** The write-ahead log records the index change too, so your log volume goes up and so does replication lag.
- **It multiplies.** Five indexes means five trees to maintain on every insert.

So the question isn't "is this index good," it's "does this index earn its keep." Check three things:

1. **Is it used?** Look at `pg_stat_user_indexes` on Postgres. An index with `idx_scan` near zero is pure cost. Drop it.
2. **Is it redundant?** An index on `(a, b)` already serves queries filtering on `a` alone. A separate index on `(a)` buys you nothing and charges you full price.
3. **Does the read win beat the write cost?** A table you write to constantly and query rarely wants few indexes. A reporting table you load nightly and query all day wants many.

Practical move for right now: run `EXPLAIN ANALYZE` on the query you added the index for, and confirm the planner actually picks it. People often add an index the planner ignores because the column has low cardinality, or the query wraps the column in a function, or the table is small enough that a sequential scan is genuinely faster. Then you paid the write cost for nothing.

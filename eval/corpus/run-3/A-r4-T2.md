---
kind: eval-artifact
run: 3
variant: A
replicate: r4
task: T2
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Both things are true — indexes make *reads* faster and *writes* slower. The advice you got just left off the second half.

An index is a separate data structure (usually a B-tree) that the database maintains alongside the table. It's a sorted copy of the indexed column plus a pointer back to the row. That sorted copy is exactly what lets a read skip a full table scan.

But it has to stay correct. So every write now does more work:

- **INSERT** — write the row, then also insert into the index, in sorted position. That may split a B-tree page, which cascades.
- **DELETE** — remove the row, then remove or tombstone the index entry.
- **UPDATE** — if you touched an indexed column, the old index entry has to be removed and a new one inserted at a different position in the tree. (If you didn't touch any indexed column, most databases can skip index maintenance entirely — Postgres calls this a HOT update.)

Multiply that by the number of indexes on the table. Five indexes means an insert is doing six writes, not one. That's the mental model: **an index is a read cache you pay for on every write.**

There are second-order costs too. More index pages means more of your buffer pool is spent on indexes instead of table data. And every index write is also a WAL/redo-log write, so you're pushing more bytes to disk per transaction.

The tuning question is not "should I have indexes" but "is this one earning its keep." A few things to check:

- **Is it actually used?** In Postgres, `pg_stat_user_indexes` shows scan counts per index. An index with `idx_scan = 0` after a week of production traffic is pure write tax. Drop it.
- **Is it redundant?** An index on `(a)` is redundant if you already have `(a, b)` — the composite serves prefix lookups on `a` fine. People accumulate these.
- **Is it on a hot-updated column?** Indexing a column that changes on every write is the worst case. Indexing something write-once like `created_at` is much cheaper.
- **How wide is it?** Indexing a long text column costs far more per write than indexing a bigint.

If the write slowdown is real and the read speedup is real, that's a genuine trade and you get to decide which side matters for this table. Ingest-heavy tables want few indexes; report tables want many. What you can't have is both for free.

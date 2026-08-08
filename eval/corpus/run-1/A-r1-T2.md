---
kind: eval-artifact
run: 1
variant: A
replicate: r1
task: T2
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
reviewerFinding:
  severity: minor
  foundBy: "opus"
  error: "'Indexes make writes slower, always.' False for a targeted UPDATE/DELETE on the indexed column, and for Postgres HOT updates touching no indexed column."
---
You got told half the sentence. Indexes make *reads* faster. They make *writes* slower, always. That's the trade, and it's not a bug in what you did.

**Why**

An index is a second copy of some of your data, kept sorted (usually a B-tree). It exists so the database can find rows without scanning the whole table.

But the database has to keep that copy correct. So:

- **INSERT** — write the row to the table *and* insert a key into every index on that table. Each index insert means walking down the tree to the right leaf page, writing there, and occasionally splitting a page when it's full (which cascades up the tree).
- **UPDATE** — if you changed a column that's in an index, the old index entry has to be removed and a new one added, possibly in a completely different part of the tree. Update an indexed column and you're doing a delete+insert on the index even though the row "just changed."
- **DELETE** — remove from the table plus every index.

So a table with five indexes turns one logical write into six physical write paths. That's the linear part.

**The part that actually bites**

The slowdown is usually worse than "one extra write" because of *where* those writes land. Your table inserts are typically sequential — new rows go at the end, on hot pages already in memory. Index inserts go wherever the sorted key says they go, which for something like an index on `email` or a UUID is effectively a random page in a large tree. Random page = likely not in the buffer pool = read it from disk first, dirty it, and now it has to be flushed later. You've converted a sequential append into scattered random I/O.

This is why an index on a monotonically increasing column (`created_at`, auto-increment id) costs relatively little, and an index on a random-ish high-cardinality column costs a lot. Same number of index entries, wildly different I/O pattern.

Also: more indexes = more WAL / redo log volume per transaction, which means more to flush at commit and more replication lag if you have replicas.

**How to think about it**

Indexes are a *bet*: you're paying a fixed tax on every write in exchange for a large discount on specific reads. The bet is good when reads that use the index are frequent and expensive without it. It's bad when:

- The index isn't actually used by your queries (check the query plan — `EXPLAIN`)
- It's redundant with an existing index. An index on `(a, b)` already serves queries filtering on `a` alone. A separate index on `(a)` is pure write cost, zero read benefit.
- The column has low cardinality. An index on a boolean `is_active` where 90% are true generally won't be used for the `true` case — the planner correctly decides a scan is cheaper.

**What to do**

1. Run `EXPLAIN` (or `EXPLAIN ANALYZE`) on the query you added the index for. Confirm the planner is actually using it and the improvement is real.
2. Check whether an existing index already covers you — look for the leftmost-prefix overlap.
3. If you have Postgres, `pg_stat_user_indexes` shows `idx_scan` per index. Indexes with `idx_scan` near zero after a week of production traffic are pure cost — drop them.
4. If the write path is genuinely latency-sensitive and the read is not, consider whether the read can be served another way (a materialized rollup, caching, a read replica) instead of an index on the hot write table.

Rough calibration so you're not scared of indexes: one well-chosen index on a normal OLTP table is usually a few percent on write latency and nobody notices. It's the accumulated *eight indexes nobody audited* on your highest-throughput table that shows up on a graph. Measure yours rather than trusting my number — `EXPLAIN ANALYZE` on the insert, with and without, on realistic data volume.

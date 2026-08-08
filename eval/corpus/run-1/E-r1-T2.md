---
kind: eval-artifact
run: 1
variant: E
replicate: r1
task: T2
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. That is the trade, and nobody mentions the second half.

An index is a second copy of your data, sorted. The database keeps it in a B-tree next to the table. When you insert a row, the database writes the row **and** walks the tree to insert a key in the right place. Add a second index and it does that twice. Every index you add is more work on every write.

The cost is not just the extra write. Three things pile on:

- **Page splits.** A B-tree node fills up, so the database splits it in two and rewrites both. Random keys like UUIDv4 hit this constantly, because each insert lands in a different part of the tree. Sequential keys append to the end and mostly avoid it.
- **Random I/O.** The table row goes in one place, the index entry goes somewhere else. Your one logical write becomes several scattered physical writes.
- **Bigger WAL.** The write-ahead log has to record the index change too, so replication and recovery both carry more bytes.

Updates are the worst case. Change an indexed column and the database deletes the old index entry and inserts a new one, because the key moved in the sort order. Postgres often has to write a whole new row version and update *every* index pointing at it, even the ones on columns you did not touch.

**What to do:**

Check whether the index earns its keep. In Postgres, `pg_stat_user_indexes` shows `idx_scan` — a count near zero means nothing uses it, so drop it.

```sql
SELECT relname, indexrelname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan;
```

Then look for redundancy. An index on `(a, b)` already serves queries filtering on `a` alone, so a separate index on `(a)` is dead weight. Three narrow indexes are usually worse than one composite index that covers the same queries.

Two more moves. Drop indexes before a bulk load and rebuild them after — building once is far cheaper than maintaining them row by row. And if the index only exists for one query on a small slice of the table, make it partial with a `WHERE` clause so it stays small and cheap.

Rule of thumb: index what you filter, join, and sort on. Everything else costs you on every insert and buys you nothing.

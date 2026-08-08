---
kind: eval-artifact
run: 1
variant: B
replicate: r2
task: T2
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes make *reads* faster. Writes pay for that speed.

Think of an index as a second, sorted copy of one column plus a pointer back to the row. When you `INSERT`, the database now writes the row *and* inserts into that sorted structure — finding the right spot, possibly splitting a page, and logging the whole thing. Every index you add is another structure to keep in sync on every insert, update, and delete. Five indexes means roughly five extra pieces of bookkeeping per write.

A few things that make it worse than you'd expect:

- **Updates touch the index even when the indexed column doesn't change**, in some engines, because the row moves. Postgres in particular may write a whole new row version and add entries to *every* index.
- **Random insertion order hurts.** Indexing something sequential like an auto-increment ID appends to the end of the structure — cheap. Indexing something random like a UUIDv4 or an email scatters writes across the whole index, which means more pages touched and more disk I/O.
- **Wide indexes cost more.** A composite index on four columns is a lot more bytes to write than one on a single integer.

So it's a trade, not a free win. The rule of thumb: add an index because a specific slow query needs it, not preemptively. Then check the ones you have:

```sql
-- Postgres: indexes nothing has ever used
SELECT relname, indexrelname, idx_scan
FROM pg_stat_user_indexes WHERE idx_scan = 0;
```

Unused indexes are pure cost — they slow every write and buy you nothing. Also look for redundant ones: if you have an index on `(a, b)`, a separate index on `(a)` is usually dead weight, because the composite can serve queries on `a` alone.

If the write slowdown is on a table you bulk-load, the standard move is to drop the indexes, load, and rebuild them afterward — much faster than maintaining them row by row.

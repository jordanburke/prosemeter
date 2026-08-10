---
kind: eval-artifact
run: 6
variant: R
replicate: r1
task: T2
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

Indexes speed up reads and slow down writes. That is the whole trade, and nobody mentioned the second half.

## What an index is

An index is a second copy of one or more columns, kept in sorted order. A B-tree index on `users.email` is a separate structure. It holds every email in the table with a pointer to the row it came from. Sorted order is what makes lookups fast. The database can binary-search the index instead of scanning every row.

That structure does not maintain itself. The database maintains it, on every write.

## What each write now costs

**An insert** used to write one row. Now it writes the row and adds an entry to the index. That means finding the right position in the sorted structure, writing there, and splitting a page when the page is full. Every extra index is another such insertion. Ten indexes mean eleven writes for one logical insert.

**A delete** has the same shape. Remove the row, then remove the index entry.

**An update** is where it gets interesting. Update a column that carries no index, and the database can skip the index work. Update an indexed column, and the entry has to move, because the old position no longer sorts correctly. That is a delete plus an insert inside the index.

**Page splits** are the cost people miss. A B-tree stores entries in fixed-size pages. Inserting into a full page splits it into two half-full pages. Splitting is expensive, and it fragments the index over time. Random insertion order splits far more than sequential order does. A UUID primary key or an index on a hash lands anywhere in the tree. Sequential inserts land at the right edge.

**Write-ahead logging doubles the accounting.** The index change is itself a durable change, so it goes into the WAL too. More index churn means more log volume. More log volume means more I/O, longer checkpoints, and more replication traffic when you run replicas.

## Why the slowdown runs worse than you expect

Three effects compound:

- The index pages you update compete with the table pages for buffer cache. If the index is large and inserts are random, you start reading index pages from disk just to write to them.
- Lock and latch contention on hot index pages rises under concurrency. A monotonically increasing index — `created_at`, an auto-increment id — concentrates every inserter on the same rightmost page.
- In Postgres, an update to an indexed column forces a non-HOT update. The new row version must be linked from every index, instead of chained in the heap. That is a step change in cost, not a gradual one.

## What to do about it

First, confirm the index earns its keep. Every database can report how often an index has been used:

```sql
-- Postgres
SELECT relname, indexrelname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan;
```

An index with zero scans is pure cost. Drop it.

Then reduce redundancy. An index on `(a, b)` already serves queries that filter on `a` alone. A separate index on `(a)` is dead weight. Check for that overlap.

Then narrow the index instead of removing it. A partial index — `WHERE status = 'active'` — maintains entries only for the rows you query. Writes to the other rows cost nothing. A covering index runs the other way. It adds columns and adds write cost, so use it only when it removes a heap fetch from a hot query.

Finally, if the write path is a bulk load, drop the indexes, load, and rebuild. Building an index once over sorted data costs far less than maintaining it across a million individual inserts.

## The rule to carry forward

Indexes are not free speed. They are a cache of sorted order, paid for on every write that touches them. The right number is the smallest set that covers your query patterns. "Everyone says indexes make things faster" is true about the queries they serve. It is false about every other statement against the table.

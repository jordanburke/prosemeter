---
kind: eval-artifact
run: 6
variant: P
replicate: r1
task: T2
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

Indexes speed up reads and slow down writes. That is the whole trade. Nobody mentioned the second half.

## What an index is

An index is a second copy of some of your data, held in sorted order. A B-tree index on `users.email` is a separate structure storing every email next to a pointer to its row. Sorted order is what makes lookups fast: the database can binary-search the index instead of scanning every row.

Nothing maintains that structure for free. The database maintains it, on every write.

## What each write costs now

**An insert** used to write one row. Now it writes the row and adds an index entry — find the right position in the sorted structure, write there, and split a page if that one is full. Each extra index is another insertion. Ten indexes means eleven writes for one logical insert.

**A delete** has the same shape: remove the row, remove the index entry.

**An update** is the interesting case. Update an unindexed column and most databases skip the index work. Update an indexed column and the entry must move, because its old position is no longer sorted correctly — a delete plus an insert inside the index.

**Page splits** are the cost people miss. A B-tree stores entries in fixed-size pages. Inserting into a full page splits it into two half-full pages, which is expensive and fragments the index over time. Random insertion order — a UUID primary key, an index on a hash — splits far more often than sequential order, because sequential inserts always land at the right edge of the tree.

**Write-ahead logging doubles the accounting.** An index change is a durable change, so it goes into the WAL too. More index churn means more log volume, more I/O, longer checkpoints, and more replication traffic if you run replicas.

## Why it can be worse than you expect

Several effects compound.

- Index pages you are updating compete with table pages for the buffer cache. If the index is large and the inserts are random, you start reading index pages from disk just to write to them.
- Lock and latch contention on hot pages rises under concurrency. A monotonically increasing index — `created_at`, an auto-increment id — points every inserter at the same rightmost page.
- In Postgres, updating an indexed column forces a non-HOT update: the new row version must be linked from every index rather than chained in the heap. That is a step change in cost, not a gradual one.

## What to do about it

First, check whether the index earns its keep. Every database can report how often an index has been used:

```sql
-- Postgres
SELECT relname, indexrelname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan;
```

An index with zero scans is pure cost. Drop it.

Next, cut redundancy. An index on `(a, b)` already serves queries that filter on `a` alone, so a separate index on `(a)` is usually dead weight.

Then narrow rather than remove. A partial index — `WHERE status = 'active'` — maintains entries only for the rows you query, so writes to the other rows cost nothing. A covering index runs the other way: it adds columns and adds write cost, so use it only when it removes a heap fetch from a hot query.

Finally, if the slow write path is a bulk load, drop the indexes, load, and rebuild. Building an index once over sorted data is far cheaper than maintaining it across a million individual inserts.

## The rule to carry forward

Indexes are not free speed. They are a cache of sorted order, paid for on every write that touches them. The right number is the smallest set that covers the queries you actually run. "Indexes make things faster" is true of the queries they serve and false of everything else in the table.

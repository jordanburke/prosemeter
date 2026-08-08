---
kind: eval-artifact
run: 5
variant: A
replicate: r1
task: T2
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. That is the whole trade, and nobody mentioned the second half.

## What an index actually is

An index is a second copy of some of your data, kept in sorted order. A B-tree index on `users.email` is a separate structure holding every email in the table alongside a pointer to the row it came from. Sorted order is what makes lookups fast: the database can binary-search the index instead of scanning every row.

But that structure is not maintained by magic. The database maintains it, and it does so on every write.

## What each write now costs

**An insert** used to write one row. Now it writes the row and inserts an entry into the index — which means finding the right position in the sorted structure, writing there, and possibly splitting a page if it is full. Every extra index is another such insertion. Ten indexes means eleven writes for one logical insert.

**A delete** has the same shape: remove the row, remove the index entry.

**An update** is where it gets interesting. If you update a column that is not indexed, most databases can skip the index work entirely. If you update an indexed column, the index entry has to move — the old position is no longer sorted correctly — so it is a delete plus an insert in the index.

**Page splits** are the cost people miss. A B-tree stores entries in fixed-size pages. Inserting into a full page splits it into two half-full pages, which is expensive and also fragments the index over time. Random insertion order — a UUID primary key, an index on a hash — causes far more splitting than sequential order does, because sequential inserts always land at the right edge of the tree.

**Write-ahead logging doubles the accounting.** The index change is itself a durable change, so it goes into the WAL too. More index churn means more log volume, which means more I/O, longer checkpoints, and more replication traffic if you have replicas.

## Why the slowdown may be worse than you expect

A few effects compound:

- The index pages you are updating compete with the table pages for buffer cache. If the index is large and inserts are random, you start reading index pages from disk just to write to them.
- Lock and latch contention on hot index pages goes up under concurrency. A monotonically increasing index — `created_at`, an auto-increment id — concentrates every inserter on the same rightmost page.
- In Postgres specifically, an update to an indexed column forces a non-HOT update, meaning the new row version must be linked from every index rather than just chained in the heap. That is a step change in cost, not a gradual one.

## What to do about it

First, confirm the index is earning its keep. Every database can tell you how often an index has been used:

```sql
-- Postgres
SELECT relname, indexrelname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan;
```

An index with zero scans is pure cost. Drop it.

Then reduce redundancy. An index on `(a, b)` already serves queries filtering on `a` alone, so a separate index on `(a)` is usually dead weight. Check for that overlap.

Then consider narrowing the index rather than removing it. A partial index — `WHERE status = 'active'` — only maintains entries for rows you actually query, so writes to the other rows cost nothing. A covering index the other way around adds columns and adds write cost, so use it only when it removes a heap fetch from a hot query.

Finally, if the write path is a bulk load, drop the indexes, load, and rebuild. Building an index once over sorted data is dramatically cheaper than maintaining it across a million individual inserts.

## The rule to carry forward

Indexes are not free speed; they are a cache of sorted order, paid for on every write that touches them. The right number is the smallest set that covers your actual query patterns. "Everyone says indexes make things faster" is true about the queries they serve and false about everything else in the table.

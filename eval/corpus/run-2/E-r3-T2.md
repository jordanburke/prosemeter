---
kind: eval-artifact
run: 2
variant: E
replicate: r3
task: T2
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. You paid the write cost to buy the read benefit. That is the trade, and it is working as designed.

Here is why. An index is a second data structure, usually a B-tree, that the database keeps sorted by your indexed column. The table itself does not know about it. So every insert writes the row *and* writes a new entry into the index. Every delete removes both. Every update that touches an indexed column removes the old index entry and inserts a new one in a different place in the tree.

The cost compounds in three ways.

**More writes per statement.** Five indexes on a table mean six writes for one insert, not one.

**Page splits.** The index keeps its entries in sorted order. Inserting into the middle of a full page forces the database to split that page in two and rewrite both. Random insert order, like UUIDv4 keys, causes this constantly. Sequential keys mostly append to the end and split far less.

**Locks and I/O.** Each index page you touch is a page you may have to lock, read from disk, and later flush. Writes that used to hit one hot page now scatter across several.

So: measure whether the index earns its cost. Check that queries actually use it:

```sql
EXPLAIN ANALYZE SELECT ... WHERE your_column = ...;
```

If the plan shows a sequential scan, the index is pure overhead and you should drop it. If it shows an index scan and the query matters, keep it and accept the write cost.

A few ways to pay less. Drop indexes nobody uses — `pg_stat_user_indexes` shows scan counts per index in Postgres. Prefer one composite index over three single-column ones when your queries filter on the same combination. Avoid indexing columns that change on most updates. And if you are bulk loading, drop the index, load, then rebuild it; that is far cheaper than maintaining it row by row.

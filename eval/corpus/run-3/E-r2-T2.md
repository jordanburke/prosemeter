---
kind: eval-artifact
run: 3
variant: E
replicate: r2
task: T2
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. You got exactly the trade you paid for.

Think about what an index is. It is a second copy of some of your data, sorted, kept in its own B-tree structure. A read can jump straight to the rows it wants instead of scanning the table. But every write now has to update two things: the table and the index.

So each operation costs more:

- **INSERT** writes the row, then walks the index tree and inserts a new entry in sorted position. If the target page is full, the database splits it, which rewrites pages and can cascade up the tree.
- **UPDATE** costs nothing extra if you did not touch an indexed column. If you did, the database deletes the old index entry and inserts a new one somewhere else in the tree.
- **DELETE** removes the row and marks the index entry dead.

Add write-ahead logging on top. Every one of those page changes gets written to the WAL first for durability, so more pages touched means more log volume, more disk I/O, and more work for the checkpointer.

A few things make this worse than the textbook case:

**Random insert order.** An index on a UUID or a hash scatters inserts across the whole tree, so each one touches a cold page. An index on an autoincrement ID or a timestamp appends to the right edge, stays hot in cache, and costs far less.

**Too many indexes.** The cost is per index, and it adds up. Five indexes means five trees to maintain on every insert.

**Bulk loads.** Loading a million rows with the index in place is much slower than loading them and building the index after.

What to do. First ask whether the index earns its cost — check whether the planner actually uses it, with `pg_stat_user_indexes` on Postgres or the equivalent on your engine. Drop indexes nothing queries. Second, check for redundancy: an index on `(a, b)` already serves queries filtering on `a` alone, so a separate index on `a` is dead weight. Third, if this is a write-heavy table and the index serves one rare report, consider running that report against a replica instead.

The rule to carry forward: indexes trade write throughput and disk for read latency. That is usually a good trade, because most tables are read far more than they are written. It is a bad trade on a high-volume append table nobody queries by that column.

---
kind: eval-artifact
run: 5
variant: E
replicate: r3
task: T2
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
An index speeds up reads and slows down writes. Both are true. You bought faster lookups with slower inserts, updates, and deletes.

The reason is that an index is a second copy of your data, kept sorted. The table holds the rows. The index holds the indexed column plus a pointer back to the row, ordered so the database can binary-search it. When you insert a row, the database writes the row and then writes an entry into every index on that table. Ten indexes mean eleven writes.

Index writes also cost more than table writes, one entry for one entry. A table insert usually appends to the end of a page. An index insert has to land in sorted position, so the database walks the B-tree to find the right leaf page, and then writes there. That page is somewhere random on disk, not where you just were. If the page is full, the database splits it into two, rewrites both, and updates the parent. A split can cascade up the tree.

Updates are worse than you would guess. Updating a column that no index covers is cheap. Updating an indexed column means deleting the old index entry and inserting a new one in a different place, because the sort position moved.

Three things make the cost bigger.

Random keys hurt most. A UUID v4 index scatters every insert to a different page, so the database keeps evicting and reloading pages from cache. A sequential key like an auto-increment id always inserts at the right edge of the tree, which stays hot in memory and rarely splits.

Wide indexes hurt. A composite index on four columns copies four columns per row.

Durability multiplies it. Every index change goes into the write-ahead log too, so it is paid twice, and it is paid again on every replica.

What to do about it depends on why you added the index.

Check that queries actually use it. Run `EXPLAIN` on the query you meant to speed up. An unused index is pure cost. Postgres tracks this in `pg_stat_user_indexes`; MySQL has `sys.schema_unused_indexes`.

Drop redundant indexes. An index on `(a, b)` already serves queries that filter on `a` alone. A separate index on `a` earns nothing and costs on every write.

Narrow it. Fewer columns, and a partial index with a `WHERE` clause if you only query a slice of the table.

Then decide whether the trade is worth it. Most tables are read far more than they are written, which is why "indexes make things faster" is good advice most of the time. On a hot write path — an event log, a queue table, a metrics sink — it is wrong, and the fix is fewer indexes, not more.

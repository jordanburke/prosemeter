---
kind: eval-artifact
run: 5
variant: E
replicate: r2
task: T2
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. Both are true at once, and you just met the second half.

An index is a second copy of some of your data, sorted. The database keeps it in a B-tree so it can find a row without scanning the table. That sorted copy has to stay correct, so every write has to update it too.

Count the work per statement. An `INSERT` writes the row, then walks the index tree and inserts a key in the right place. A `DELETE` writes the row, then removes the key. An `UPDATE` writes the row, and if it touched an indexed column, deletes the old key and inserts the new one. Add five indexes and one insert becomes six writes.

Three things make it worse than that arithmetic suggests.

Page splits cost extra. When the leaf page a key belongs on is full, the database splits it in two and rewrites the parent. That is several page writes for one row.

Random inserts split more often than sequential ones. An index on an auto-incrementing id always appends to the rightmost page. An index on a UUIDv4 or an email lands anywhere, so pages fill and split all across the tree, and the cache hit rate drops with it.

Every index is also more to write to the write-ahead log, more to fsync, and more to keep in memory.

So decide by how the table is used. On a table read constantly and written rarely, an index is nearly free. On a hot write path — an events table, an append-only log, a queue — each index is a real tax.

Do this next. Check whether the index is being used at all: `pg_stat_user_indexes` in Postgres, `sys.dm_db_index_usage_stats` in SQL Server. An unused index is pure cost, and unused indexes are common, because people add them speculatively and never look again. Drop the ones nothing reads.

Then look for redundant ones. An index on `(a, b)` already serves queries filtering on `a` alone, so a separate index on `(a)` is duplicated work on every write.

One caveat worth knowing. An index can slow down reads too, not just writes, when the planner picks it and the index turns out to be a bad choice — say a low-cardinality column where it fetches half the table one random row at a time. That is rarer than the write cost, but it does happen.

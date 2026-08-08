---
kind: eval-artifact
run: 5
variant: F
replicate: r5
task: T2
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
## Why did adding an index slow down my writes?

An index is a second copy of your data that the database has to keep up to date. Every insert, update, and delete now writes twice — once to the table, once to the index. You bought read speed with write cost.

An index is a sorted structure, usually a B-tree, that maps a column's values to the rows that hold them. Sorted order is what makes reads fast: the database can jump to the right place instead of scanning every row. Sorted order is also what makes writes slow. A new row cannot go on the end. It has to go in its correct sorted position, which means finding that position and shifting things to make room.

Four costs stack up.

The database writes more bytes. Each index entry holds the indexed value plus a pointer to the row. Add five indexes and one insert becomes six writes.

The database sometimes splits pages. A B-tree stores entries in fixed-size pages, often 8 KB. When a page fills, the database splits it in two and updates the parent. One insert can cascade into several page writes.

The database writes to random places on disk. Table rows append in order. Index entries land wherever the sorted value belongs, which scatters the writes. On the write-ahead log — the durability journal every change goes through first — that scatter turns into more log volume too.

Updates cost double. Changing an indexed column is a delete plus an insert in the index, because the row's sorted position moved. Changing a column with no index on it costs nothing extra.

## So when is an index still worth it?

Whenever reads outnumber writes on that column, which is most tables.

The advice you were given is not wrong, it is just incomplete. Indexes make *reads* faster. Nobody says the second half out loud because reads dominate most workloads by a wide margin.

The cases where the trade goes against you are specific. High-write tables — event logs, audit trails, metrics — pay the cost on every row and rarely read by that column. Low-selectivity columns are the other trap: a column with three distinct values, like a status flag, does not narrow the search much, so the planner often ignores the index and you pay the write cost for nothing.

Check what you actually have. `pg_stat_user_indexes` in Postgres reports how many times each index was used to find rows. An index with zero scans and a million inserts is pure loss — drop it.

One more thing to check before you conclude the index is at fault. If your writes got slower right after you created the index and stayed slower, the index is the cause. If they were slow only during creation, that was the build, and it is over.

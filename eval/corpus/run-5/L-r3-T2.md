---
kind: eval-artifact
run: 5
variant: L
replicate: r3
task: T2
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes, and you just paid the write cost. Every insert, update, and delete must now maintain a second data structure alongside the table itself.

Think about what the database stores. The table holds your rows. The index holds a sorted copy of the indexed column plus a pointer back to each row. Those are two structures, not one.

A read can use the sorted copy to jump straight to the rows it wants, instead of scanning the whole table. That is the win everyone told you about.

A write has to update both. Insert a row, and the database writes the row and then inserts a key into the index tree — finding the right leaf page, writing it, and sometimes splitting it when the page is full. A page split rewrites two pages and updates the parent. Delete a row, and it marks the index entry dead too. Update an indexed column, and it does a delete plus an insert in the index, even though the table only saw one change.

Several things multiply that cost.

**Index count.** The work is per index. Five indexes on a table means five trees to maintain on every insert. This is the most common cause of a write slowdown that surprises people.

**Random insert order.** A UUIDv4 primary key scatters inserts across the whole tree, so each one dirties a different page and the cache stops helping. A sequential key appends to one hot page. Same index, very different cost.

**Wide keys.** Indexing a long text column puts more bytes in every page, so fewer keys fit per page, so the tree is deeper and splits more often.

**Write amplification to disk.** The dirty index pages have to reach durable storage, and in Postgres they go through the write-ahead log first. A full-page write after a checkpoint logs the entire 8KB page, not just your key.

**Lock and latch contention.** Under concurrency, writers queue on the same hot index pages.

One case runs the other way. An index can make an `UPDATE` or `DELETE` *faster*, because the statement has to find the target rows before changing them, and the index turns that scan into a lookup. If your slow write is an update with a `WHERE` clause on the indexed column, measure before you blame the index.

So decide by workload. Keep an index when it serves a query that runs often and would otherwise scan a lot of rows. Drop it when it does not. Check `pg_stat_user_indexes` in Postgres or `sys.dm_db_index_usage_stats` in SQL Server to find indexes nothing reads — those are pure cost.

Two more levers. A composite index can replace two single-column indexes and halve the maintenance. And if the column you index changes on most updates, that index is expensive by nature — index a stable column instead when you can.

---
kind: eval-artifact
run: 2
variant: Ep
replicate: r3
task: T2
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. That's the whole trade, and nobody mentions the second half.

An index is a second copy of some of your data, sorted. When you insert a row, the database writes the row to the table *and* writes an entry into every index on that table. Five indexes means six writes, not one. Updates are worse: if you change an indexed column, the engine deletes the old index entry and inserts a new one in a different place in the tree.

Two more costs pile on top. The new index entry usually lands in the middle of a B-tree, not at the end, so the page it belongs on may have to split — that's extra I/O and it fragments the index over time. Every one of those writes also goes through the write-ahead log first, so your WAL volume grows too.

So the question isn't "is this index slow" but "does the read win pay for the write cost." Check what the index actually bought you. Run `EXPLAIN ANALYZE` on the query you added it for and confirm the planner uses it and the row estimate drops sharply.

If the index isn't being used, drop it — you're paying the write cost for nothing. This happens more than people expect: a low-cardinality column like `status` with three values gives the planner no reason to prefer an index scan over a sequential one.

If it is being used but the write cost hurts, a few things help. Widen it into a composite index that covers several queries instead of adding a separate index per query. Make it partial with a `WHERE` clause so only the rows you query get indexed. Or check for indexes you no longer need — `pg_stat_user_indexes` shows scan counts, and a long-lived index with zero scans is pure overhead.

One case where the write slowdown is expected and fine: bulk loads. If you're inserting millions of rows, drop the indexes first, load, then rebuild. Building an index once beats maintaining it a million times.

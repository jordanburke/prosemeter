---
kind: eval-artifact
run: 3
variant: E
replicate: r4
task: T2
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. You added a second data structure, and the database now keeps it in sync on every change.

Think about what an insert does now. Before the index, the engine wrote one row. After it, the engine writes the row, walks the index tree to find the right leaf, inserts the key there, and splits pages when a leaf fills up. An update to an indexed column costs even more: the engine deletes the old key and inserts the new one, because the row moved to a different place in the index order. All of that lands in the write-ahead log too, so the disk traffic grows as well.

The cost scales with the number of indexes. Ten indexes mean ten trees to maintain per write.

A few things make it worse than usual:

- **Random keys**, like UUIDv4, scatter inserts across the whole tree and dirty pages everywhere. Sequential keys append to one hot leaf and stay cheap.
- **Wide indexes** over several columns write more bytes per row.
- **Indexes nobody queries** are pure cost. Check `pg_stat_user_indexes` for a scan count of zero and drop what you find.

So the trade is real, and it is usually worth taking. A read that drops from a 2-second scan to 2 milliseconds beats a write that goes from 1 millisecond to 1.3. Measure your actual write path before you worry. If writes really are the bottleneck, the answer is fewer indexes, not none.

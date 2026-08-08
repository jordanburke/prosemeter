---
kind: eval-artifact
run: 4
variant: E
replicate: r1
task: T2
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. You paid the write cost to buy the read benefit. That's the trade, and it's working as designed.

Here's why. An index is a second data structure, usually a B-tree, holding a sorted copy of the indexed column plus a pointer to the row. Every `INSERT` writes the row and then writes an entry into that tree. Every `UPDATE` that touches the indexed column writes the row, deletes the old index entry, and inserts a new one. Every `DELETE` cleans up both. So one logical write becomes several physical ones.

The tree also has to stay sorted. New entries land in the middle, pages fill up, and the database splits them. Page splits cost extra I/O and fragment the index over time. Postgres additionally writes all of this to the WAL, so your write-ahead log grows too.

Multiply that by the number of indexes on the table. Five indexes means five extra structures to maintain on every write.

What to do:

- **Count your indexes.** Tables that accumulate one index per query often have redundant ones.
- **Drop the unused ones.** In Postgres, `pg_stat_user_indexes` shows `idx_scan` per index. A count near zero on a long-running server means nothing uses it.
- **Merge overlapping ones.** An index on `(a, b)` already serves queries filtering on `a` alone, so a separate index on `a` is dead weight.
- **Check the read actually got faster.** Run `EXPLAIN ANALYZE` on the query you added it for. If the planner still picks a sequential scan, you took the write hit for nothing.

The rule of thumb: index for the queries you actually run, not the ones you might.

---
kind: eval-artifact
run: 4
variant: Et
replicate: r2
task: T2
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads by making writes do more work. Both things are true at once.

An index is a second data structure — a sorted B-tree holding the indexed column plus a pointer to the row. Every insert has to add an entry to that tree. Every delete has to mark one dead. Every update that touches the indexed column has to remove the old entry and add a new one. So one logical write becomes two physical writes, and the second one lands in a random spot in the tree rather than at the end of the table.

Three things make it worse than it sounds:

- **Page splits.** When the tree page you are writing to is full, the engine splits it in half. That is extra I/O at write time, and it fragments the index.
- **WAL volume.** Postgres logs the index change too, so your write-ahead log grows and checkpoints get heavier.
- **Lost HOT updates.** Postgres has a fast path for updates that touch no indexed column — it keeps the new row version on the same page and skips the index entirely. Index the column you update most and you turn that path off for every update on the table.

**What to do.** Ask whether the index earns its cost. Check `pg_stat_user_indexes` for `idx_scan` after a few days of real traffic — an index with a scan count near zero is pure overhead, drop it. If it does get used, see whether an existing index can be widened to cover both queries instead of adding a new one. Fewer, broader indexes beat many narrow ones on a write-heavy table.

The rule is not "indexes are fast." It is "indexes trade write cost for read cost." You just paid the write side without needing the read side yet.

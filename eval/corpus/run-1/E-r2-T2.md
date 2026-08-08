---
kind: eval-artifact
run: 1
variant: E
replicate: r2
task: T2
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. You just met the second half of that trade.

An index is a second data structure — usually a B-tree — that the database keeps sorted by your indexed column. Every write has to update it. An `INSERT` now writes the row *and* walks the tree to place a new entry. An `UPDATE` that touches the indexed column writes the row, deletes the old index entry, and inserts a new one. A `DELETE` clears both. So one logical write became several physical ones.

It gets worse in a few specific cases:

- **Random insert order.** An index on a UUID scatters new entries across the whole tree, so each insert dirties a different page. An index on a timestamp appends to one end and stays cheap.
- **Page splits.** When a tree page fills, the database splits it in two and rewrites parents. That cost lands on whichever unlucky insert triggers it.
- **Wide or many-column indexes.** More bytes per entry means more pages, more I/O, less of the tree cached in memory.
- **Stacking indexes.** Every write pays for *all* of them. Five indexes on a hot table means five trees to maintain per row.

Writes also take locks on index pages, so under concurrency you add contention on top of the raw work.

What to do:

1. **Check the index earns its keep.** Run `EXPLAIN ANALYZE` on the query you added it for and confirm the planner uses it. Unused indexes are pure cost.
2. **Drop duplicates.** An index on `(a, b)` already serves queries filtering on `a` alone, so a separate index on `a` is dead weight.
3. **Look at write volume against read volume.** A table taking thousands of inserts a second to serve one dashboard query is the wrong place for an index — cache the query instead.
4. **Measure, do not guess.** Time the write path before and after. The right answer depends on your row size, your index count, and how much of the tree fits in memory.

The rule of thumb: index for the reads you actually run, and pay for each one on every write.

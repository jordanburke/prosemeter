---
kind: eval-artifact
run: 3
variant: E
replicate: r1
task: T2
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. That is the trade, always. Nobody was lying to you — they just left out half the sentence.

An index is a second copy of some of your data, sorted. The database keeps it in sync for you. So every `INSERT` now writes the row *and* writes an entry into the index. Every `DELETE` removes both. An `UPDATE` that touches an indexed column has to remove the old index entry and add a new one. Add three indexes and a single insert becomes four writes.

It gets worse than the raw count. The index is usually a B-tree, so the new entry has to land in sorted position, not at the end. That means reading the tree pages to find the spot, and sometimes splitting a full page into two. Splits are extra I/O and they fragment the index over time. Random inserts into an index on a UUID column are the classic version of this — every insert lands in a different page, so nothing stays cached.

So the question is not "should I have an index" but "does this index earn its cost." An index earns it when it turns a table scan into a lookup on a query you run often. It does not earn it when:

- No query filters or sorts on that column.
- The column has few distinct values, like a boolean or a status with three states. The planner will often skip it and scan anyway.
- Another index already covers the query. An index on `(a, b)` already serves queries filtering on `a` alone, so a separate index on `a` is dead weight.

Check what you actually have with `pg_stat_user_indexes` — `idx_scan` tells you how many times each index has been used. Zero after a week of production traffic means drop it.

If the index is genuinely needed and writes still hurt, the usual moves are batching inserts into fewer transactions, or dropping the index before a bulk load and rebuilding it after. Measure before and after. Do not guess which index is the expensive one.

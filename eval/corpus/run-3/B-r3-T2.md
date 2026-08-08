---
kind: eval-artifact
run: 3
variant: B
replicate: r3
task: T2
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes make *reads* faster. They make *writes* slower. That's the trade, and nobody mentions the second half often enough.

**Why.** An index is a second data structure — usually a B-tree — that stores a sorted copy of the column you indexed, plus a pointer back to the row. It's a separate thing living alongside the table.

So when you write:

- **INSERT** — the database writes the row, then also inserts an entry into the index, in the right sorted position. If the tree node is full, it has to split, which means rewriting pages.
- **UPDATE** — if you touch an indexed column, the old index entry has to be removed and a new one inserted at a different position in the tree.
- **DELETE** — the row goes, and the index entry has to go too.

Every index you add is another structure that has to stay in sync on every write. Five indexes on a table means an insert does roughly six writes, not one. Your write path got slower in exact proportion to how many indexes it now has to maintain.

**A few things that make it worse than you'd expect:**

- **Random insert order.** If you index something like a UUID or an email, new entries land all over the tree, so the database is touching scattered pages instead of appending to the end. An index on an auto-incrementing ID or a timestamp is much cheaper, because new entries always go on the right edge.
- **Wide indexes.** A multi-column index on three big text columns is a lot of bytes to write per row.
- **Write-heavy tables generally.** A table taking thousands of inserts per second feels every index. A table that's read constantly and written once a day doesn't care.

**What to do about it.** Don't panic and drop the index — first check whether it's earning its keep:

1. **Confirm the query actually uses it.** Run `EXPLAIN` on the query you added it for. Indexes get added on a hunch and then never used, and an unused index is pure cost.
2. **Check for redundancy.** If you have an index on `(a)` and another on `(a, b)`, the first is often redundant — the composite one can serve queries filtering on `a` alone.
3. **Decide which side matters.** If this table is written far more often than that query is run, the index may be a bad deal. If the query is on a hot user-facing path and the writes are background jobs, the slower writes are worth it.

The rule of thumb: index for the queries you actually run, measure both sides, and treat every index as something you have to justify rather than something that's free.

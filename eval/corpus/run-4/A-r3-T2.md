---
kind: eval-artifact
run: 4
variant: A
replicate: r3
task: T2
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Both things are true — indexes make reads faster and writes slower. Nobody's lying to you, they just left off the second half.

An index is a second data structure, usually a B-tree, that stores a sorted copy of the column you indexed plus a pointer back to the row. The table doesn't rearrange itself; the index sits alongside it.

So when you `INSERT` a row, the database now has two jobs instead of one:

1. Write the row into the table.
2. Find the right position in the index's sorted structure and write an entry there too.

Step 2 isn't free. It's a tree traversal to find the insertion point, a write, and occasionally a page split when the leaf node you're writing into is full — which cascades upward and can rewrite several pages. `UPDATE` is worse: if you change an indexed column, that's a delete plus an insert in the index, because the entry has to move to a new sorted position. `DELETE` has to clean up index entries too.

Multiply that by the number of indexes on the table. Five indexes means every insert does one table write and five index maintenance operations. This is the single most common reason a write-heavy table gets slow — someone added indexes over the years, one per slow query, and nobody removed any.

A few things that make it worse than the general case, worth checking against your situation:

- **Random insertion order.** If you index a UUID, new entries land all over the tree, so you're touching pages scattered across disk and page splits are frequent. An index on an auto-incrementing ID or a timestamp appends to the right edge, which is much cheaper and stays cache-warm.
- **Wide indexes.** Multi-column or long text columns mean more bytes per entry, fewer entries per page, more pages touched.
- **Postgres specifically.** An update to an indexed column usually forces a new row version and updates to *every* index on the table, not just the one you changed. (HOT updates avoid this, but only when no indexed column changed.) So on Postgres a single new index can slow down updates that don't even touch that column.

What to do about it:

Decide whether the index is earning its keep. Run `EXPLAIN` on the query you added it for and confirm the planner is actually using it — a surprising number of hand-added indexes are never chosen. Then look at whether an existing index already covers you: an index on `(a, b)` serves queries on `a` alone, so a separate index on `a` is pure write cost for zero read benefit. That's the most common easy win.

If the index is genuinely needed and the write cost is genuinely a problem, the usual options are a partial index (`WHERE status = 'active'`, so you only maintain entries for rows you query), or accepting the tradeoff because reads outnumber writes by 100:1 and the arithmetic favors it.

The framing I'd suggest carrying forward: an index is a bet that you'll read this column far more often than you write it. Usually a good bet. Not always.

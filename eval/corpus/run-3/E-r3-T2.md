---
kind: eval-artifact
run: 3
variant: E
replicate: r3
task: T2
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. You added read speed and paid for it in write speed. That's the trade, and it's working as designed.

Here's why. An index is a second data structure — usually a B-tree — that stores a sorted copy of the indexed column plus a pointer back to the row. The table doesn't know about it. The database has to keep the two in sync itself.

So every write now does more work:

- **INSERT** writes the row, then walks the B-tree and inserts a new entry in sorted position. If the target page is full, the database splits the page, which means more I/O and sometimes a cascade up the tree.
- **UPDATE** on an indexed column deletes the old index entry and inserts a new one. Updating a non-indexed column skips this, so which columns you index matters.
- **DELETE** removes the row and the index entry.

Each of these also writes more to the WAL, which means more disk and more replication traffic.

Add more indexes and the cost stacks. Five indexes on a table means five B-trees to maintain per insert.

**What to do about it:**

Check the index is actually used. Run `EXPLAIN ANALYZE` on the query you added it for. An unused index is pure cost — drop it.

Check for redundant indexes. An index on `(a, b)` already serves queries filtering on `a` alone, so a separate index on `a` is dead weight.

Look at write amplification on hot tables. A table taking thousands of inserts a second and serving one dashboard query is the wrong place for an index. Consider a read replica instead.

The rule of thumb: index for the queries you run often, not for the queries you might run someday.

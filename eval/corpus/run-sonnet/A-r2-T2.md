---
kind: eval-artifact
run: sonnet
variant: A
replicate: r2
task: T2
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes — both are true at once.

A table with no index just stores rows. An insert appends a row and stops. Once you add an index, the database also has to keep a second structure (usually a B-tree) in sync with the table. Every insert now writes to the table *and* updates the index. Every update that touches an indexed column has to move the entry to its new spot in the index. Every delete has to remove the entry from the index too.

So your writes got slower because each one now does more work, not because the index is broken. This is expected, and it's the actual tradeoff indexes make: you're trading write cost for read speed.

A few things worth checking:

- **How many indexes does the table have?** Each one adds its own write cost. Five indexes on a write-heavy table can add up fast.
- **Is the index on a column that changes often?** Indexing a column that gets updated constantly means constant index maintenance.
- **Do you need that index at all?** Run `EXPLAIN` on the queries it's meant to help. If nothing uses it, drop it.

The fix isn't to avoid indexes — it's to index only the columns your read queries actually filter or sort on, and skip indexing columns that change a lot but rarely get queried.

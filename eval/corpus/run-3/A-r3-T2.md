---
kind: eval-artifact
run: 3
variant: A
replicate: r3
task: T2
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes make **reads** faster. They make writes slower, always. Nobody's lying to you — they just left off the second half.

Think about what an index actually is: a second copy of one or more columns, kept sorted, stored separately from the table (usually a B-tree). That copy doesn't maintain itself.

So when you `INSERT` a row:

- The engine writes the row to the table, **and** inserts a corresponding entry into every index on that table, in the right sorted position.
- Each of those is more pages touched, more pages dirtied, more WAL/redo log written.
- If an index page is full, it has to *split* — allocate a new page, move half the entries, update the parent. That's a genuinely expensive occasional cost hiding inside your average.

`UPDATE` is worse than people expect. Updating an indexed column means delete-the-old-entry plus insert-the-new-one in that index, and because indexes are ordered by value, the new entry usually lands somewhere completely different on disk. `DELETE` has to clean out every index too.

So the rough model: **write cost scales with the number of indexes on the table.** Five indexes means roughly five extra structures to maintain on every write. That's the tradeoff you signed up for, and normally it's a good trade — most tables are read far more than written.

A few things that make it hurt more than the baseline:

- **Random insert order.** An index on a UUIDv4 column scatters inserts across the whole tree — every insert dirties a different page, and your cache hit rate falls off a cliff. An index on an auto-increment id or a timestamp appends to the right edge and stays hot in memory. Same "one index," wildly different write cost.
- **Wide or multi-column indexes.** More bytes per entry, fewer entries per page, more pages, more I/O.
- **Write-heavy table with a read pattern that didn't need the index anyway.** This is the common one.

What I'd actually do: check whether the index is earning its keep. In Postgres, `pg_stat_user_indexes.idx_scan` tells you how many times it's been used since stats reset. If it's near zero, drop it. Also look for indexes that are *prefixes* of other indexes — an index on `(a)` is redundant if you already have `(a, b)`, and you're paying write cost for nothing.

And if the write slowdown is real but the index is genuinely needed for a query — that's fine, that's the normal state of the world. Just make sure you measured the read win, not assumed it. `EXPLAIN ANALYZE` before and after.

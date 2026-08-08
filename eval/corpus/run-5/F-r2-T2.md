---
kind: eval-artifact
run: 5
variant: F
replicate: r2
task: T2
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
## Why did the index make writes slower?

An index is a second copy of your data, sorted, and the database has to keep it correct on every write.

Indexes speed up reads. Nobody was lying to you. They pay for that speed with work at write time, and you have just started paying.

Here is the work an index adds. On every `INSERT`, the database writes the row, then writes a new entry into the index and rebalances the tree that holds it. On every `UPDATE` that touches an indexed column, it deletes the old index entry and inserts a new one — two operations, not one. On every `DELETE`, it removes the index entry too. Add a second index and all of that happens twice.

Three things make it worse than the raw count suggests:

- **Random insert position.** An index on a column with no natural order — a UUID, an email, a hash — puts each new entry in a random place in the tree. That means a random disk page per write, instead of appending to the end of one hot page. An index on a timestamp or an auto-increment id appends, so it costs far less.
- **Page splits.** When the page an entry belongs on is full, the database splits it in two and rewrites both. One insert becomes several page writes.
- **Wide indexes.** A multi-column index or an index on a long text column stores more bytes per row, so every one of the above costs more.

## What should I do about it?

Keep the index only if a query needs it, and check that a query really does.

Run `EXPLAIN` (or `EXPLAIN ANALYZE`) on the query you added the index for. If the plan does not show the index being used, drop it — you are paying the write cost for nothing. Indexes go unused more often than people expect, usually because the query filters on a different column order or wraps the column in a function.

Then audit the rest. Ask the database which indexes are never read: PostgreSQL exposes this in `pg_stat_user_indexes` as `idx_scan`, a count of how many times each index has been used since stats were last reset. A count of zero on a table with real traffic means the index is pure cost.

Finally, weigh the trade. A table read a thousand times per write should be heavily indexed. A table written a thousand times per read should carry almost none. Measure both sides before you decide, because the right number of indexes is a property of your traffic, not of the table.

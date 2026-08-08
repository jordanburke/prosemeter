---
kind: eval-artifact
run: 2
variant: G
replicate: r2
task: T2
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. That is the trade, and it is always the trade.

Here is why. An index is a second copy of some of your data, sorted a different way. Your table holds the rows. The index holds the indexed columns plus a pointer back to each row, kept in sorted order, usually in a B-tree.

A read can now jump straight to the rows it wants instead of scanning the whole table. That is the win.

A write has to update the table **and** every index on it. So one `INSERT` into a table with four indexes is really five writes. Each index write also has to find the right spot in the sorted tree, which means reading tree pages before it can write. When a page fills up, the database splits it in two and rewrites the parent. That is a burst of extra I/O at a random moment.

`UPDATE` is the sneaky one. Updating a column that no index covers is cheap. Updating an indexed column is not, because the row's position in the sorted order changed. The database has to delete the old entry and insert a new one, in every index that covers that column.

`DELETE` pays too. Every index needs its entry removed.

A few things make it worse than the base cost:

- **Random insert order.** An index on a UUID or an email scatters writes across the whole tree. An index on an auto-incrementing ID or a timestamp appends to one end, which stays hot in cache and costs far less.
- **Wide indexes.** More columns means more bytes per entry, fewer entries per page, and a taller tree.
- **Too many indexes.** The cost stacks linearly. Ten indexes means ten extra write paths.

So what should you do? First, check whether the index earns its keep. Run `EXPLAIN ANALYZE` on the queries you added it for and confirm the planner actually uses it. An unused index is pure cost.

Then look for indexes you can drop. Redundant ones are common: an index on `(a, b)` already serves queries that filter on `a` alone, so a separate index on `a` is dead weight. In Postgres, `pg_stat_user_indexes` shows the scan count per index. Anything sitting at zero after a full traffic cycle is a candidate.

If you truly need the index and the write cost hurts, look at batching writes, or at whether a partial index (`WHERE status = 'active'`) covers your queries while indexing far fewer rows.

The short version: every index is a tax you pay on every write, in exchange for a discount on some reads. Keep the ones where the discount beats the tax.

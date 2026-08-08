---
kind: eval-artifact
run: 5
variant: F
replicate: r4
task: T2
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
## Why did the index make writes slower?

An index is a second copy of your data, sorted, that the database must keep correct on every write. Reads get faster because the database can jump straight to the rows it wants. Writes get slower because every insert, update, and delete now has to update the table *and* the index.

So both things people told you are true. Indexes speed up reads and slow down writes. Nobody mentioned the second half, because they were talking about the query they cared about.

## What exactly does the extra work cost?

Three costs stack up on each write.

**Keeping the sort order.** Most indexes are B-trees — a tree that holds keys in sorted order so lookups take a few hops instead of a scan. Inserting a row means finding the right spot in that tree and putting the key there. If the spot is full, the database splits the node, which touches more pages.

**Writing more pages.** The table page changes and the index page changes. Both must be written, and both go through the write-ahead log first. One row insert became two page writes plus more log.

**Updates cost double.** Changing an indexed column is a delete plus an insert in the index, because the row's sorted position moved. Changing a column with no index on it skips the index entirely.

Every extra index multiplies this. Five indexes on a table means five trees to maintain on each insert.

## How bad should it be?

One index on a normal table usually costs a small slice of write throughput — noticeable under load, invisible on a laptop. If your writes got dramatically slower, look for one of these instead.

A **random key** hurts most. An index on a UUID scatters inserts across the whole tree, so every insert dirties a different page and your cache stops helping. An index on a timestamp or an auto-incrementing id appends to one end, which is far cheaper.

A **wide index** hurts. Indexing a long text column, or five columns at once, means more bytes to write and a taller tree.

A **redundant index** hurts for nothing. An index on `(a)` is already covered by an index on `(a, b)` for queries that filter on `a` alone. The narrow one costs writes and buys you nothing.

## What should I do about it?

Decide whether the index earns its cost, then keep only the ones that do.

Measure the read it was meant to help. Run the query with `EXPLAIN ANALYZE` and compare the time with and without the index. If the query went from 800ms to 4ms and it runs on every page load, a slower write is a good trade.

Check whether anything uses it. Postgres tracks this in `pg_stat_user_indexes`; an index with a scan count near zero after a week of real traffic is pure cost, so drop it.

Look for indexes you can merge. If you have one on `(customer_id)` and one on `(customer_id, created_at)`, drop the first — the second serves both.

Narrow the index if you can. A partial index covers only the rows you query (`WHERE status = 'active'`), so it stays small and inserts to other rows skip it entirely.

If the table is write-heavy and read-rarely — a log, an event stream, an audit trail — the right answer is often no index at all, and a separate read model built from it.

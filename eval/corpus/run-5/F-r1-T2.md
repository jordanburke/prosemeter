---
kind: eval-artifact
run: 5
variant: F
replicate: r1
task: T2
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. That is the trade, not a bug. You bought faster queries with slower inserts, updates, and deletes.

## Why does an index slow writes down?

An index is a second copy of part of your data, kept sorted. The database must keep that copy correct on every write.

A table with no index takes one write to insert a row: append it to the table. A table with three indexes takes four: the row, plus an entry in each index. Every index you add is one more structure the database must update, inside the same transaction, before it can tell you the write succeeded.

Three costs stack up:

**More writes per row.** Each index entry is its own write. Five indexes means roughly six times the write work of a bare table, though the index entries are smaller than the row.

**Page splits.** Most indexes are B-trees, meaning a sorted tree kept balanced as it grows. When you insert into the middle of a full page, the database splits that page in two and rewrites both. A random-ordered key — a UUID, an email address — splits pages constantly. A key that always increases — a timestamp, an auto-increment id — appends to the end and rarely splits. Same index, very different write cost.

**Locking and contention.** Concurrent writers that touch the same index page wait on each other. Under load this shows up as slower writes with no obvious CPU cost.

Updates are worse than inserts in one specific way. Updating a column that is in an index means deleting the old index entry and inserting a new one — two index writes, plus possible page splits at both ends. Updating a column that no index covers is cheap. So an index on a column you update on every request is the most expensive index you can own.

## How much slower should I expect?

There is no single number, and anyone who gives you one is guessing. The size depends on how many indexes you have, how random the key is, and whether the index fits in memory.

The pattern to expect: a single index on an increasing key costs little. A single index on a random key costs noticeably more. Five or six indexes on a hot write table is where teams usually notice the write path getting slow.

Measure your own table. Time a batch of inserts, add the index, time the same batch again.

## What should I do about it?

Keep the index if the query it serves matters. A query that goes from a full table scan to an index lookup often gets faster by a large factor, and that usually beats a modest write cost. You made a reasonable trade.

Then check three things:

**Is the index actually used?** Postgres tracks this in `pg_stat_user_indexes`; MySQL has `sys.schema_unused_indexes`. An index nobody reads costs writes and buys nothing. Drop it.

**Is it redundant?** An index on `(a, b)` already serves queries that filter on `a` alone, because it is sorted by `a` first. A separate index on `(a)` adds write cost for no read benefit. Look for indexes whose columns are a prefix of another index.

**Is the key random?** If you are indexing a UUID, consider a time-ordered variant such as UUIDv7. It sorts by creation time, so inserts append instead of splitting pages, and you keep the uniqueness you wanted.

For bulk loads, drop the indexes, load the data, then rebuild them. Building an index once over sorted data is far cheaper than maintaining it through a million individual inserts.

The rule to carry forward: index for the queries you actually run, not for the columns you might someday filter on.

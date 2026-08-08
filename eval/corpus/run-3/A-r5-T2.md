---
kind: eval-artifact
run: 3
variant: A
replicate: r5
task: T2
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
The "indexes make things faster" advice is about **reads**. Indexes make writes slower, always — it's not a bug in what you did, it's the trade you signed up for.

Here's the mechanism. An index is a second data structure (usually a B-tree) that holds a copy of the indexed column(s) plus a pointer back to the row, kept in sorted order. That sortedness is what lets a lookup skip straight to the rows you want instead of scanning the whole table.

But now the database has two structures to keep in sync:

- **INSERT** — write the row, *and* insert a new entry into the index at the correct sorted position. That may split a B-tree page, which may cascade upward.
- **DELETE** — remove the row, *and* remove or tombstone the index entry.
- **UPDATE** — if you touched an indexed column, the row's position in the index changed, so it's a delete plus an insert in the index. (Updating a non-indexed column is cheaper — Postgres has HOT updates for exactly this case, though they only apply when there's room on the page.)

Every one of those is extra I/O and extra WAL/redo log volume, and the index pages you're touching are scattered by index order, not insert order, so they're often random writes rather than sequential ones. Add **five** indexes to a table and an insert does roughly six writes' worth of work.

Two other things that commonly amplify it:

- **Lock/latch contention.** If you indexed something monotonically increasing — a timestamp, an auto-increment id — every concurrent insert lands on the same rightmost B-tree page. That page becomes a hotspot and your writers serialize on it. Very high-write tables sometimes need this deliberately worked around.
- **Unique indexes** cost more still, because the insert has to check for a conflict before it can proceed.

So the real rule is: **an index is a bet that you'll read this column far more often than you'll write to this table.** Usually that bet is overwhelmingly correct, which is why the shorthand advice exists. It stops being correct on append-heavy tables — event logs, metrics, audit trails, ingest staging — where you write constantly and query rarely.

Practically, what I'd do:

1. **Check the index is actually earning its keep.** In Postgres, `pg_stat_user_indexes` shows scan counts per index; an index with `idx_scan = 0` after a week of production traffic is pure write tax. Drop it.
2. **Check you don't have redundant indexes.** An index on `(a, b)` already serves queries filtering on `a` alone. A separate index on `(a)` is doing nothing but slowing writes.
3. **Measure the actual regression** rather than eyeballing it. If writes went from 2ms to 2.4ms and reads went from 900ms to 3ms, you won enormously and should keep it.
4. **If it's a bulk-load path**, the standard move is to drop the indexes, load, then rebuild them — building a B-tree once from sorted data is much cheaper than maintaining it across a million individual inserts.

The failure mode to watch for over time is index creep: everyone adds one for their query, nobody removes any, and eighteen months later the write path is carrying a dozen indexes that three queries use.

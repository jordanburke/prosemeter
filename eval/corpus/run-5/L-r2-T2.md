---
kind: eval-artifact
run: 5
variant: L
replicate: r2
task: T2
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
An index speeds up reads and slows down writes. That is the trade, not a bug. Everyone told you half the story.

An index is a second copy of some of your data, kept sorted. A read can jump straight to the row it wants instead of scanning the table. But every write has to keep that copy true.

So each `INSERT` now does more work.

- The database writes the row to the table.
- Then it writes an entry to the index, in the right sorted position.
- Then it writes both to the write-ahead log, so a crash cannot lose either.

An `UPDATE` that touches an indexed column costs even more. The database deletes the old index entry and inserts a new one, because the row moved to a different place in the sort order. An `UPDATE` that leaves indexed columns alone is much cheaper — some engines skip the index entirely.

Three things make the slowdown worse than you would expect.

- **Random insert positions.** A UUID primary key or an index on a random-ish column lands each new entry in a different page. The database has to fetch that page, change it, and write it back. An index on an increasing column, like a timestamp or a sequence, always appends to the same hot page and costs far less.
- **Page splits.** When a page fills, the database splits it in two and rewrites the parent. One insert can turn into several page writes.
- **Index count.** The cost is per index. Five indexes on a table means five extra writes per insert.

Here is how to decide what to keep. Look at the queries you actually run, not the ones you might run. Drop indexes no query uses — Postgres tracks that in `pg_stat_user_indexes`, where `idx_scan = 0` names the dead ones. Prefer one composite index over three single-column ones when your queries filter on the same columns together.

The usual answer is that the trade is worth it. Reads outnumber writes in most applications, and a scan of a large table costs far more than a few extra page writes. Measure your own ratio before you decide.

---
kind: eval-artifact
run: 2
variant: Ep
replicate: r4
task: T2
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. Both are true. Nobody was lying to you — they just left off the second half.

An index is a second copy of your data, sorted. The database keeps it in sync on every write. So each `INSERT` now writes the row *and* walks the index tree to slot the new key in the right place. Each `DELETE` removes from both. Each `UPDATE` touches the index only if it changes an indexed column — but if it does, that is a delete plus an insert in the index.

Three things make the cost worse than "one extra write":

- **Page splits.** A B-tree page fills up and the database splits it in two. That is extra I/O, and it fragments the index over time.
- **Random I/O.** Rows append to the end of a table; index keys land wherever they sort. A `UUIDv4` primary key is the classic offender, because every insert hits a random page.
- **Write amplification in the log.** The index change goes into the WAL too, so your durable write got bigger.

Multiply by the number of indexes. Five indexes on a table means five trees to maintain on every insert.

**What to do:**

Keep the index if reads matter more than writes. That is most tables. A query going from a seq scan to an index scan buys far more than the insert cost.

Drop it if the table is write-heavy and the index is not earning its keep. Check `pg_stat_user_indexes.idx_scan` in Postgres — an index with near-zero scans is pure cost.

Also check whether you needed a *new* index at all. If an existing index has your column as a leading column, your query already used it. And if you are bulk-loading, the normal move is to drop the indexes, load, then rebuild — building an index once is much cheaper than maintaining it row by row.

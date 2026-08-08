---
kind: eval-artifact
run: 5
variant: E
replicate: r4
task: T2
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. You got the tradeoff working exactly as designed.

An index is a second copy of some of your data, kept sorted. The table holds the rows. The index holds the indexed column plus a pointer back to the row, ordered so the database can jump straight to a value instead of scanning every row.

That second copy has to stay true. So every write now touches two structures instead of one.

- An insert writes the row, then writes an entry into every index on the table.
- A delete removes the row, then removes its entry from every index.
- An update rewrites the row, then rewrites the index entry for every indexed column it changed. If it changed no indexed column, most databases skip the index work.

The cost is not just the extra write. It is where the extra write lands.

Table rows usually append near the end of the table, which is cheap and sequential. Index entries land wherever the sort order puts them. If you indexed something random — a UUID, a hash, an email — each insert drops an entry in a different spot in the tree. That scatters your disk writes, splits pages as they fill, and dirties far more pages than the row itself did. An index on an ever-increasing column, like an autoincrement id or a timestamp, appends at one end and costs much less.

Three more things stack on top.

**Every index multiplies the cost.** Five indexes means five extra writes per insert. Teams add indexes one at a time and never remove them, and write throughput drifts down for years.

**Locking gets busier.** Concurrent writers contend on hot index pages, especially the rightmost page of an appending index.

**The write-ahead log grows.** Index changes are logged like everything else, so you write more log, flush more, and replicate more.

What to do about it.

Keep the index if the reads it serves matter more than the writes it costs. That is usually the case — most tables are read far more than written.

Drop it if nothing queries it. Run `pg_stat_user_indexes` on Postgres, or the equivalent on your engine, and look for indexes with zero scans. Those are pure cost.

Audit the whole set, not just your new one. A three-column index often replaces two narrower ones, because a query can use the leading columns of a composite index.

And measure. Compare write latency before and after on real traffic, not on an empty test table, where the index is small and the tree stays in memory.

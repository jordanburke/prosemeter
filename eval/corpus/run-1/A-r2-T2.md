---
kind: eval-artifact
run: 1
variant: A
replicate: r2
task: T2
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Everyone told you the half of it that's about reads. Indexes make *reads* faster and *writes* slower — that's not a bug, it's the fundamental trade, and it's worth having the mental model rather than the rule of thumb.

**Why the write slows down**

An index is a second data structure (usually a B-tree) that stores a copy of the indexed column(s) plus a pointer back to the row, kept in sorted order. It's a redundant, derived copy of your data. Every write has to keep it true:

- **INSERT** — the row goes into the table *and* a new entry gets threaded into the index at the correct sorted position. Finding that position is a tree descent; inserting there may split a page, which may split its parent, and so on up the tree.
- **DELETE** — the index entry has to be removed or marked dead too.
- **UPDATE** — if you touched an indexed column, that's a delete plus an insert in the index, because the entry's sort position changed. (Updating a *non*-indexed column is much cheaper — though in Postgres specifically, a non-HOT update still rewrites all index entries because the row gets a new physical location.)

So one logical write became N+1 physical writes, where N is your index count. And unlike the table append, index writes are scattered — you're touching a random page somewhere in the middle of the tree, not the hot tail of the heap. That's more I/O, more pages dirtied, more WAL/redo log volume, and more buffer cache churn.

**Two things that make it worse than you'd expect**

*Random insertion order.* If you indexed a UUIDv4 or a hash, every insert lands in a random spot in the tree. Pages split constantly, the index fragments, and its working set is effectively the whole index — so it stops fitting in cache. An index on an auto-increment ID or a timestamp appends to the right edge and is dramatically cheaper. If you need a random-ish key, UUIDv7 (time-ordered) gets you most of the win back.

*Write amplification compounds.* Ten indexes on a hot table isn't ten times slower in some abstract sense — it's ten extra random page touches per row, plus lock contention on the upper tree levels under concurrency.

**What to actually do**

Measure first — don't guess at which index is the cost. Then:

1. **Confirm the index is earning its keep.** Postgres: `pg_stat_user_indexes.idx_scan`. MySQL: performance schema, or `sys.schema_unused_indexes`. An index with zero scans is pure write tax. Dead indexes accumulate shockingly fast in any codebase over a year old.
2. **Look for redundancy.** An index on `(a)` is redundant if you already have `(a, b)` — the composite serves prefix lookups. Drop the narrower one.
3. **Ask whether the read it speeds up is worth it.** If the query it serves runs once an hour on a reporting dashboard and the table takes 5k inserts/sec, that's a bad trade. Sometimes the answer is to let that query be slow, or move it to a replica.
4. **Consider a partial index.** If you only ever query `WHERE status = 'pending'`, then `CREATE INDEX ... WHERE status = 'pending'` is a fraction of the size, and rows that never enter that state cost nothing to insert.
5. **Bulk loads: drop and rebuild.** For a large one-time import, dropping indexes, loading, and recreating them is often far faster than maintaining them row by row.

The one-line version to keep: **an index is a bet that you'll read this column more than you write it.** Usually a good bet, which is why the folk wisdom exists — but it *is* a bet, and you just found the side of it nobody mentions.

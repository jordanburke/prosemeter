---
kind: eval-artifact
run: 6
variant: R
replicate: r2
task: T2
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

Indexes make reads faster and writes slower. Both are true at once, and the tradeoff is the point of the feature. "Indexes make things faster" is shorthand for "make *queries* faster."

## Why a write costs more now

An index is a second copy of one or more columns, kept sorted. In a relational database it is a B-tree: the indexed column values, plus a pointer back to the row.

That copy has to stay correct. So every write does more work:

- **insert** writes the row, then adds an entry to every index on the table. The entry goes in the right sorted position. That can mean splitting a B-tree page and rewriting its parent.
- **UPDATE** writes the new row version, then updates every index whose column you touched. Change the indexed column and the index does a delete plus an insert. The entry moves to a new sorted position.
- **delete** removes the row. It must also remove or mark the row's entry in every index.

Ten indexes on a table means an insert does eleven writes, not one. That is the linear cost, and everyone expects it.

## The part that surprises people

The nonlinear costs are what people feel:

**Random I/O.** Appending a row to a table is sequential. Inserting into a sorted index is not. The entry lands where it sorts, which can be a page far from the last one you touched. If the index does not fit in memory, that is a disk seek per insert. An index on a random value like a UUIDv4 is the worst case. An index on an autoincrementing id or a timestamp is the best case, because every insert lands on the rightmost page.

**Page splits.** When the target page is full, the database splits it in two and updates the parent. Sometimes that cascades up the tree. Nine inserts in ten stay cheap; the tenth costs far more. So your *average* latency moves by a hair and your *p99* jumps.

**Write amplification through the log.** Index changes are WAL-logged too. More indexes means more log volume. More log volume means more disk bandwidth, longer checkpoints, and more replication lag on your followers.

**Lock and latch contention.** Concurrent inserts hitting the same hot rightmost index page contend for it. On a high-insert table this shows up as a throughput ceiling that drops as you add indexes.

**Lost heap-only-tuple updates, in Postgres.** Postgres can do a cheap "heap-only tuple" update that skips index maintenance. It needs two conditions: no indexed column changed, and the page has free space. Add an index on a column your UPDATE statements touch and Postgres drops that optimization for those updates. One new index makes an existing UPDATE path three to five times slower, for reasons that look like magic.

## How to reason about it

The right question is not "is this index good" but "does the read benefit exceed the write cost, at my read/write ratio."

- A table read a thousand times per write: index it aggressively.
- An append-heavy log or events table: every index is expensive, so justify each one.
- An index no query plan uses: pure cost, zero benefit. These accumulate in silence.

## What to do about yours

1. **Confirm the index is being used.** Run `EXPLAIN (ANALYZE, BUFFERS)` on the query you added it for. In Postgres, `pg_stat_user_indexes.idx_scan` counts how many times each index has been used since stats were reset. Zero means drop it.
2. **Look for redundant indexes.** An index on `(a, b)` already serves queries filtering on `a` alone. A separate index on `(a)` is dead weight — you pay the write cost and get nothing.
3. **Check the column's insert pattern.** Did you index a random UUID on a high-insert table? Switch to a time-ordered id: UUIDv7 or ULID. The sort order alone can be the difference.
4. **Use a partial index.** `WHERE status = 'active'` keeps the index small when your queries only touch active rows, so maintenance touches far fewer pages.
5. **Measure both sides.** Time the query before and after. Time the write path before and after. If nobody measured the write path, nobody knows whether the trade was worth it.

Here is the rule of thumb worth keeping: an index is not free storage of a faster plan. It is a standing subscription, paid on every write, for a faster read.

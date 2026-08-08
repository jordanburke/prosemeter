---
kind: eval-artifact
run: 5
variant: A
replicate: r2
task: T2
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes make reads faster and writes slower. Both are true at once, and the tradeoff is the whole point of the feature. "Indexes make things faster" is shorthand that quietly means "make *queries* faster."

## Why a write costs more now

An index is a second copy of some of your data, kept sorted. In most databases it is a B-tree: the indexed column values, plus a pointer back to the row.

That copy has to stay correct. So every write now does more work:

- **INSERT** writes the row, then also inserts an entry into every index on the table. The entry has to go in the right sorted position, which may mean splitting a B-tree page and rewriting its parent.
- **UPDATE** writes the new row version, then updates every index whose column you touched. If you changed the indexed column, that is a delete plus an insert in the index — the entry has to move to a new sorted position.
- **DELETE** removes the row and must remove or mark its entry in every index.

Ten indexes on a table means an insert does eleven writes, not one. That is the linear cost, and it is the part everyone expects.

## The part that surprises people

The nonlinear costs are usually what people actually feel:

**Random I/O.** Appending a row to a table is roughly sequential. Inserting into a sorted index is not — the entry lands wherever it sorts, which may be a page nowhere near the last one you touched. If the index does not fit in memory, that is a disk seek per insert. An index on a random value like a UUIDv4 is the worst case; an index on an autoincrementing id or a timestamp is the best case, because inserts all land on the rightmost page.

**Page splits.** When the target page is full, the database splits it in two and updates the parent. Occasionally that cascades up the tree. Most inserts are cheap; a few are much more expensive, so your *average* latency moves a little and your *p99* moves a lot.

**Write amplification through the log.** Index changes are WAL-logged too. More indexes means more log volume, which means more disk bandwidth, longer checkpoints, and more replication lag on your followers.

**Lock and latch contention.** Concurrent inserts hitting the same hot rightmost index page contend for it. On a high-insert table this shows up as a throughput ceiling that gets lower as you add indexes.

**Lost HOT updates (Postgres specifically).** Postgres can do a cheap "heap-only tuple" update, skipping index maintenance entirely, when no indexed column changed *and* there is free space on the page. Adding an index on a column your UPDATE statements touch disables that optimization for those updates. This is the classic case of one new index making an existing update path several times slower for reasons that look like magic.

## How to think about it

The right question is not "is this index good" but "does the read benefit exceed the write cost, at my read/write ratio."

- A table read a thousand times per write: index it aggressively.
- An append-heavy log or events table: every index is expensive, so justify each one.
- An index that no query plan actually uses: pure cost, zero benefit. These accumulate silently.

## What to do about yours

1. **Confirm the index is being used.** `EXPLAIN (ANALYZE, BUFFERS)` on the query you added it for. In Postgres, `pg_stat_user_indexes.idx_scan` tells you how many times each index has actually been used since stats were reset. Zero means drop it.
2. **Look for redundant indexes.** An index on `(a, b)` already serves queries filtering on `a` alone. A separate index on `(a)` is dead weight — pay the write cost, get nothing.
3. **Check the column's insert pattern.** If you indexed a random UUID on a high-insert table, consider a time-ordered id (UUIDv7, ULID) instead. The sort order alone can be the difference.
4. **Consider a partial index.** `WHERE status = 'active'` keeps the index small if you only ever query the active rows, so maintenance touches far fewer pages.
5. **Measure both sides.** Time the query before and after, and time the write path before and after. If nobody measured the write path, nobody knows whether the trade was worth it.

The rule of thumb worth remembering: indexes are not free storage of a better plan. They are a standing subscription, paid on every write, for a faster read.

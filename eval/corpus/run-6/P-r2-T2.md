---
kind: eval-artifact
run: 6
variant: P
replicate: r2
task: T2
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

Indexes make reads faster and writes slower. Both are true at once, and that trade is the whole point of the feature. "Indexes make things faster" is shorthand for "make *queries* faster."

## Why a write costs more now

An index is a second copy of some of your data, kept sorted. In most databases it is a B-tree holding the indexed column values plus a pointer back to the row.

That copy has to stay correct, so every write does more work:

- **INSERT** writes the row, then adds an entry to every index on the table. Each entry goes in its sorted position, which may mean splitting a B-tree page and rewriting its parent.
- **UPDATE** writes the new row version, then updates every index whose column you touched. Changing an indexed column means a delete plus an insert in that index, because the entry moves.
- **DELETE** removes the row and must remove or mark its entry in every index.

Ten indexes means an insert does eleven writes, not one. That is the linear cost, and everyone expects it.

## The part that surprises people

The nonlinear costs are what you actually feel.

**Random I/O.** Appending a row to a table is roughly sequential. Inserting into a sorted index is not — the entry lands wherever it sorts, possibly a page nowhere near the last one you touched. If the index does not fit in memory, that is a disk seek per insert. An index on a random UUIDv4 is the worst case. An index on an autoincrementing id or a timestamp is the best, because every insert lands on the rightmost page.

**Page splits.** When the target page is full, the database splits it in two and updates the parent, sometimes cascading up the tree. Most inserts stay cheap and a few get much more expensive, so your *average* latency moves a little and your *p99* moves a lot.

**Write amplification through the log.** Index changes are WAL-logged too. More indexes means more log volume, more disk bandwidth, longer checkpoints, and more replication lag on followers.

**Lock and latch contention.** Concurrent inserts hitting the same hot rightmost page contend for it. On a high-insert table that shows up as a throughput ceiling, and the ceiling drops as you add indexes.

**Lost HOT updates, in Postgres.** Postgres can do a cheap heap-only-tuple update that skips index maintenance, but only when no indexed column changed and the page has free space. Adding an index on a column your UPDATE statements touch turns that optimization off for those updates. This is the classic case of one new index making an existing write path several times slower for reasons that look like magic.

## How to think about it

The question is not "is this index good." It is "does the read benefit exceed the write cost, at my read/write ratio."

- A table read a thousand times per write: index it aggressively.
- An append-heavy log or events table: every index is expensive, so justify each one.
- An index no query plan uses: pure cost, zero benefit. These accumulate silently.

## What to do about yours

1. **Confirm the index is used.** Run `EXPLAIN (ANALYZE, BUFFERS)` on the query you added it for. In Postgres, `pg_stat_user_indexes.idx_scan` counts how many times each index has been used since stats were reset. Zero means drop it.
2. **Look for redundant indexes.** An index on `(a, b)` already serves queries filtering on `a` alone. A separate index on `(a)` is dead weight: you pay the write cost and get nothing.
3. **Check the column's insert pattern.** If you indexed a random UUID on a high-insert table, consider a time-ordered id such as UUIDv7 or ULID. The sort order alone can be the whole difference.
4. **Consider a partial index.** `WHERE status = 'active'` keeps the index small when you only query active rows, so maintenance touches far fewer pages.
5. **Measure both sides.** Time the query before and after, and time the write path before and after. If nobody measured the write path, nobody knows whether the trade paid off.

One rule of thumb to keep: an index is not free storage of a better plan. It is a standing subscription, paid on every write, for a faster read.

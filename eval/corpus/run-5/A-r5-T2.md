---
kind: eval-artifact
run: 5
variant: A
replicate: r5
task: T2
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes make reads faster and writes slower. Both are true at once, and the tradeoff is the whole point of an index. Nobody was lying to you; they just told you half of it.

## Why the write got slower

An index is a second copy of part of your data, kept sorted. In most databases it is a B-tree holding the indexed column plus a pointer back to the row.

That copy has to stay correct. So every write now does more work:

- **Insert** — write the row, then insert a new entry into the index, in the right sorted position. If the B-tree page it belongs on is full, the page splits, which means allocating a new page and updating the parent. Occasionally that cascades up the tree.
- **Update** — if you touched an indexed column, the old index entry has to be removed and a new one inserted at a different position, because the sort order changed. Updates to non-indexed columns are cheaper, and some engines optimize that case specifically.
- **Delete** — the index entry has to go too.

Add a second index and you pay that cost twice. A table with eight indexes does eight extra structural updates per insert. This is why write-heavy tables are kept lean on indexes and analytics tables are not.

There is also a durability cost. The index changes are themselves logged to the write-ahead log, so you have more bytes hitting disk per transaction, and more pages dirtied in the buffer pool that must eventually be flushed.

## The part that surprises people most

Where you insert matters enormously.

If your index is on an auto-incrementing id or a timestamp, every new row lands at the right edge of the tree. That is the cheapest possible case: one hot page, always in memory, occasional clean splits.

If your index is on a UUID v4 or anything random, every insert lands in an unpredictable place. Now you are touching a different page each time. Once the index outgrows memory, each insert costs a disk read to fetch the page before you can modify it. Throughput can fall by an order of magnitude at exactly the point the index stops fitting in RAM — which is why this often looks like a sudden cliff rather than a gradual slope.

That cliff is the usual explanation when a write slowdown feels disproportionate to "one more index."

## What to do about it

**Confirm the index is earning its keep.** Run `EXPLAIN` on the queries you added it for. An index that no query plan chooses is pure cost. Most databases can also report per-index usage counts; check them before adding another.

**Drop redundant indexes.** An index on `(a, b)` already serves queries filtering on `a` alone, because the leading column is usable by itself. A separate index on `(a)` is dead weight. This is the most common easy win.

**Reconsider the key.** If you are on random UUIDs and inserting heavily, UUID v7 or ULID sort by time and restore the append-at-the-edge behavior.

**Batch your inserts.** Amortizing the per-transaction overhead across many rows helps a lot. For bulk loads, dropping the index, loading, and rebuilding is often far faster than maintaining it row by row.

**Measure rather than reason.** Time the write path with and without the index on realistic data volumes. The cost depends on table size, index count, key distribution, and how much of the index fits in memory — none of which generalize from someone else's benchmark.

## The rule to carry forward

Every index is a bet that you will read that column far more often than you write the table. For most application tables that bet is correct, and adding an index is right. For a high-volume append path — event logs, metrics, audit trails, queues — the bet frequently loses, and the fix is fewer indexes, not more.

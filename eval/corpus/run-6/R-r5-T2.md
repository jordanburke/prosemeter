---
kind: eval-artifact
run: 6
variant: R
replicate: r5
task: T2
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

Indexes make reads faster and writes slower. Both are true at once. That tradeoff is the whole point of an index. Nobody lied to you. They told you half of it.

## Why the write got slower

An index is a second copy of part of your data, kept sorted. In PostgreSQL, MySQL, and SQL Server it is a B-tree holding the indexed column plus a pointer back to the row.

That copy has to stay correct. So every write does more work:

- **Insert** — the engine writes the row, then inserts a new entry into the index at the right sorted position. If the B-tree page it belongs on is full, the page splits. Splitting allocates a new page and updates the parent. Sometimes that cascades up the tree.
- **Update** — if you touched an indexed column, the sort order changed. The engine removes the old index entry and inserts a new one elsewhere. Updates to non-indexed columns are cheaper, and MySQL's InnoDB and Postgres's HOT updates optimize that case.
- **Delete** — the index entry goes too.

Add a second index and you pay that cost twice. A table with eight indexes does eight extra structural updates per insert. That is why write-heavy tables stay lean on indexes and analytics tables do not.

There is a durability cost as well. The engine logs the index changes to the write-ahead log. So each transaction pushes more bytes to disk, and dirties more pages in the buffer pool that must be flushed later.

## The part that surprises people

Where you insert matters enormously.

Put the index on an auto-incrementing id or a timestamp, and every new row lands at the right edge of the tree. That is the cheapest case: one hot page, in memory, with clean splits.

Put the index on a UUID v4 or anything random, and every insert lands somewhere unpredictable. You now touch a different page each time. Once the index outgrows memory, each insert costs a disk read to fetch the page before you can change it. Throughput can fall tenfold at the point the index stops fitting in RAM. That is why the slowdown arrives as a cliff instead of a slope.

That cliff explains a write slowdown that feels disproportionate to "one more index."

## What to do about it

**Confirm the index is earning its keep.** Run `EXPLAIN` on the queries you added it for. An index no query plan chooses is pure cost. Postgres and MySQL both report per-index usage counts. Check them before adding another.

**Drop redundant indexes.** An index on `(a, b)` already serves queries filtering on `a` alone, because a query can use the leading column by itself. A separate index on `(a)` is dead weight. This is the easiest win available.

**Reconsider the key.** If you are on random UUIDs and inserting at volume, switch to UUID v7 or ULID. They sort by time, which restores the append-at-the-edge behavior.

**Batch your inserts.** Spreading the per-transaction overhead across many rows cuts it sharply. For bulk loads, drop the index, load, and rebuild. That beats maintaining the index row by row.

**Measure instead of reasoning.** Time the write path with and without the index on realistic data volumes. The cost depends on table size, index count, key distribution, and how much of the index fits in memory. None of those generalize from another team's benchmark.

## The rule to carry forward

Every index is a bet that you will read that column far more than you write the table. For a typical application table the bet is correct, and adding the index is right. For a high-volume append path — event logs, metrics, audit trails, queues — the bet loses, and the fix is fewer indexes, not more.

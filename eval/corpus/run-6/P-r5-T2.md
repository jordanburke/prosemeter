---
kind: eval-artifact
run: 6
variant: P
replicate: r5
task: T2
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

Indexes make reads faster and writes slower. Both are true at once, and that trade is the point of an index. Nobody lied to you; they told you half.

## Why the write got slower

An index is a second copy of part of your data, kept sorted. Usually it is a B-tree holding the indexed column plus a pointer back to the row.

That copy has to stay correct, so every write does extra work:

- **Insert** — write the row, then place a new entry at its sorted position in the index. If that B-tree page is full, the page splits: allocate a new page, update the parent, and occasionally cascade further up the tree.
- **Update** — touching an indexed column removes the old entry and inserts a new one somewhere else, because the sort order changed. Updating a non-indexed column is cheaper, and some engines optimize that case directly.
- **Delete** — the index entry goes too.

Add a second index and you pay again. A table with eight indexes does eight extra structural updates per insert. That is why write-heavy tables stay lean on indexes and analytics tables do not.

Durability costs more too. Index changes go into the write-ahead log, so each transaction pushes more bytes to disk and dirties more pages that must eventually flush.

## The part that surprises people

Where the rows land matters enormously.

Index an auto-incrementing id or a timestamp and every new row lands at the right edge of the tree. That is the cheapest case: one hot page, always in memory, clean occasional splits.

Index a UUID v4 or anything random and every insert lands somewhere unpredictable. You touch a different page each time. Once the index outgrows memory, each insert first reads a page from disk before it can change it. Throughput can drop by ten times at exactly the moment the index stops fitting in RAM, which is why this reads as a cliff rather than a slope.

That cliff usually explains a slowdown that feels far too big for "one more index."

## What to do

**Check the index earns its keep.** Run `EXPLAIN` on the queries you added it for. An index no plan chooses is pure cost. Most databases report per-index usage counts; read them before adding another.

**Drop redundant indexes.** An index on `(a, b)` already serves queries filtering on `a` alone, because a leading column works by itself. A separate index on `(a)` is dead weight. This is the easiest win available.

**Reconsider the key.** On random UUIDs with heavy inserts, UUID v7 or ULID sort by time and restore the append-at-the-edge behavior.

**Batch inserts.** Spreading per-transaction overhead across many rows helps a lot. For bulk loads, dropping the index, loading, and rebuilding usually beats maintaining it row by row.

**Measure instead of reasoning.** Time the write path with and without the index at realistic volumes. The cost depends on table size, index count, key distribution, and how much of the index fits in memory. None of that carries over from someone else's benchmark.

## The rule to carry forward

Every index bets that you read a column far more often than you write the table. For most application tables the bet wins and the index is right. For high-volume append paths — event logs, metrics, audit trails, queues — the bet often loses, and the fix is fewer indexes, not more.

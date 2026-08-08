---
kind: eval-artifact
run: 5
variant: A
replicate: r4
task: T2
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes make reads faster and writes slower. Both are true. Nobody lied to you; they just told you half of it.

## Why the write got slower

An index is a second copy of some of your data, kept in sorted order. A B-tree on `users.email` is a whole separate structure holding every email and a pointer back to the row.

The database has to keep that copy correct. So every write now does more work.

- **INSERT** writes the row, then also inserts into every index on that table. Each insert has to find the right leaf page in the B-tree and put the entry there.
- **DELETE** removes the row, then removes or marks the entry in every index.
- **UPDATE** is the worst case. If you change an indexed column, the index entry has to move — its sort position changed. That is a delete plus an insert in the index, not an edit in place.

One index on a table means roughly double the write structures touched. Five indexes means six.

## The part that surprises people

The cost is not just "a bit more CPU." Two things make it worse than a linear tax.

**Random I/O.** Appending a row to a heap is sequential and cheap. Inserting into a B-tree lands wherever the sort order says, which is scattered across the index. On a table larger than memory, that is a random read to pull the page in before you can write it.

**Page splits.** B-tree pages are fixed size. When a page fills and another entry arrives, the database splits it in two and updates the parent. Occasionally that cascades up the tree. So most inserts are cheap and a few are expensive, which shows up as latency spikes rather than a uniform slowdown.

Index on a monotonically increasing column — an auto-increment id, a timestamp — avoids most of the random I/O, because every insert goes to the same rightmost page. Index on a UUIDv4 or an email is the opposite: every insert lands somewhere random. That is why the same "one index" can cost 5% or 50% depending on the column.

## Write amplification, and the log

There is a third cost that is easy to miss. The index change is also durable, so it goes through the write-ahead log too. Postgres can write a full page image of an index page the first time it is touched after a checkpoint. Your one-row insert became several kilobytes of WAL. That WAL then gets replicated, so replicas do the work again.

## What to do about it

**Count your indexes and drop the ones nobody reads.** This is almost always the win. Tables accumulate indexes from old features and speculative tuning. In Postgres, `pg_stat_user_indexes` shows `idx_scan` per index — a count of zero over a real workload window means it is pure cost. Check it on the primary, and check replicas separately if they serve reads.

**Look for redundant prefixes.** An index on `(a, b)` already serves queries filtering on `a` alone. A separate index on `(a)` is paying twice for one capability. Drop the narrower one.

**Match the index to a real query.** Adding an index because a column "seems searchable" is guessing. Add it because you have an `EXPLAIN` showing a sequential scan you want gone.

**Decide which side you are optimizing.** A write-heavy table — event log, telemetry, queue — should carry as few indexes as it can. A read-heavy table that is written rarely can carry many. There is no universal right number; there is a ratio in your workload.

**Bulk loads: drop and rebuild.** Loading millions of rows into an indexed table is much slower than loading into a bare table and building the index afterward. Building once from sorted data beats maintaining incrementally through millions of random insertions.

## The honest summary

An index is a bet. You are paying on every write to make some reads cheap. The bet pays off when the reads are frequent and the index actually gets used. It loses when you add indexes on speculation and never check whether anything queries them.

Your write got slower because you placed a bet. Now go check whether it is paying.

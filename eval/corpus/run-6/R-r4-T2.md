---
kind: eval-artifact
run: 6
variant: R
replicate: r4
task: T2
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

Indexes make reads faster and writes slower. Both are true. Nobody lied to you. They told you half of it.

## Why the write got slower

An index is a second copy of part of your data, kept in sorted order. A B-tree on `users.email` is a separate structure. It holds every email and a pointer back to the row.

The database has to keep that copy correct. So every write now does more work.

- **INSERT** writes the row, then adds an entry to every index on that table. Each entry has to find the right leaf page in the B-tree and land there.
- **DELETE** removes the row, then removes or marks the entry in every index.
- **UPDATE** is the worst case. Change an indexed column and the index entry has to move, because its sort position changed. That is a DELETE plus an INSERT in the index, not an edit in place.

One index on a table doubles the write structures touched. Five indexes means six.

## The part that surprises people

The cost is not a small CPU tax. Two effects make it worse than linear.

**Random I/O.** Appending a row to a heap is sequential and cheap. An INSERT into a B-tree lands where the sort order puts it, scattered across the index. On a table larger than memory, that means a random read to pull the page in before you can write it.

**Page splits.** B-tree pages are fixed size. When a page fills and another entry arrives, the database splits it in two and updates the parent. That split sometimes cascades up the tree. So the typical INSERT is cheap and a handful are expensive. You see latency spikes, not a uniform slowdown.

An index on a monotonically increasing column — an auto-increment id, a timestamp — avoids the random I/O. Every INSERT goes to the same rightmost page. An index on a UUIDv4 or an email does the opposite. Every INSERT lands at a random position. That is why the same "one index" can cost 5% or 50% depending on the column.

## Write amplification, and the log

A third cost is easy to miss. The index change is durable too, so it goes through the write-ahead log. Postgres writes a full page image of an index page the first time it touches that page after a checkpoint. Your one-row INSERT became several kilobytes of WAL. Postgres then replicates that WAL, so replicas repeat the work.

## What to do about it

**Count your indexes and drop the ones nobody reads.** This is the win in most tables. Tables accumulate indexes from old features and speculative tuning. In Postgres, `pg_stat_user_indexes` shows `idx_scan` per index. A count of zero over a real workload window means the index is pure cost. Check it on the primary, and check replicas separately if they serve reads.

**Look for redundant prefixes.** An index on `(a, b)` already serves queries filtering on `a` alone. A separate index on `(a)` pays twice for one ability. Drop the narrower one.

**Match the index to a real query.** Adding an index because a column looks searchable is guessing. Add it because an `EXPLAIN` shows a sequential scan you want gone.

**Decide which side you are optimizing.** A write-heavy table — event log, telemetry, queue — should carry as few indexes as it can. A table read constantly and written once a day can carry a dozen. No universal right number exists. There is a ratio in your workload.

**Bulk loads: drop and rebuild.** Loading millions of rows into an indexed table runs far slower than loading into a bare table and building the index afterward. Building once from sorted data beats maintaining incrementally through millions of random insertions.

## The honest summary

An index is a bet. You pay on every write to make certain reads cheap. The bet pays off when those reads are frequent and the planner uses the index. It loses when you add indexes on speculation and never check whether anything queries them.

Your write got slower because you placed a bet. Now go check whether it is paying.

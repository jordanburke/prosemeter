---
kind: eval-artifact
run: 6
variant: P
replicate: r4
task: T2
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

Indexes make reads faster and writes slower. Both are true. Nobody lied to you; they told you half of it.

## Why the write got slower

An index is a second copy of some of your data, kept in sorted order. A B-tree on `users.email` is a separate structure holding every email plus a pointer back to the row.

The database has to keep that copy correct, so every write does more work.

- **INSERT** writes the row, then inserts an entry into every index on the table. Each one has to find the right leaf page and put the entry there.
- **DELETE** removes the row, then removes or marks the entry in every index.
- **UPDATE** is the worst case. Change an indexed column and the entry has to move, because its sort position changed. That is a delete plus an insert in the index, not an edit in place.

One index roughly doubles the structures a write touches. Five indexes means six.

## The part that surprises people

The cost is not just a bit more CPU. Two things make it worse than a flat tax.

**Random I/O.** Appending a row to a heap is sequential and cheap. Inserting into a B-tree lands wherever the sort order says, scattered across the index. On a table bigger than memory, that means a random read to pull the page in before you can write it.

**Page splits.** B-tree pages are a fixed size. When a full page gets another entry, the database splits it in two and updates the parent, and once in a while that cascades up the tree. So most inserts are cheap and a few are expensive. You see latency spikes, not a uniform slowdown.

The column decides which world you are in. An index on a value that only climbs — an auto-increment id, a timestamp — avoids most of the random I/O, because every insert goes to the same rightmost page. An index on a UUIDv4 or an email is the opposite: every insert lands somewhere random. That is why the same "one index" can cost 5% or 50%.

## Write amplification, and the log

There is a third cost that is easy to miss. The index change is durable too, so it goes through the write-ahead log. Postgres can write a full page image of an index page the first time it is touched after a checkpoint. Your one-row insert became several kilobytes of WAL. That WAL then ships to replicas, which do the work again.

## What to do about it

**Count your indexes and drop the ones nobody reads.** This is almost always the win. Tables collect indexes from old features and speculative tuning. In Postgres, `pg_stat_user_indexes` reports `idx_scan` per index, and a count of zero over a real workload window means pure cost. Check the primary, and check replicas separately if they serve reads.

**Look for redundant prefixes.** An index on `(a, b)` already serves queries filtering on `a` alone. A separate index on `(a)` pays twice for one capability. Drop the narrower one.

**Match each index to a real query.** Adding an index because a column "seems searchable" is guessing. Add it because you have an `EXPLAIN` showing a sequential scan you want gone.

**Decide which side you are optimizing.** A write-heavy table — event log, telemetry, queue — should carry as few indexes as it can. A read-heavy table that is rarely written can carry many. There is no universal right number; there is a ratio in your workload.

**For bulk loads, drop and rebuild.** Loading millions of rows into an indexed table is far slower than loading into a bare table and building the index after. Building once from sorted data beats maintaining incrementally through millions of random insertions.

## The honest summary

An index is a bet. You pay on every write to make some reads cheap. It pays off when those reads are frequent and the index actually gets used. It loses when you add indexes on speculation and never check whether anything queries them.

Your write got slower because you placed a bet. Now go check whether it is paying.

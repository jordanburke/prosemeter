---
kind: eval-artifact
run: 5
variant: E
replicate: r5
task: T2
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. You got exactly what an index does. Nobody was wrong; they just told you half of it.

## Why the write got slower

An index is a second copy of part of your data, kept sorted. The table holds the rows. The index holds the indexed columns plus a pointer back to each row.

Every write now has to maintain both.

- An `INSERT` writes the row, then inserts an entry into the index in sorted position.
- A `DELETE` removes the row, then removes the index entry.
- An `UPDATE` touches the index only if it changes an indexed column — but then it costs a delete plus an insert there.

Add five indexes and a single insert does six pieces of work. That is the whole story at the level that matters.

## The parts that make it worse than it sounds

**The index writes are scattered.** Your table rows usually append near the end. Index entries land wherever the sort order puts them, which for a random value like a UUID or an email is anywhere in the structure. Scattered writes touch more pages, and more pages means more disk I/O and more cache pressure.

**Pages split.** A B-tree stores entries in fixed-size pages. When a page fills and another entry must go in, the database splits it into two half-full pages and updates the parent. One insert becomes several page writes.

**The write-ahead log grows.** Every index change is logged too, so replication traffic and backup size go up with it.

**Locks are held longer.** More work inside the transaction means more time holding whatever it holds, so concurrent writers wait.

## When the trade is worth it

Compare the read you save against the writes you pay.

A table that is read a thousand times per write should be indexed generously. A high-volume ingest table read once a day by a batch job should carry as few indexes as you can manage.

Check whether the index is even used before you keep paying for it. Postgres exposes this in `pg_stat_user_indexes`; an index with `idx_scan` near zero is pure cost. MySQL has similar counters in `sys.schema_unused_indexes`.

## What to do now

Measure first. Confirm the slowdown is the index and not something that landed at the same time.

Then ask three questions.

1. Is this index used by a query that runs often enough to matter?
2. Does an existing index already cover it? A composite index on `(a, b)` already serves queries filtering on `a` alone, so a separate index on `a` is dead weight.
3. Can it be narrower? Fewer columns and a partial index — `WHERE status = 'active'` — cost less to maintain.

Drop what you cannot justify. Keeping an unused index is paying rent on every write forever.

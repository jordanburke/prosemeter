---
kind: eval-artifact
run: 5
variant: L
replicate: r5
task: T2
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. That is the trade, and you just paid the write half of it. Nothing is broken.

## Why the write got slower

An index is a second copy of your data, sorted. The database keeps it in a B-tree, ordered by the column you indexed.

Every write now touches two structures instead of one. An `INSERT` adds the row to the table and adds an entry to the index. A `DELETE` removes both. An `UPDATE` to an indexed column removes the old index entry and inserts a new one, because the row's sorted position moved.

Add a second index and writes touch three structures. Add five and they touch six. The cost grows straight up with the number of indexes on the table.

## Three things make it worse than you would guess

**The tree has to stay balanced.** When a B-tree page fills, the database splits it in two and rewrites the parent. Most inserts are cheap, a few are expensive, and the expensive ones land at random.

**The writes are scattered.** Your table rows go in wherever there is room, often at the end. Index entries go where the sort order says, which is somewhere in the middle. That turns one sequential write into several random ones, and random writes cost more on every storage device.

**Locks widen.** Two transactions inserting unrelated rows can now contend on the same index page. Concurrency drops even when total work looks flat.

There is a special case worth knowing. If you index a column whose values always increase — a timestamp, an auto-increment id — every insert hits the same rightmost page. That page becomes a hotspot and concurrent inserts queue behind it.

## What to do about it

First, check the index is earning its keep. Ask the planner:

```sql
EXPLAIN ANALYZE SELECT ... ;
```

If the plan does not use the index, drop it. You are paying write cost for nothing. Databases also track index usage — Postgres exposes it in `pg_stat_user_indexes` — so you can find the dead ones directly.

Then look for redundancy. An index on `(a, b)` already serves queries filtering on `a` alone. A separate index on `(a)` adds write cost and buys nothing. Drop it.

Narrow the index if you can. A partial index covers only the rows you query:

```sql
CREATE INDEX ON orders (customer_id) WHERE status = 'open';
```

Closed orders never touch that index, so writes to them stay cheap.

Finally, batch your loads. If you are inserting millions of rows, drop the index, load, and rebuild it. Building an index once beats maintaining it a million times.

## The rule to carry forward

Every index is a bet that you will read that column far more than you write the table. For most application tables that bet pays off, which is why "indexes make things faster" is decent advice. For a write-heavy table it can lose. Measure both sides before you keep one.

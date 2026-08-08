---
kind: eval-artifact
run: 4
variant: A
replicate: r1
task: T2
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Both things are true — indexes make reads faster and writes slower. Nobody mentions the second half because they're usually talking about `SELECT`.

Here's the mechanism. An index is a **second copy of some of your data**, stored in a different order (a B-tree, sorted by the indexed column). That copy doesn't maintain itself. Every `INSERT` now has to write the row into the table *and* insert an entry into the index in the correct sorted position. Every `DELETE` has to remove both. Every `UPDATE` that touches an indexed column has to remove the old index entry and add a new one.

So the write amplification is straightforward: one index means roughly twice the write work per row. Five indexes means six writes per row. That's the whole story at the simple level.

A few things make it worse than the naive count suggests:

**Random insertion is expensive.** Appending to a heap table is sequential and cheap. Inserting into a sorted structure means finding the right page and writing there — scattered across the disk. If the index is on something random like a UUID, every insert lands on a different page. If it's on a monotonically increasing column like a timestamp, they all land on the same hot page, which is better for I/O but becomes a contention point.

**Page splits.** When the target index page is full, the database splits it into two and rewrites the parent pointers. That's a burst of extra work landing unpredictably on whichever unlucky insert triggered it.

**In Postgres specifically, you may have killed HOT updates.** Postgres has an optimization where an `UPDATE` that doesn't change any indexed column can write the new row version on the same page and skip touching the indexes entirely. That's a "heap-only tuple" update, and it's dramatically cheaper. The moment you index a column that your updates modify, every one of those updates falls off the fast path and has to update *every* index on the table, not just yours. This is the one that surprises people, because the slowdown is way out of proportion to "I added one index."

**WAL volume goes up**, which means more disk throughput, more to replicate, longer checkpoints.

So what do you do?

- Check the index is actually earning its keep. `pg_stat_user_indexes` shows `idx_scan` — if it's near zero after a few days of real traffic, drop it.
- Look for redundancy. An index on `(a)` is redundant if you already have `(a, b)` — the composite serves prefix lookups. People accumulate these.
- Consider a partial index if you only query a subset: `CREATE INDEX ... WHERE status = 'active'`. Smaller index, less maintenance, and it doesn't get touched on rows outside the predicate.
- If the indexed column is one your updates hit constantly, ask whether the read it serves is worth losing HOT updates on a hot-write table. Sometimes the answer is no.

The general framing: indexes are a **trade**, not a free win. You're spending write throughput and disk to buy read latency. On a read-heavy table that's a fantastic deal. On a write-heavy table you should be deliberate about each one.

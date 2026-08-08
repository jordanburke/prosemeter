---
kind: eval-artifact
run: 5
variant: E
replicate: r1
task: T2
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. That is not a bug in what you did — it is the trade the index makes. You bought faster lookups with slower inserts, updates, and deletes.

## Why the write costs more

An index is a second copy of some of your data, kept sorted. Postgres and MySQL usually store it as a B-tree.

Every write now has to touch both structures:

- **Insert.** The database writes the row, then walks the tree to find the right leaf, then puts the key there. If the leaf is full, it splits the leaf and updates the parent. A split can cascade upward.
- **Delete.** The database removes the row, then removes the key from every index.
- **Update.** The database rewrites the row, then rewrites the index entry for any indexed column you changed.

Each of those is extra I/O, extra locking, and extra write-ahead-log volume. Add five indexes to a table and a single insert does six writes.

## The parts that surprise people

**Random insert order hurts most.** A UUID v4 primary key lands in a random spot in the tree every time. That dirties a different page on every insert and keeps splitting leaves. A monotonic key — a sequence, a ULID, UUID v7 — always appends to the rightmost leaf, which stays hot in memory. Same index, very different cost.

**Updates can be worse than you expect.** Postgres normally uses HOT updates, which skip index maintenance when no indexed column changed. Index a column that your `UPDATE` statements write, and you lose that optimization for the whole table's updates, not just that column's.

**The write-ahead log grows.** Every index change is logged too. That means more disk throughput, longer checkpoints, and more bytes shipped to replicas. A write-heavy table with many indexes can saturate replication before it saturates the primary.

**Unique indexes add a read.** The database must check for a conflict before it writes, so a unique constraint puts a lookup in the write path.

## What to do about it

Keep the index if the read it serves matters more than the write cost. Most of the time it does — a query going from 2 seconds to 2 milliseconds is worth a few percent on inserts.

Otherwise:

1. **Count your indexes.** Look for ones nothing queries. In Postgres, `pg_stat_user_indexes` shows `idx_scan` — a zero there after a full traffic cycle means the index is pure cost. Drop it.
2. **Merge overlapping indexes.** An index on `(a, b)` already serves queries filtering on `a` alone. A separate index on `(a)` is redundant.
3. **Narrow the index.** A partial index (`WHERE status = 'active'`) only maintains entries for rows you actually query, so writes to other rows skip it entirely.
4. **Bulk-load without it.** For a large import, drop the index, load, rebuild. Building once is far cheaper than maintaining it row by row.

## The rule to carry forward

"Indexes make things faster" is shorthand for "indexes make reads faster." Every index is a standing tax on writes, paid forever, to make some specific query cheap. Measure that query before you add the index, and check the index is still used before you keep it.

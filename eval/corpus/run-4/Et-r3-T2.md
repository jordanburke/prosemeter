---
kind: eval-artifact
run: 4
variant: Et
replicate: r3
task: T2
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. Both are true. You added a second data structure the database now has to keep in sync.

**What happens on a write.** Before the index, an insert touched one place: the table. Now it touches two. The database writes the row, then finds the right spot in the index's B-tree and writes the key there too. An update touches the index whenever it changes an indexed column. A delete has to remove the entry. Every one of those is extra I/O, extra WAL, extra locking.

**Why the cost is worse than "twice the work."** Table inserts are usually append-y and land near each other. Index inserts land wherever the key sorts, which is scattered across the tree. That is random I/O instead of sequential. If the tree page is full, the database splits it, and a split rewrites pages and can cascade upward.

**The multiplier is the count.** One index is cheap. Six indexes on a hot table mean each insert does seven writes. Teams add indexes one at a time, each defensible on its own, and the write path quietly gets six times heavier.

**What to check on yours:**

- **Is the index actually used?** Look at `pg_stat_user_indexes` (or the equivalent). An unused index is pure cost. Drop it.
- **Does it duplicate another one?** An index on `(a)` is redundant if you already have `(a, b)` — the composite serves both.
- **Is the key wide?** Indexing a long text column copies that text into the tree. Consider a hash or a prefix.
- **Is the key random?** UUIDv4 primary keys scatter across the whole tree and cause constant splits. UUIDv7 or a time-ordered key writes to the tail instead.

**The trade is real, not a mistake.** You choose it per table by traffic shape. A write-heavy events table wants almost no indexes. A read-heavy lookup table wants several. Measure the read you were trying to fix — if it went from 800ms to 3ms and writes went from 2ms to 3ms, you won.

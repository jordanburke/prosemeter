---
kind: eval-artifact
run: 4
variant: A
replicate: r2
task: T2
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Both things are true — indexes make reads faster and writes slower. The "indexes make things faster" advice is about reads, and it usually gets repeated without the second half.

Here's the mechanics. An index is a separate data structure (a B-tree, typically) that stores a sorted copy of the indexed column plus a pointer back to the row. That structure has to stay correct, so every write to the table also writes to the index:

- **INSERT** — the row goes in the table, then a new entry has to be placed in the correct sorted position in the index. That may require splitting a B-tree page.
- **DELETE** — the row is marked dead, and the index entry has to be cleaned up too.
- **UPDATE** — if you touched an indexed column, that's effectively a delete plus an insert in the index. In Postgres an update can require touching *every* index on the table, even ones on untouched columns, unless it qualifies for a HOT update.

So a table with five indexes does roughly six writes per insert instead of one. That's the cost, and it's linear in the number of indexes. Your write slowdown is exactly the tax you paid for the read speedup.

There's a second effect that often matters more than the raw write amplification: **random I/O**. Table inserts are usually appends — sequential, cheap. Index inserts land wherever the sorted position happens to be, which is scattered. If the index doesn't fit in memory, you're paying disk seeks on every insert. This is why the slowdown often looks fine in dev and terrible in prod, and why it gets worse as the table grows.

What to do about it:

- **Confirm the index is actually earning its keep.** Check `pg_stat_user_indexes` — if `idx_scan` is near zero, the index is pure cost. This is more common than people expect, especially after a query gets rewritten.
- **Look for redundancy.** An index on `(a)` is redundant if you already have `(a, b)` — the composite serves prefix lookups fine. Dropping the narrower one is free.
- **Reconsider the column.** Indexing a high-churn column is the expensive case, because every update rewrites the index entry. Indexing something write-once-read-many is nearly free.
- **Consider a partial index** if the queries only ever hit a subset: `CREATE INDEX ... WHERE status = 'active'`. Smaller structure, cheaper maintenance, and only rows matching the predicate cost you anything on write.

The honest framing is that this is a trade, not a mistake. If the read it enables was a sequential scan over ten million rows running a thousand times a minute, a slower insert is a great deal. Measure both sides before deciding — what does the write latency look like now versus before, and what did the read latency do?

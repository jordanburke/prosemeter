---
kind: eval-artifact
run: 3
variant: B
replicate: r4
task: T2
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes make *reads* faster. They make writes slower, and that's expected, not a bug in what you did.

Think of an index as a second, separately sorted copy of one column, kept alongside the table. When you read, the database can jump straight to the rows it wants instead of scanning everything. But when you write, it now has two things to update instead of one — the row itself, plus the index entry, placed in the correct sorted position. Add five indexes and every insert does six writes.

A few things make this worse than people expect:

- **Random insert positions.** If the indexed column is something like a UUID or an email address, new entries land in the middle of the sorted structure, which means page splits and more disk churn. An index on an auto-incrementing ID or a timestamp appends at the end and is much cheaper.
- **Updates too, not just inserts.** If you update the indexed column, the database has to remove the old index entry and insert a new one.
- **Wide indexes.** A multi-column index on several large text columns is a lot of bytes to maintain per row.

So the real question is whether the trade is worth it. Indexes pay off when reads are frequent and the index actually eliminates a lot of work. They're a bad deal on a write-heavy table that's rarely queried on that column, or when the column has few distinct values (an index on a boolean rarely helps — the database will often just scan anyway).

Two things I'd check:

1. Is the index being used? Run `EXPLAIN` on the query you added it for. If the planner is ignoring it, you're paying the write cost for nothing — drop it.
2. How much slower are writes, in absolute terms? Going from 0.4ms to 0.6ms per insert is usually fine. Going from 2ms to 40ms means something else is going on and worth digging into.

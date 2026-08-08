---
kind: eval-artifact
run: 1
variant: G
replicate: r1
task: T2
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. That's the whole trade, and nobody mentions the second half.

An index is a second copy of your data, sorted a different way. The table holds the rows. The index holds the indexed columns plus a pointer back to each row, kept in sorted order. So every `INSERT` now writes twice — once to the table, once to the index. Every `DELETE` writes twice. An `UPDATE` that touches an indexed column writes twice, and if the new value sorts elsewhere, the database removes the old index entry and inserts a new one.

Sorted order is the expensive part. Appending to a table is cheap because the row goes at the end. Inserting into a B-tree means finding the right leaf page, and if that page is full, splitting it and updating the parent. Random keys like UUIDv4 make this worse, because each insert lands on a different page and your write pattern turns into scattered I/O across the whole index.

Three things make the cost bigger than you'd expect:

- **Every index pays.** Five indexes on a table means six writes per insert, not two.
- **Wide indexes cost more.** A four-column index copies four columns per row.
- **Write-heavy tables feel it most.** An audit log or events table is nearly all writes, so an index there is nearly all cost.

**What to do about it:**

Check whether the index earns its keep. In Postgres, `pg_stat_user_indexes` shows scan counts per index — anything sitting at `idx_scan = 0` after a few weeks of real traffic is pure overhead, so drop it. Then look for redundancy: an index on `(a, b)` already serves queries that filter on `a` alone, so a separate index on `(a)` is dead weight.

If the read you're speeding up is rare and the writes are constant, you may be better off without the index and eating the slower query. Measure both sides before you decide. Rule of thumb: index what you filter, join, and sort on often — and treat every index as a bill you pay on every write forever.

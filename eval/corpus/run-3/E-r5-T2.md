---
kind: eval-artifact
run: 3
variant: E
replicate: r5
task: T2
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. You added a read optimization and paid for it on the write side. That is the deal, not a bug.

An index is a second copy of some of your data, kept sorted. The database has to keep that copy true. Every `INSERT` writes the row and then writes an entry into each index. Every `DELETE` removes both. Every `UPDATE` that touches an indexed column has to move the entry to its new sorted position, which usually means a delete plus an insert. Five indexes on a table means an insert does six writes, not one.

It gets worse than the raw count suggests. The index is a B-tree, so inserts land wherever the sort order puts them, not at the end. That means random page writes instead of sequential ones. When a page fills, the database splits it, which is more work again. Random UUID primary keys are the classic version of this pain — every insert lands in a different page. Sequential keys stay hot in one page and cost far less.

So decide by measuring. Ask what queries the index serves and how often they run. An index that turns a 2-second dashboard query into 20 milliseconds is worth 15% slower inserts. An index nobody's query plan picks is pure cost.

Find the freeloaders:

```sql
SELECT relname, indexrelname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY relname;
```

Anything at zero scans after a real week of traffic is a write tax you are paying for nothing. Drop it.

Two more things worth knowing. A composite index on `(a, b)` also serves queries on `a` alone, so you often need fewer indexes than you think. And bulk loads run much faster if you drop the indexes, load, then rebuild — one sorted build beats a million incremental ones.

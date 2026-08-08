---
kind: eval-artifact
run: 4
variant: Et
replicate: r1
task: T2
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes make reads faster and writes slower. Both are true. Nobody told you the second half.

**Why**

An index is a second copy of your data, sorted differently. A B-tree index on `email` holds every email in the table plus a pointer back to the row.

Every write has to keep that copy in sync:

- `INSERT` writes the row, then writes one entry per index.
- `DELETE` removes the row, then removes one entry per index.
- `UPDATE` touches only the indexes whose columns changed — but if the row moves, every index pointing at it may need updating.

So a table with five indexes does roughly six writes per insert, not one. Your write path got slower by exactly the work you added.

**The part that bites harder than the arithmetic**

The extra writes land in random places. Your table rows append at the end of the heap, which is sequential and cheap. Index entries land wherever the sort order puts them — an email starting with "z" goes to a different page than one starting with "a". That is random I/O, plus more pages dirtied, plus more WAL to flush.

On a write-heavy table with a randomly-distributed key like a UUID, this is the whole cost. On a table indexed by an increasing timestamp, inserts cluster at the right edge of the tree and cost much less.

**What to do**

Check whether anything uses the index:

```sql
SELECT indexrelname, idx_scan
FROM pg_stat_user_indexes
WHERE relname = 'your_table';
```

`idx_scan = 0` after a week of production traffic means the index earns nothing and costs every write. Drop it.

If it is used, the question is whether the read win beats the write cost for your traffic mix. A table read a thousand times per write should be indexed generously. A table written a thousand times per read should have almost no indexes.

Also check for redundancy. An index on `(a, b)` already serves queries filtering on `a` alone. A separate index on `(a)` is pure overhead. `pg_stat_user_indexes` plus a look at your index list usually turns up one or two of these.

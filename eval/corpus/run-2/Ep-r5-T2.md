---
kind: eval-artifact
run: 2
variant: Ep
replicate: r5
task: T2
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. That is the trade, and you just paid the second half of it.

An index is a second data structure — usually a B-tree — that stores a sorted copy of the indexed columns plus a pointer to the row. Reads get faster because the database walks the tree instead of scanning the table. But the database has to keep that tree correct, so every write now does extra work:

- **Insert** writes the row, then adds an entry to every index on the table.
- **Delete** removes the row, then removes the entry from every index.
- **Update** touches an index only if you changed a column that index covers — but it costs two operations there, a delete and an insert, because the row's position in the sorted order may change.

The cost multiplies by index count. Five indexes means five tree updates per insert, not one.

Two things make it worse than the raw arithmetic suggests:

- **Page splits.** When a tree page fills up, the database splits it in two and rewrites the parent. Random insert keys — UUIDv4 is the usual offender — scatter writes across the whole tree and cause splits constantly. Sequential keys append to the rightmost page and mostly avoid this.
- **Write amplification.** Each index is separate pages on disk, so each one adds its own I/O and its own write-ahead log traffic.

So check three things:

1. **Is the index used?** Look at `pg_stat_user_indexes.idx_scan` in Postgres. An index with zero scans is pure cost — drop it.
2. **Is it redundant?** An index on `(a, b)` already serves queries filtering on `a` alone. A separate index on `(a)` buys you nothing.
3. **Is the write path hot?** If the table takes far more writes than reads, an index that helps a rare query may not be worth it.

The rule of thumb: index for the queries you actually run, not for the ones you might. Every index you keep is rent you pay on every write.

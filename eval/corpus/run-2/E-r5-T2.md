---
kind: eval-artifact
run: 2
variant: E
replicate: r5
task: T2
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. You got exactly what an index does.

An index is a second copy of some of your data, sorted. Every insert has to write the row *and* add an entry to the index. Every delete has to remove both. Every update to an indexed column has to remove the old index entry and add a new one. So each index you add is more work per write, and that cost is roughly linear in the number of indexes on the table.

The cost is worse than "one extra write" for two reasons.

**The index write lands in a random spot.** Your table rows append at the end. Your index entry goes wherever the sort order puts it, which means reading a page, changing it, and writing it back. Random page writes cost far more than sequential ones.

**Pages split.** A B-tree page fills up, and the database splits it in two and rewrites the parent. Insert into the middle of the key range often enough and you pay this regularly.

A few things make it hurt more than usual:

- **A random key**, like a UUIDv4, scatters inserts across the whole tree instead of packing them at one end. A time-ordered key (UUIDv7, ULID, a serial) keeps the writes local.
- **A wide index**, or one with several columns, is simply more bytes to write.
- **A frequently-updated column** pays the delete-plus-insert on every update, even when the row itself barely changed.

So the question is not "is this index fast" but "does this index earn its cost". Check whether it gets used:

```sql
SELECT indexrelname, idx_scan FROM pg_stat_user_indexes WHERE relname = 'your_table';
```

An index with `idx_scan` near zero is pure overhead. Drop it.

If the index does earn its keep and writes still hurt, try a narrower index, a partial index with a `WHERE` clause that covers only the rows you query, or a better-ordered key. Measure the write latency before and after. Do not guess.

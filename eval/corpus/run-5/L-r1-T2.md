---
kind: eval-artifact
run: 5
variant: L
replicate: r1
task: T2
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. That trade is the whole design, not a bug you hit.

An index is a second copy of your data, sorted. Usually a B-tree keyed on the column you indexed, pointing back at the row. A read can jump straight to the rows it wants instead of scanning the table. That is the win.

The database has to keep that second copy true. So every write now does more work:

- **INSERT** writes the row, then writes an entry into every index on the table.
- **DELETE** removes the row, then removes or marks its entry in every index.
- **UPDATE** touches the indexes on the columns you changed. Change an indexed column and the entry moves — the old key is removed, the new key is inserted at a different place in the tree.

So one index means roughly two writes where you had one. Five indexes mean six. You added one index and paid for it on every write to that table, forever.

Three things make it worse than the raw count suggests.

**Page splits.** A B-tree stores keys in fixed-size pages. Insert into a full page and the database splits it in two and rewrites the parent. Random keys — UUIDv4, a hash, an email — scatter inserts across the whole tree and cause splits constantly. Sequential keys append to the rightmost page and rarely split. This is why a UUID index costs more than an auto-increment index on the same table.

**More disk written.** The index change goes into the write-ahead log too, so the row is not the only thing hitting disk. Postgres can write a full page image of a split index page.

**Lock and cache pressure.** Index pages are hot and shared. Concurrent writers contend on the same upper levels of the tree, and the index competes with your table data for buffer cache.

What to do about it.

Keep indexes that real queries use. Drop the rest. Postgres tracks usage in `pg_stat_user_indexes`; MySQL has `sys.schema_unused_indexes`. Unused indexes are pure cost.

Check for redundant ones. An index on `(a, b)` already serves queries filtering on `a` alone, so a separate index on `a` is dead weight.

Consider a partial index if you only query a slice — `WHERE status = 'active'` — so inactive rows never enter the tree.

Then measure. Time the write path before and after, on data at your real size. "Everyone says indexes make things faster" is true of the reads you were told about and false of the writes nobody mentioned.

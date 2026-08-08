---
kind: eval-artifact
run: 2
variant: G
replicate: r4
task: T2
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. That trade is the whole point of an index, not a bug in yours.

An index is a second copy of some of your data, sorted. The B-tree holds the indexed columns plus a pointer to the row. Reads get faster because the database walks a sorted tree instead of scanning every row.

But that copy has to stay true. So every write now does more work:

- **INSERT** writes the row, then writes an entry into every index on the table.
- **DELETE** removes the row, then clears the entry from every index.
- **UPDATE** touches an index only if you changed a column that index covers. Change a column no index mentions and the indexes stay untouched.

So one index means roughly two writes per insert. Five indexes mean six. The cost grows with the count of indexes, not the size of the table.

Two things make it worse than the raw count suggests. Random inserts, like a UUID primary key, land in the middle of the tree and force page splits, while an ordered key like a timestamp appends to the end and stays cheap. And every index write is also a write-ahead-log write, so you pay in disk I/O and replication lag too.

What to do:

- **Count the indexes on the table.** Three or four is normal. Twelve means someone added one per query and never cleaned up.
- **Drop the ones nobody uses.** Postgres tracks this in `pg_stat_user_indexes` — look for `idx_scan = 0` after a full traffic cycle.
- **Merge instead of adding.** One index on `(a, b)` serves queries on `a` alone and on `a, b`. Two separate indexes cost two writes and buy you little.
- **Check the read actually got faster.** Run `EXPLAIN ANALYZE` and confirm the planner uses the index. An index the planner ignores is pure write cost.

The right question is not "is this index fast?" but "does this index earn its write cost?" A table read a thousand times per write wants many indexes. A high-volume log table wants almost none.

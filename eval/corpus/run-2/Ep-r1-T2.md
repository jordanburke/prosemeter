---
kind: eval-artifact
run: 2
variant: Ep
replicate: r1
task: T2
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. You paid the write cost to buy the read benefit. That trade is working as designed.

An index is a second copy of your data, sorted. The table itself does not know about your `WHERE` clause, so the database keeps a separate B-tree holding the indexed columns plus a pointer back to the row. Every `INSERT` writes the row **and** inserts a key into that tree. Every `DELETE` removes both. Every `UPDATE` that touches an indexed column deletes the old key and inserts the new one. Add a fourth index and each write does five pieces of work instead of one.

Three things make it worse than the raw multiplier suggests:

- **Random keys scatter the writes.** A UUID index lands each new key in a different page of the tree, so the database dirties pages all over the disk. An index on an auto-increment id or a timestamp appends to the same hot page and costs far less.
- **Page splits cascade.** When a leaf page fills, the database splits it in half and updates the parent, which can split too. That is one write turning into several.
- **Everything hits the write-ahead log.** Index changes are logged like table changes, so more indexes means more WAL, which means more disk throughput and more replication lag.

What to do about it:

Check whether the index is earning its keep. Run `EXPLAIN ANALYZE` on the query you added it for and confirm the planner actually uses it. Then check `pg_stat_user_indexes` for `idx_scan` — an index with zero scans after a week of real traffic is pure cost, so drop it.

Look for redundancy too. An index on `(a, b)` already serves queries filtering on `a` alone, so a separate index on `a` is dead weight. Teams usually have several of these.

If the index is genuinely needed and the write cost still hurts, narrow it. A partial index (`WHERE status = 'active'`) only indexes the rows you query, so writes to the other rows skip it entirely.

One case where you should not just accept the slowdown: if writes got *dramatically* slower rather than somewhat, check whether you indexed a column your `UPDATE` statements rewrite on every call. Indexing a `last_seen_at` that updates on every request means every request now does a tree delete and insert. That one is worth redesigning around.

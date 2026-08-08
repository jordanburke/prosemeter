---
kind: eval-artifact
run: 2
variant: E
replicate: r2
task: T2
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. You paid the write cost to buy the read benefit. That is the trade, and it is working as designed.

An index is a second copy of your data, sorted. Every insert has to write the row **and** insert a key into the index tree. Every update to an indexed column has to delete the old key and insert a new one. Every delete has to remove the key. So each index you add is extra work on every write that touches it.

It gets worse in specific cases:

- **Random keys**, like UUIDv4, scatter inserts across the whole index. The database dirties a different page each time instead of appending to the end, so you get more I/O and more page splits. Sequential keys like an auto-increment id or UUIDv7 stay at the right edge and stay cheap.
- **Wide indexes**, with many columns, mean more bytes written per row.
- **Bulk loads** suffer most, because the per-row cost multiplies by a large number.

What to do about it:

1. Check the index is earning its keep. Run `EXPLAIN` on the query you added it for and confirm the planner actually uses it. Unused indexes are pure cost.
2. Look at `pg_stat_user_indexes` (or the equivalent) for indexes with zero scans, and drop them.
3. For bulk loads, drop the index, load, then rebuild it. Building in one pass beats inserting a key at a time.
4. If the index exists for one narrow query, make it a partial index with a `WHERE` clause. Fewer rows indexed means less write work.

The rule of thumb: index for the queries you actually run, and count every index as a tax on every write.

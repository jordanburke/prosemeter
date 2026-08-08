---
kind: eval-artifact
run: 1
variant: D
replicate: r1
task: T2
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
"Indexes make things faster" is true but incomplete — it should be "indexes make *reads* faster, and they charge you for it on every write."

Here's the mental model. An index is a whole second data structure sitting next to your table, usually a B-tree, that stores the indexed column(s) sorted with a pointer back to the row. The table itself is basically an unordered pile; the index is the sorted copy that lets the database binary-search instead of scanning the pile.

Now think about what an `INSERT` has to do:

- **Without the index:** append the row wherever there's free space. Cheap, mostly sequential.
- **With the index:** append the row, *and* walk down the B-tree to find the exact leaf page where the new key belongs, *and* write it there. That leaf is chosen by the value of the indexed column, so it's effectively a random spot in the index — a different page for every insert if your keys are random-ish (UUIDs are the worst case here; sequential IDs and timestamps are the friendly case because they all land on the same hot leaf).

Then there's the nastier part. B-tree leaves are fixed-size pages. When the page you need to write into is full, the database **splits** it: allocates a new page, moves half the entries over, updates the parent, and possibly splits the parent too. So most inserts are cheap and then one is dramatically not. That's why the slowdown often looks jittery rather than uniformly worse.

All of this is also durability work. Every one of those index page modifications goes through the write-ahead log too, so an index doesn't just add CPU and a random page touch — it adds bytes to the WAL, which means more fsync pressure and more replication traffic.

Same story for `DELETE` (has to remove the index entry, not just the row) and `UPDATE`. Updates have a specific extra trap in Postgres: normally it can do a "HOT" update where the new row version lives on the same page and the indexes don't need touching at all. But if you index a column that the update *changes*, HOT is off the table and every index on that table has to be updated. So indexing a frequently-updated column is much more expensive than indexing a write-once column.

And it compounds — this is per index, not per table. Five indexes means an insert does one table write plus five B-tree descents. This is the usual reason a table that "just needs one more index" ends up with write latency nobody can explain.

**What to actually do:**

- Confirm the index is earning its keep. In Postgres, `pg_stat_user_indexes` shows `idx_scan` per index — if it's near zero after a representative period, that index is pure cost. Dead indexes accumulate shockingly fast.
- Prefer fewer, wider indexes over many narrow ones. A composite index on `(a, b)` also serves queries filtering on `a` alone, so you often don't need a separate index on `a`.
- If the write path is genuinely hot and the read is a rare report, consider not having the index and eating the scan, or moving the read to a replica.
- For bulk loads, drop the indexes, load, rebuild. Building an index once over sorted data is enormously cheaper than maintaining it row by row.

The framing I'd keep: an index is a cache of an ordering, and like any cache you pay to keep it correct on every write. The question is never "is this index fast" — it's "do the reads it accelerates happen often enough to pay for the writes it slows down."

---
kind: eval-artifact
run: 2
variant: G
replicate: r1
task: T2
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. That's the whole trade, and nobody mentions the second half.

An index is a second copy of your data, sorted a different way. The table holds the rows. The index holds the indexed columns plus a pointer back to each row, kept in sorted order. When you write, the database has to update both. One `INSERT` becomes: write the row, then find the right spot in the index tree and put an entry there. That spot is somewhere else on disk, so you often pay a random write instead of an append.

Every index you add multiplies this. Five indexes means one insert does six writes. Your write throughput drops roughly in proportion.

`UPDATE` is worse than `INSERT` in one specific way. If you change a column that an index covers, the database must delete the old index entry and insert a new one in a different place, because the sort position moved. Update a column no index touches and you skip that work entirely.

Two things make it hurt more than the raw arithmetic suggests:

- **Page splits.** B-tree pages fill up. When a new entry doesn't fit, the page splits in two, which rewrites both pages and touches the parent. Random inserts into the middle of the key range — a UUID index, say — cause this constantly. An index on an increasing key like a timestamp mostly appends to the right edge and splits far less.
- **Write amplification down the stack.** Each index write goes through the write-ahead log too, so the real disk cost is bigger than the index page itself.

So what do you do:

- Drop indexes nothing queries. Check `pg_stat_user_indexes` on Postgres for `idx_scan = 0`. Dead indexes are pure cost.
- Look for redundant ones. An index on `(a, b)` already serves queries that filter on `a` alone, so a separate index on `(a)` is usually wasted.
- On a bulk load, drop the indexes, load, then rebuild. Building an index once over sorted data is far cheaper than maintaining it row by row.

Worth measuring before you rip anything out: how much slower did writes actually get, and does the read you sped up run often enough to pay for it? An index that turns a 2-second query into 5ms is worth a lot of write overhead if that query runs constantly. The same index is a bad deal if the query runs nightly.

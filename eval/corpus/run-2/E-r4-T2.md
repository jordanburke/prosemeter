---
kind: eval-artifact
run: 2
variant: E
replicate: r4
task: T2
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. You got exactly the trade you paid for.

An index is a second copy of your data, sorted. When you insert a row, the database writes the row to the table **and** writes an entry into every index on that table. Five indexes means six writes per insert. Updates are worse: if you change an indexed column, the database removes the old index entry and inserts a new one in a different spot, because the sort order moved.

The cost is not just the extra write. B-tree indexes keep their pages sorted, so an insert lands in the middle of a page rather than at the end. When a page fills, the database splits it into two, which means more I/O and a looser, more scattered index over time.

Random keys make this much worse than sequential ones. Indexing an auto-incrementing id appends to the rightmost page every time, which is cheap. Indexing a UUID v4 scatters inserts across the whole tree, so every insert dirties a different page and split rates climb.

**So the rule is:** add an index when the read it speeds up matters more than the writes it slows down. On a table you query constantly and write rarely, index freely. On a high-throughput ingest table, every index is rent you pay on every row forever.

**What to do now:**

- Check whether the index is earning its keep. In Postgres, `pg_stat_user_indexes` shows `idx_scan` — a count of zero means nothing uses it, so drop it.
- Look for redundant indexes. An index on `(a, b)` already serves queries that filter on `a` alone, so a separate index on `(a)` is dead weight.
- Measure the write cost before you assume it's the problem. "Slower" from one index is usually a few percent. If writes fell off a cliff, look for a lock, a trigger, or a foreign key check first.

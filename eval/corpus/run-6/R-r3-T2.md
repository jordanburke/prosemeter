---
kind: eval-artifact
run: 6
variant: R
replicate: r3
task: T2
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

Indexes speed up reads. They slow down writes. Both are true at once, and nobody told you the second half.

## Why the write got slower

An index is a second copy of one or more columns, kept sorted. Insert a row, and the database writes the row to the table, then writes an entry into every index on that table. Five indexes means six writes.

Updates cost more than they look. Update a column that an index covers, and the database cannot edit the index entry in place. The entry's position depends on its value. So it deletes the old entry and inserts a new one at the new sorted position. Deletes touch every index too.

The arithmetic is simple: one index, one extra write per row change. That is the part everyone forgets.

## The part that is more than "more writes"

Four mechanisms make the slowdown bigger than the count implies.

**Page splits.** B-tree indexes store entries in fixed-size pages. When a page fills and a new entry belongs in the middle, the database splits the page in two and rewrites both. Index a random value — a UUID, an email address — and inserts land all over the tree, so splits happen constantly. Index an always-increasing value like an auto-increment id, and new entries land at the right edge, where splits are cheap. This is why a UUID primary key can cost five times what a sequential one costs at the same insert rate.

**Random I/O.** The table rows you insert are sequential. The index pages you must update are scattered. If the index does not fit in memory, each insert turns into a disk seek. An index that fits in RAM and one that does not differ by a factor of hundreds, not by percentages.

**Locking.** Concurrent writers touching the same index pages contend on them. On a hot index over a timestamp, every insert goes to the same right-edge page, so all your writers queue on one page. That shows up as latency rising with load, not with data size.

**Write amplification in the log.** The index change also goes to the write-ahead log, so it hits durable storage twice.

## Whether the trade is worth it

It normally is. A query that scans 10 million rows and one that seeks an index differ by a factor of thousands. Adding a millisecond to writes to remove a second from reads is a good deal for any application that reads more than it writes, which covers nearly all of them.

It stops being a good deal when:

- The index goes unused. Check first — every database reports index usage, and an unused index is pure cost. Use `pg_stat_user_indexes` in Postgres, `sys.dm_db_index_usage_stats` in SQL Server.
- The index duplicates another. An index on `(a)` is redundant when you already have `(a, b)`, because the composite serves prefix lookups. Drop the narrower one.
- The table is write-heavy and the read it serves runs once a night — a report, an admin screen.
- You added six at once. Six indexes for six queries is three indexes reorganized.

## What to do now

Measure before you decide. Find out how much slower, on which operation, and whether the query you added the index for got faster.

```sql
EXPLAIN (ANALYZE, BUFFERS) INSERT ...;
EXPLAIN (ANALYZE, BUFFERS) SELECT ...;   -- the query you added it for
```

Then pick:

- **The read win is real and the write cost is tolerable** — keep it. This is the common outcome.
- **The index covers a random value on a table of 100 million rows** — look at whether the lookup can go on a sequential column, or whether the table wants a different physical layout.
- **The write path is latency-critical** (checkout, ingestion) — move the read to a replica and index there, not on the primary.
- **A bulk load has to pass through the index** — drop it before the load and rebuild after. Building once costs far less than maintaining it row by row.

## The rule to carry forward

Indexes are neither free nor automatic. Each one is a bet that the reads it accelerates outweigh the writes it taxes. Add them one at a time, for a query you have measured. Check afterwards that the query got faster and that the writes stayed inside what you can live with.

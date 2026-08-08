---
kind: eval-artifact
run: 5
variant: A
replicate: r3
task: T2
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. Both are true at once, and nobody mentioned the second half.

## Why the write got slower

An index is a second copy of some of your data, kept sorted. When you insert a row, the database writes the row to the table and then writes an entry into every index on that table. Five indexes means six writes, not one.

Updates are worse than they look. If you update a column that an index covers, the database cannot edit the index entry in place, because the entry's position depends on its value. It deletes the old entry and inserts a new one at the new sorted position. Deletes also touch every index.

So the cost is roughly: one index, one extra write per row change. That is the part everyone forgets.

## The part that is not just "more writes"

Three things make the slowdown bigger than the count suggests.

**Page splits.** B-tree indexes store entries in fixed-size pages. When a page fills and a new entry belongs in the middle, the database splits the page in two and rewrites both. On an index over a random-ish value — a UUID, an email address — inserts land all over the tree, so splits happen constantly. On an index over an always-increasing value like an auto-increment id, new entries land at the right edge and splits are cheap. This is why a UUID primary key can cost several times what a sequential one costs on the same insert rate.

**Random I/O.** The table rows you are inserting are sequential. The index pages you have to update are scattered. If the index does not fit in memory, each insert turns into a disk seek. An index that fits in RAM and one that does not differ by orders of magnitude, not percentages.

**Locking.** Concurrent writers touching the same index pages contend on them. On a hot index over a timestamp — where every insert goes to the same right-edge page — you get all your writers queueing on one page. That shows up as latency that gets worse with load, not with data size.

**Write amplification in the log.** The index change is also written to the write-ahead log, so it hits durable storage twice.

## Whether the trade is worth it

It usually is. A query that scans 10 million rows and one that seeks an index differ by a factor of thousands. Adding a millisecond to writes to remove a second from reads is a good deal in almost every application, because most applications read far more than they write.

It stops being a good deal when:

- The index is not used. Check first — every database can tell you index usage, and unused indexes are pure cost. `pg_stat_user_indexes` in Postgres, `sys.dm_db_index_usage_stats` in SQL Server.
- The index duplicates another. An index on `(a)` is redundant if you already have `(a, b)`, because the composite serves prefix lookups too. Drop the narrower one.
- The table is write-heavy and the read it serves is rare — a nightly report, an admin screen.
- You added several at once. Six indexes for six queries is often three indexes reorganized.

## What to do now

Measure before you decide. Find out how much slower, on what operation, and whether the query you added it for actually got faster.

```sql
EXPLAIN (ANALYZE, BUFFERS) INSERT ...;
EXPLAIN (ANALYZE, BUFFERS) SELECT ...;   -- the query you added it for
```

Then pick:

- **The read win is real and the write cost is tolerable** — keep it. This is the common outcome.
- **The index is on a random value and the table is huge** — consider whether the lookup could go on a sequential column instead, or whether the table wants a different physical layout.
- **The write path is latency-critical** (checkout, ingestion) — move the read to a replica and index there, not on the primary.
- **The index serves batch loading badly** — drop it before a bulk load and rebuild after. Building once is far cheaper than maintaining it row by row.

## The rule to carry forward

Indexes are not free and they are not automatic. Each one is a bet that the reads it accelerates outweigh the writes it taxes. Add them one at a time, for a query you have measured, and check afterwards that the query got faster and the writes did not get worse than you can live with.

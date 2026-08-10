---
kind: eval-artifact
run: 6
variant: P
replicate: r3
task: T2
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

Indexes speed up reads and slow down writes. Both halves are true. Nobody told you the second one.

## Why the write got slower

An index is a second copy of some of your data, kept sorted. When you insert a row, the database writes the row to the table, then writes an entry into every index on that table. Five indexes mean six writes, not one.

Updates cost more than they look. If you update a column an index covers, the database cannot edit the entry in place, because the entry's position depends on its value. It deletes the old entry and inserts a new one where the new value sorts. Deletes touch every index too.

So the rough rule is: one index, one extra write per row change.

## The part that is not just "more writes"

Four things make the slowdown bigger than the count suggests.

**Page splits.** B-tree indexes store entries in fixed-size pages. When a page fills and a new entry belongs in the middle, the database splits the page in two and rewrites both. Index a random-ish value — a UUID, an email address — and inserts land all over the tree, so splits happen constantly. Index an always-increasing value like an auto-increment id, and new entries land at the right edge where splits are cheap. That is why a UUID primary key can cost several times what a sequential one costs at the same insert rate.

**Random I/O.** The table rows you insert are sequential. The index pages you must update are scattered. If the index does not fit in memory, each insert becomes a disk seek. An index that fits in RAM and one that does not differ by orders of magnitude, not percentages.

**Locking.** Concurrent writers touching the same index pages contend on them. On a hot index over a timestamp, every insert goes to the same right-edge page, so all your writers queue on it. That shows up as latency rising with load, not with data size.

**Log amplification.** The index change also goes to the write-ahead log, so it hits durable storage twice.

## Whether the trade is worth it

Usually yes. A query that scans 10 million rows and one that seeks an index differ by a factor of thousands. Adding a millisecond to writes to remove a second from reads is a good deal in almost every application, because most applications read far more than they write.

It stops being a good deal when:

- **The index is not used.** Check first. Every database reports index usage — `pg_stat_user_indexes` in Postgres, `sys.dm_db_index_usage_stats` in SQL Server. An unused index is pure cost.
- **The index duplicates another.** An index on `(a)` is redundant if you already have `(a, b)`, because the composite serves prefix lookups too. Drop the narrower one.
- **The table is write-heavy and the read it serves is rare** — a nightly report, an admin screen.
- **You added several at once.** Six indexes for six queries is often three indexes reorganized.

## What to do now

Measure before you decide. Find out how much slower, on which operation, and whether the query you added it for actually got faster.

```sql
EXPLAIN (ANALYZE, BUFFERS) INSERT ...;
EXPLAIN (ANALYZE, BUFFERS) SELECT ...;   -- the query you added it for
```

Then pick:

- **The read win is real and the write cost is tolerable** — keep it. This is the common outcome.
- **The index is on a random value and the table is huge** — ask whether the lookup could go on a sequential column instead, or whether the table wants a different physical layout.
- **The write path is latency-critical** (checkout, ingestion) — move the read to a replica and index there, not on the primary.
- **A bulk load is the slow part** — drop the index before the load and rebuild after. Building once is far cheaper than maintaining it row by row.

## The rule to carry forward

Indexes are neither free nor automatic. Each one is a bet that the reads it speeds up outweigh the writes it taxes. Add them one at a time, for a query you have measured, then check that the query got faster and the writes did not get worse than you can live with.

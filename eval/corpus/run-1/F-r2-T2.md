---
kind: eval-artifact
run: 1
variant: F
replicate: r2
task: T2
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. You just paid the write cost. Both things are true at once.

**Why**

An index is a second copy of your data, sorted. The table holds the rows. The index holds the indexed columns plus a pointer back to each row, kept in sorted order.

So every write now does more work:

- **INSERT** writes the row, then walks the index tree and inserts the key in the right sorted spot.
- **UPDATE** on an indexed column writes the row, deletes the old index entry, and inserts a new one at a different position.
- **DELETE** removes the row and removes the index entry.

Add a second index and every write does that twice. Five indexes, five times.

**The part that actually hurts**

Two extra costs make it worse than "one more write."

**Page splits.** Indexes store keys in fixed-size pages. When you insert into a full page, the database splits it into two half-full pages and updates the parent. That's several page writes for one row. Random keys — UUIDv4, hashes — scatter inserts across the whole tree and split pages constantly. Sequential keys append to the end and mostly avoid it.

**Write amplification.** Each of those page writes hits the write-ahead log too, so it gets durably written twice. Your one-row insert can become a dozen physical writes.

**What to do**

Measure first, then decide:

- **Confirm the index is used.** Run `EXPLAIN ANALYZE` on the query you added it for. An unused index is pure cost — drop it. Check `pg_stat_user_indexes.idx_scan` in Postgres for indexes nobody reads.
- **Look for redundant indexes.** An index on `(a, b)` already serves queries filtering on `a` alone. A separate index on `(a)` is dead weight.
- **Check your key order.** If you indexed a random UUID, consider UUIDv7 or a sequential key. Ordered inserts cut page splits sharply.
- **Batch your writes.** Amortizing index maintenance over a bulk insert beats paying it per row.
- **Drop indexes during bulk loads,** then rebuild after. Building once is far cheaper than maintaining through a million inserts.

**The tradeoff to hold onto**

The rule isn't "indexes make things faster." It's "indexes trade write throughput and disk for read speed." Take the trade when reads dominate — most OLTP tables. Refuse it on write-heavy tables like event logs and metrics, where you should index only what you truly query.

---
kind: eval-artifact
run: 3
variant: B
replicate: r2
task: T2
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes make *reads* faster. They make writes slower. That's the trade, and it's not a bug in what you did.

Here's the mechanism. An index is a second copy of some of your data, kept sorted. When you query, the database can jump straight to the rows it needs instead of scanning the whole table — big win. But that sorted copy has to stay correct. So every `INSERT` now writes the row *and* inserts an entry into the index at the right sorted position. Every `DELETE` removes both. Every `UPDATE` that touches an indexed column has to move the entry from its old position to its new one.

Add five indexes to a table and a single insert becomes six writes. That's the slowdown you're seeing.

A few things make it worse than the raw arithmetic suggests:

- **Page splits.** Indexes are stored in fixed-size pages. When you insert into a full page, the database has to split it in two and rewrite parent pointers. Random inserts into the middle of an index cause this a lot. Sequential inserts at the end (like an auto-increment ID) mostly don't — which is why an index on a timestamp or ID column is cheaper to write than one on, say, a random UUID or an email address.
- **Extra disk I/O.** The table rows might be in cache; the index pages might not be. You can pay a disk seek per index.
- **Bigger write-ahead log.** More changed pages means more to journal, which means more to flush and more to replicate.

**So what do you do?**

Keep the index if the reads it speeds up matter more than the writes it slows down. That's usually true — most tables are read far more than written. Measure both sides before deciding.

Then audit what's already there. In my experience the real problem is rarely the one index someone just added, it's the six that accumulated over two years, three of which are redundant. Two things to look for:

- **Unused indexes.** Postgres tracks this in `pg_stat_user_indexes` — `idx_scan = 0` means nothing has ever used it. Pure write tax, drop it.
- **Redundant prefixes.** An index on `(a)` is already covered by an index on `(a, b)`. The database can use the leading columns of a composite index on its own, so the standalone one is dead weight.

The exception to all of this is a write-heavy table — an events log, an audit trail, a queue. There, indexes hurt in a way that's hard to claw back, and you want the bare minimum. If that's what this table is, it's worth saying so, because the calculus changes.

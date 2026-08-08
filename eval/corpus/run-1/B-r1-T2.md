---
kind: eval-artifact
run: 1
variant: B
replicate: r1
task: T2
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes make **reads** faster. They make **writes** slower, and that's expected, not a bug.

An index is a second copy of some of your data, kept sorted. The table itself doesn't know about it — the database maintains it separately. So every write has to do extra work:

- **INSERT** — write the row, then also insert an entry into every index on that table, in the right sorted position.
- **DELETE** — remove the row, then remove it from every index.
- **UPDATE** — if you changed a column that's indexed, that's a delete plus an insert in that index. (Updating only non-indexed columns is cheap.)

Five indexes on a table means an insert is roughly six write operations, not one. Add write-ahead logging for each and the cost is real.

There's a second effect that surprises people more: **inserting into the middle of an index is worse than appending to the end.** An index on `created_at` gets new rows at the far right — cheap, mostly sequential. An index on something random like a UUID or an email scatters writes across the whole structure, causing page splits and random I/O. Same index count, very different cost.

So the tradeoff is: you traded write throughput for read speed. Usually that's a good trade — most tables are read far more than written. The question is whether *this* index earns it.

Worth checking:

- **Is it actually being used?** Postgres tracks this in `pg_stat_user_indexes` (`idx_scan` = 0 means nothing has touched it). Unused indexes are pure cost.
- **Is it redundant?** An index on `(a, b)` already covers queries that filter on `a` alone. A separate index on `(a)` buys you nothing and costs you writes.
- **How hot is the write path?** On an append-only log table taking thousands of inserts a second, one extra index matters a lot. On a settings table, nobody will ever notice.

If the read it speeds up is on a critical path and the write slowdown is tolerable, keep it. If you added it speculatively, drop it and measure again.

---
kind: eval-artifact
run: 4
variant: E
replicate: r2
task: T2
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. You paid the write cost to buy the read benefit.

An index is a second copy of some of your data, kept sorted. Every insert has to add a row to the table **and** an entry to the index. Every update to an indexed column has to move that entry to its new sorted position. Every delete has to clean both up. So a table with four indexes does roughly five writes per insert, not one.

There is a second cost people miss. Keeping the index sorted means splitting pages when they fill, and those splits are random I/O rather than the cheap append the table itself gets. Write-heavy tables feel this more than the raw multiplication suggests.

The rule is: index the columns you filter and join on, and nothing else. Ask two things about the index you added.

- **Does a query actually use it?** Check `pg_stat_user_indexes` for `idx_scan`. If it is zero after a week of real traffic, drop it — you are paying writes for nothing.
- **Is it redundant?** An index on `(a)` is already covered by an index on `(a, b)`. Drop the narrower one.

So the advice you got was not wrong, just incomplete. Indexes are a trade, and on a write-heavy table the trade can go against you.

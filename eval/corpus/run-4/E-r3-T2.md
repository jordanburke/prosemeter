---
kind: eval-artifact
run: 4
variant: E
replicate: r3
task: T2
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. You've just met the second half of that trade.

An index is a second data structure holding a copy of the indexed column plus a pointer back to the row. Every insert writes the table **and** every index on it. Every update to an indexed column does it twice more — remove the old entry, add the new one. All of that goes through the WAL as well, so the disk cost multiplies.

B-trees add more on top. New entries have to land in sorted position, so a full page splits, and that costs extra I/O and leaves the index bloated over time. Random keys like UUIDv4 make this much worse than sequential ones, because they scatter writes across the whole index instead of appending to the end.

There's a smaller effect worth knowing: an index on a column you update can also block Postgres from doing a HOT update, which would otherwise skip index maintenance entirely.

So the question isn't "are indexes fast" — it's whether this index earns its cost. Check `idx_scan` for it in `pg_stat_user_indexes` after a day of real traffic. If it's near zero, drop it. You're paying the write penalty and getting nothing back.

---
kind: eval-artifact
run: sonnet
variant: A
replicate: r1
task: T2
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads, but every write has to update the index too — not just the table row. More indexes means more work per write, so this is expected, not a sign something's broken.

What happens under the hood:
- **Insert**: the DB writes the row, then adds an entry to each index's B-tree, in sorted order.
- **Update**: if you touch an indexed column, the old index entry gets removed and a new one added — effectively two writes instead of one.
- **Delete**: index entries need cleanup too, either immediately or later via vacuum.

The index itself is a sorted structure, so inserting into the middle of it can trigger page splits — especially bad if the indexed column isn't roughly increasing over time. Random-order values like UUIDs scatter writes across the whole tree and cause much more churn than a sequential ID would.

So the trade-off is real: you're paying write cost to buy read speed. That's why you index columns you actually filter, sort, or join on — not every column, and not "just in case."

Worth checking:
- Is the new index actually used? `pg_stat_user_indexes` (or the equivalent in your DB) shows index usage — drop anything with near-zero scans.
- If the indexed column is a UUID or otherwise random, consider whether a sequential ID or UUIDv7 would reduce the write amplification.

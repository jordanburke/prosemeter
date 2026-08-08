---
kind: eval-artifact
run: 2
variant: E
replicate: r1
task: T2
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. You added a second data structure, and the database now has to keep it in sync on every change.

Think about what an insert does now. Before the index, the database appended a row to the table and moved on. After the index, it appends the row **and** walks the index tree to find the right slot **and** writes the new entry there. If that slot is full, the page splits, which means more writes and more locks. Every update to the indexed column does the same work twice, once to remove the old entry and once to add the new one.

The cost scales with how many indexes you have. Five indexes on a table means five extra structures to maintain per write.

A few things make it worse:

- **Random insert order.** An index on a UUID scatters writes across the whole tree, so pages split constantly. An index on an auto-increment id appends to one end and stays cheap.
- **Wide indexes.** More columns means bigger entries, fewer per page, more pages touched.
- **Hot updates.** A column that changes on every row update pays the index cost every time.

So the tradeoff is real and it is the point. You buy fast lookups with slower writes.

What to do:

1. **Check the index earns its keep.** Run `EXPLAIN` on the query you added it for and confirm the planner uses it.
2. **Drop indexes nothing queries.** Postgres tracks this in `pg_stat_user_indexes`; a `idx_scan` of zero means dead weight.
3. **Index the column you filter on, not every column.** One well-chosen composite index usually beats three single-column ones.

If writes are your bottleneck and reads are not, fewer indexes is the right answer.

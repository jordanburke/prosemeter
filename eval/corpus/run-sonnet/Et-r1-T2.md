---
kind: eval-artifact
run: sonnet
variant: Et
replicate: r1
task: T2
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes — both are true at once. An index is its own data structure (usually a B-tree) sitting next to the table. Every insert, update, or delete has to update the table *and* update the index to keep it sorted, so writes now do more work.

A few specifics worth knowing:

- **Page splits**: as the index B-tree fills up, inserting a new key can force it to split a page and rebalance, which costs more than a plain append.
- **Every extra index multiplies this**: five indexes means five structures to update on every write, not one.
- **Updates hurt more than you'd think**: if you update a column that's indexed, the database has to remove the old index entry and insert a new one, not just edit in place.

None of this means indexes are bad. It means they're a trade, not a free win. The fix isn't "no indexes" — it's "index what you actually query on." Add indexes for the columns your `WHERE`, `JOIN`, and `ORDER BY` clauses use often, and skip the rest. If a table is write-heavy and rarely queried by a given column, that column probably shouldn't be indexed.

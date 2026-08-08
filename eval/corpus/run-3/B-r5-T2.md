---
kind: eval-artifact
run: 3
variant: B
replicate: r5
task: T2
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes make *reads* faster. They make *writes* slower. Both are true at the same time, and it's the same reason.

An index is a second copy of some of your data, kept sorted. That sorted copy is what lets a query jump straight to the rows it wants instead of scanning the whole table. But the database has to keep that copy correct. So every insert, update, and delete now does extra work:

- **Insert**: write the row, then also write an entry into every index on the table, in the right sorted position.
- **Delete**: remove the row, then remove it from every index.
- **Update**: if you changed a column that an index covers, the index entry has to move — often a delete plus an insert internally.

So a table with five indexes does roughly six writes per insert, not one. You paid for your faster query with slower writes. That's the trade, and it's not a bug.

A couple of things make it worse than the basic math suggests:

- **Random insert order.** If the indexed column is something like a UUID or an email, new entries land all over the sorted structure, which means touching many different pages instead of appending to the end. An index on an auto-incrementing ID or a timestamp is much cheaper to maintain because new entries always go at the tail.
- **Wide indexes.** Indexing a long text column, or a multi-column index, means more bytes written every time.

What I'd actually do: check whether that index is earning its keep. Run the query it was meant to help and look at the plan (`EXPLAIN ANALYZE` in Postgres) to confirm it's being used, and confirm the win is real. If the query got 50x faster and writes got 10% slower, keep it. If it shaved 5% off a query that runs twice a day and slowed down a write path that runs constantly, drop it.

Also worth checking: whether you already had an index that covers this. If you have one on `(a)` and add one on `(a, b)`, the second usually makes the first redundant — you're paying to maintain both and only using one.

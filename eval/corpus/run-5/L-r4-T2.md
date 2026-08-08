---
kind: eval-artifact
run: 5
variant: L
replicate: r4
task: T2
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
An index speeds up reads and slows down writes. Both are true. You paid for faster reads with slower writes.

An index is a second copy of some of your data, sorted. The database keeps it in step with the table. So every insert writes two places: the row into the table, and a matching entry into the index. Every delete removes two. Every update that touches an indexed column removes the old index entry and adds a new one.

The index entry is not appended at the end, either. It goes into sorted position inside a B-tree. That means the database reads the tree, finds the right page, and writes it back. If that page is full, it splits into two — more writes, and now the tree is deeper.

Three things make the cost worse.

**Count.** Each index multiplies the work. Five indexes on a table means six writes per insert, not two.

**Width.** An index on a wide column, or on four columns, stores more bytes per entry. More bytes means more pages and more page splits.

**Randomness.** Inserting sequential values, like an auto-increment id, always lands at the right edge of the tree, and that page stays hot in memory. Inserting random values, like a UUID v4, lands anywhere, so the database keeps pulling cold pages off disk. This is the one that surprises people most.

Measure before you decide. Check whether a query actually uses the index — run `EXPLAIN` on it. An index nothing reads is pure cost, and unused indexes accumulate fast.

Then weigh the ratio. On a table read a thousand times per write, an extra index is nearly free. On a high-volume event log written constantly and queried once a day, it is not.

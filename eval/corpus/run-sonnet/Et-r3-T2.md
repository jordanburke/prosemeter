---
kind: eval-artifact
run: sonnet
variant: Et
replicate: r3
task: T2
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. That's the trade, not a myth someone told you wrong.

Here's why: an index is a second copy of your data, sorted for fast lookup. Every time you write a row, the database must update the table *and* update the index to match. One write becomes two (or more, if you have several indexes). That's the extra cost you're seeing.

Reads win because the database can jump straight to a row instead of scanning the whole table. Writes lose because they now touch extra structures on every insert, update, or delete.

So indexes aren't free — they're a bet that you'll read a column far more often than you write it. A few rules of thumb:

- **Index columns you filter, sort, or join on often.** Not every column.
- **Watch your index count.** Five indexes on a hot write table can double or triple write cost.
- **Drop unused indexes.** They still cost you on every write even if no query reads them.

If writes matter more than reads for this table, the new index may be the wrong trade — not a bug, a design choice worth reconsidering.

---
kind: eval-artifact
run: sonnet
variant: E
replicate: r1
task: T2
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes — both are true at once, and you just hit the second half.

Here's why. A table index is a separate data structure, sorted by the column you indexed. It exists purely so reads can skip straight to the row they want instead of scanning the whole table. But every time you insert, update, or delete a row, the database must also update that separate structure to keep it correct. One write to the table becomes a write to the table plus a write to each index on it.

So the more indexes a table has, the more work each write does. A table with five indexes pays that cost five times over on every insert.

This is a real tradeoff, not a bug. Ask two questions before adding an index:

- **Do queries actually filter or sort on this column often?** If not, skip the index.
- **Is this table write-heavy or read-heavy?** A logging table that gets hammered with inserts and rarely queried wants few indexes. A lookup table that's read constantly and rarely written wants more.

Match the index to the access pattern, and you get the speedup without paying more than you need to.

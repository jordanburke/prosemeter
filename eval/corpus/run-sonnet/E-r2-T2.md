---
kind: eval-artifact
run: sonnet
variant: E
replicate: r2
task: T2
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
An index speeds up reads and slows down writes. That's the trade, not a bug.

Here's why: every `INSERT`, `UPDATE`, or `DELETE` on that table now has to update the table row and update the index structure (usually a B-tree) to match. Add more indexes and each write does more work. A table with five indexes pays that cost five times on every insert.

Reads get faster because the database can jump straight to matching rows instead of scanning the whole table. Writes get slower because the database now maintains extra structures on top of the raw data.

**What to do about it:**

- Check whether you actually need the index. Index columns you filter, join, or sort on often — not columns you rarely query.
- Drop indexes you added "just in case." Each one taxes every write.
- On write-heavy tables, weigh the read speedup against the write cost. If the table gets hammered with writes and rarely read with that filter, the index may not be worth it.
- For bulk loads, some teams drop indexes before the load and rebuild them after, because rebuilding once is cheaper than updating on every row.

So: indexes make matching reads faster, and every index makes every write a little slower. Pick indexes based on your actual read/write pattern, not by reflex.

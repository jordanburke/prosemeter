---
kind: eval-artifact
run: sonnet
variant: E
replicate: r3
task: T2
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes, so both things you heard are true — they just apply to different operations.

An index is its own data structure, usually a B-tree, that sits next to your table. When you write a row, the database doesn't just write the row — it also updates every index on that table to keep it in sync. Add an index, and each write now does two jobs instead of one: write the row, then update the index's B-tree. If the new value lands in the middle of the tree, the database may also need to split a page to make room, which costs more I/O.

More indexes means more of this work per write. A table with five indexes pays that cost five times over on every insert or update.

So the trade-off is real, not a myth: indexes buy faster lookups by spending extra work on every write. The fix isn't to avoid indexes — it's to be deliberate about them. Index the columns you actually filter, join, or sort on. Drop indexes nobody queries against. And on write-heavy tables, check whether an index is pulling its weight before you add another one.

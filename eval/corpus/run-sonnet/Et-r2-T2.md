---
kind: eval-artifact
run: sonnet
variant: Et
replicate: r2
task: T2
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes trade write speed for read speed. Nobody lied to you — they just told you half the story.

A table with no index is a plain list. A write just appends a row. Add an index and the database now keeps a second structure (usually a B-tree) sorted by the indexed column. Every insert, update, or delete has to also update that structure, so each write now does more work. Add five indexes and each write updates five extra structures.

Reads get faster because the database can jump straight to the matching rows instead of scanning the whole table. Writes get slower because they pay the cost of keeping that shortcut up to date.

A few things worth checking:

- **Are you indexing a column you rarely filter or sort on?** If so, drop it — you're paying the write cost for a read benefit you don't use.
- **Is this a high-write table** (logs, events, queues)? Indexes hurt more there, so index sparingly.
- **Do you have redundant indexes?** An index on `(a, b)` already covers queries that filter on `a` alone — a separate index on just `a` is dead weight.

The rule of thumb: index the columns your queries actually filter, join, or sort on, and nothing else.

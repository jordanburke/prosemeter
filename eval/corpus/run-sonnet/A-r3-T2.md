---
kind: eval-artifact
run: sonnet
variant: A
replicate: r3
task: T2
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes — that's the trade, not a myth someone told you wrong.

An index is a separate data structure (usually a B-tree) that the database keeps in sync with the table. Every `INSERT`, `UPDATE`, or `DELETE` has to update the table *and* update every index on it. More indexes means more structures to touch on every write. That's extra disk I/O, extra WAL (write-ahead log) records, and on some engines, extra locking.

So the read got faster because the database can jump straight to the rows instead of scanning the table. The write got slower because it now maintains that shortcut on every change.

A few things worth checking:

- **Do you actually query on that column?** An index that isn't used by any query is pure write overhead with no upside. Drop it.
- **How many indexes does the table have total?** Five or six indexes on a write-heavy table adds up fast, even if each one looks cheap alone.
- **Is it a composite index doing more than it needs to?** Wide indexes cost more to maintain than narrow ones.
- **Are you batching writes?** Bulk inserts amortize index maintenance better than the same rows inserted one at a time.

The rule of thumb: index columns you filter, join, or sort on frequently; leave the rest alone. Every index is a bet that read speed matters more than write speed for that column — sometimes it doesn't.

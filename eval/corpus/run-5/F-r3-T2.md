---
kind: eval-artifact
run: 5
variant: F
replicate: r3
task: T2
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
## Why did adding an index make writes slower?

An index speeds up reads by keeping a second, sorted copy of one column, and the database has to update that copy on every write. Indexes make reads faster and writes slower. Both are true at once. You were told half of it.

Picture the table as an unsorted pile of rows. Finding every row where `email = 'x@y.com'` means reading the whole pile. An index on `email` is a separate structure holding every email value in sorted order, each paired with a pointer to its row. Sorted order means the database can jump straight to the value instead of scanning, the way you find a word in a dictionary without reading every page.

That second structure is real data on disk. It does not update itself. Every `INSERT` writes the row and then writes an entry into the index, in the right sorted position. Every `DELETE` removes both. Every `UPDATE` to an indexed column removes the old index entry and inserts a new one — the row moved in sorted order, so its place in the index changed.

So each index you add is extra work on every write that touches it. One index roughly means the write does one extra thing. Five indexes mean five.

## Why is the slowdown bigger than "one extra write"?

Three effects stack on top of the plain extra write.

**The index write lands in a random place.** Appending a row is cheap, because it goes at the end. An index entry goes wherever sorted order puts it, which for something like an email or a UUID is somewhere in the middle. The database reads that part of the index into memory, changes it, and writes it back.

**Full pages split.** The index is stored as fixed-size pages. When a page has no room for a new entry, the database splits it into two half-full pages and updates the parent that points to them. Most inserts do not trigger a split. The ones that do cost several times a normal insert.

**Every change is written twice.** Databases write changes to a log first, then to the data files, so a crash mid-write cannot corrupt anything. Index changes go through that same log, so they add to the volume of log the database has to flush and sync to disk.

## Was adding the index a mistake?

Not by itself — it is a trade you should make on purpose.

Keep it if it earns its keep. An index that turns a full-table scan into a direct lookup can cut a query from seconds to milliseconds, and a slightly slower insert is a fair price. Check the actual gain rather than assuming: run your query with `EXPLAIN ANALYZE`, which makes the database report the plan it chose and the time it took. Compare the plan with the index against the plan without.

Drop it if it does not. Three cases are common:

- **Nothing uses it.** Someone added an index for a query that changed or never shipped. Postgres and MySQL both track how many times each index has been read; an index with a read count near zero and a write cost on every insert is pure loss.
- **It duplicates another index.** An index on `(user_id, created_at)` already serves lookups on `user_id` alone, because the leading column is sorted first. A separate index on `user_id` adds write cost and no read benefit.
- **The table is small.** Scanning a few thousand rows is fast enough that the planner may ignore the index anyway, while you still pay to maintain it.

Two more things worth knowing. Bulk loads go much faster if you drop the indexes, load, and rebuild them, because building an index once over sorted data beats maintaining it row by row. And if your writes got slower than the extra index work explains, look at lock contention and at whether the index still fits in memory — an index too large for the cache turns every write into a disk read first.

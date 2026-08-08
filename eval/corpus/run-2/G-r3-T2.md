---
kind: eval-artifact
run: 2
variant: G
replicate: r3
task: T2
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. That trade is the whole deal, and nobody mentions the second half.

An index is a second copy of your data, sorted. The table holds the rows. The index holds the indexed columns plus a pointer back to each row, kept in sorted order in a B-tree. Every write now has to touch both.

**What each write costs you now:**

- **INSERT** writes the row, then walks the B-tree to find the right slot and adds an entry there. If that page is full, the database splits the page, which means more writes and sometimes a cascade up the tree.
- **UPDATE** costs nothing extra if you did not touch an indexed column. If you did, the database deletes the old index entry and inserts a new one in a different spot.
- **DELETE** removes the row and marks the index entry dead. Cleanup comes later, on its own schedule.

Add a second index and you pay all of that twice. Ten indexes, ten times.

There is a second cost that surprises people more than the writes. The write-ahead log grows, because index changes are logged too. So your disk I/O, your replication lag, and your backup size all go up.

**Where the pain gets worst:** an index on a random-valued column, like a UUID v4. Every insert lands in a different part of the tree, so no page stays hot in memory and you get a random disk write each time. An index on a column that climbs, like a timestamp or an auto-increment id, appends to the same end page and stays cheap.

**What to do:**

Keep the index if the reads it serves matter more than the writes it taxes. That is usually true, which is why the advice you heard is mostly right.

Drop it if you added it for a query that runs once a day on a table that takes a thousand writes a second.

Before you add another one, check whether an existing index already covers the query. A B-tree on `(a, b)` already serves lookups on `a` alone, so a separate index on `a` buys you nothing and costs you every write.

Then look for indexes nobody uses. Postgres tracks this in `pg_stat_user_indexes`, and the ones with an `idx_scan` of zero are pure cost.

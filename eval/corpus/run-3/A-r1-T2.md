---
kind: eval-artifact
run: 3
variant: A
replicate: r1
task: T2
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Both things are true — indexes make *reads* faster and *writes* slower. The advice you got just left off the second half.

An index is a second copy of some of your data, kept sorted. A B-tree on `users(email)` is a separate structure holding every email address plus a pointer back to the row. The database maintains it for you, which means every write to the table is also a write to the index:

- **INSERT** — the row goes in the table, and an entry goes into every index on that table. Each one has to find its sorted position and put the entry there.
- **DELETE** — same thing in reverse, once per index.
- **UPDATE** — this is the sneaky one. Updating a column touches only the indexes that cover that column... in theory. Depending on the engine and whether the row moves, it can end up touching all of them.

So a table with six indexes doesn't do one write per insert, it does seven. That's the whole story at the simple level, and it's linear: each index you add costs you roughly a fixed increment on every write.

The part that surprises people is that it isn't only *more* work, it's *worse-shaped* work. Appending a row to a table is roughly sequential. Inserting into a sorted B-tree is a random write to wherever that key sorts — and if you're indexing something like a UUID or an email, consecutive inserts land in completely unrelated pages. Those pages have to be read in, modified, and written back. On a table big enough that the index doesn't fit in memory, that's real disk I/O per insert, and it's the actual reason the slowdown is often much larger than "one extra write."

Two more effects that show up on hot tables:

- **Page splits.** When the page an entry belongs in is full, the engine splits it in two. That's expensive, it fragments the index, and it makes the index bigger than it needs to be — which makes the memory problem worse.
- **Lock and WAL pressure.** Index maintenance happens inside your transaction, and it goes into the write-ahead log too. More indexes means longer transactions, more log volume, and more contention if the table is under concurrent write load.

What to do about it:

**Check the index is actually being used.** Run your read query with `EXPLAIN` and confirm the planner picks it. Plenty of indexes get added, never used by the planner, and cost writes forever. In Postgres, `pg_stat_user_indexes.idx_scan` tells you how many times each index has been read — anything sitting at zero after a week of production traffic is pure cost.

**Check you don't already have it.** An index on `(a, b)` already serves queries on `a` alone. A separate index on `(a)` is redundant and you can drop it. This is the single most common source of surprise write cost.

**Look at what you indexed.** If you indexed a random-ish column on a large, write-heavy table, that's the expensive case. If the same query can be served by an index on something more sequential — a timestamp, a monotonic id — you get most of the read benefit at a fraction of the write cost.

**Decide whether the trade is worth it.** That's the real question and it's an empirical one: how much did the read improve, how much did the write regress, and what's your actual ratio of reads to writes on that table? An index that turns a 2-second query into 5ms is worth a lot of write overhead on a table read a thousand times per write. The same index on an append-heavy audit log probably isn't.

The framing I'd hold onto: an index isn't free storage of an optimization, it's a standing subscription. You pay on every write, forever, and you should be able to name the query that's paying you back.

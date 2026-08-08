---
kind: eval-artifact
run: 2
variant: G
replicate: r5
task: T2
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. You added a read optimization, and you paid for it on the write side. That is the deal, not a bug.

Here is why. An index is a second copy of some of your data, sorted. When you insert a row, the database writes the row to the table, then walks down the index tree and writes an entry there too. Every extra index means another tree to walk and another page to dirty. Updates are worse: if you change an indexed column, the database has to delete the old index entry and insert a new one in a different spot. Deletes have to clean up every index as well.

Three things make it hurt more than you would guess:

- **Page splits.** The index keeps entries in sorted order in fixed-size pages. When a page fills up and a new key lands in the middle, the database splits that page in two. That is extra I/O, and it leaves the index looser and bigger over time.
- **Random writes.** If your index key is random, like a UUID v4, each insert lands in a different page. The database ends up touching pages all over the disk instead of appending to a hot one at the end. An index on a timestamp or a sequential id stays cheap because inserts pile onto the same end page.
- **Lock and WAL cost.** Every index change also gets written to the write-ahead log, so your log volume goes up and replication has more to ship.

What to do:

1. Count your indexes on that table. Most tables need a handful, not a dozen. Drop the ones nothing queries.
2. Check for redundant ones. An index on `(a, b)` already covers queries on `a` alone, so a separate index on `a` is dead weight that you still pay to maintain.
3. Look at the key. If it is a random UUID and inserts are heavy, a time-ordered id such as UUID v7 keeps inserts near the end of the tree.
4. Measure the trade. Find out how much the index actually helped the read. If the query it serves runs once a minute and the writes run a thousand times a second, the index is a net loss.

The rule of thumb: index for the queries you actually run, and treat each index as a standing tax on every write to that table.

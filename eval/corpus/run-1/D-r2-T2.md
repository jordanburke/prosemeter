---
kind: eval-artifact
run: 1
variant: D
replicate: r2
task: T2
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
reviewerFinding:
  severity: minor
  foundBy: "opus"
  error: "Claims a composite on (a, b) beats separate indexes on a and b. It only serves the leftmost prefix, so b-only lookups regress."
---
Both things are true — indexes make *reads* faster and *writes* slower. Nobody's lying to you; they just left off the second half.

Think about what an index actually is. It's a second copy of some of your data, kept sorted, stored in its own structure (a B-tree, usually) separate from the table. Reads get fast because the database can binary-search that sorted structure instead of scanning every row.

But sorted structures don't maintain themselves. Every time you write:

- **INSERT** — the row goes in the table *and* a new entry has to be placed in the correct sorted position in every index on that table. Five indexes means six writes, not one.
- **DELETE** — same deal in reverse, every index has to be told.
- **UPDATE** — this is the sneaky one. If you update a column that's indexed, the entry has to be removed from its old sorted position and re-inserted at the new one. And in Postgres specifically, an update writes a whole new row version, so if *any* index covers the changed column you often lose the HOT-update optimization and every index on the table needs a new pointer — even indexes on columns you didn't touch.

Then there's **page splits**. The B-tree stores entries in fixed-size pages. When you insert into a page that's already full, the database splits it in two and rewrites both halves, possibly updating the parent node too. If your indexed column is random (a UUIDv4, a hash), your inserts land all over the tree and you're splitting pages constantly and dirtying pages scattered across disk. If it's monotonic (an auto-increment ID, a timestamp), inserts pile onto the rightmost page and it's much cheaper — that's why "index on `created_at`" feels free and "index on `uuid`" doesn't.

And all of that extra work goes through the write-ahead log first, so it's not just more page writes, it's more WAL, which means more disk bandwidth, more replication lag, and more work for the checkpointer. This is write amplification: one logical row change becoming many physical writes.

Practical takeaways:

- Index for the queries you actually run, not for the columns that "seem important." An unused index is pure write tax.
- Check whether an index is earning its keep. In Postgres: `SELECT * FROM pg_stat_user_indexes WHERE idx_scan = 0;` — anything with zero scans that's been up for a while is a candidate for `DROP INDEX`.
- One composite index on `(a, b)` usually beats separate indexes on `a` and on `b`, and costs half as much on write. A composite index also serves queries on just `a` (leftmost prefix), so you often get two for one.
- On write-heavy tables, batching inserts inside one transaction helps a lot — the index maintenance amortizes better than row-at-a-time.
- If you're bulk loading, dropping the indexes, loading, and rebuilding them is frequently faster than loading with them in place.

So the mental model to carry: an index is a bet that you'll read this column far more often than you write it. That bet is usually right, which is why the advice gets shortened to "indexes make things faster." When it's wrong, you feel it exactly where you just did.

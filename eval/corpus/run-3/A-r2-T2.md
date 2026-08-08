---
kind: eval-artifact
run: 3
variant: A
replicate: r2
task: T2
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes make *reads* faster. They make writes slower, always. That's the trade, and nobody mentions the second half when they're giving advice.

Here's why. An index is a second data structure — usually a B-tree — that holds a sorted copy of the column you indexed plus a pointer back to the row. When you `SELECT ... WHERE email = ?`, the database walks that tree instead of scanning every row. Great.

But when you `INSERT`, the database now has to write the row *and* insert into the index tree, in sorted position. That may mean splitting a page, rebalancing, and writing more to the write-ahead log. Same on `DELETE`. On `UPDATE`, if you touched an indexed column, it's a delete-plus-insert in the index. Add a second index and you pay that cost twice. Five indexes, five times.

So a table with a lot of indexes is a table where every write does a pile of extra bookkeeping. This is the normal, expected outcome — you didn't do anything wrong, you just bought read speed with write speed.

A few things worth checking, since the slowdown might be worse than the baseline cost:

- **Is the indexed column random-ish?** Sequential keys (auto-increment, ULID) append to the right edge of the tree, which is cheap. Random keys (UUIDv4) scatter inserts across the whole tree, dirtying pages everywhere and blowing out your cache hit rate. This is the single biggest multiplier I see.
- **Is it a wide index?** Indexing a long text column, or a multi-column index with several columns, means more bytes written per row.
- **Was it a unique index?** Then every insert also has to do a lookup to check the constraint.
- **Did you add it to a hot write table with low read volume?** That's the case where the trade is just bad.

The way to think about it: every index is a bet that you'll read this way often enough to pay for slowing down every write. Look at what queries you actually run. If the index isn't being used by a real query plan (`EXPLAIN` will tell you), drop it — an unused index is pure cost. Most tables I've seen in production have at least one index that nothing queries.

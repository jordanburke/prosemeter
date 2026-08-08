---
kind: eval-artifact
run: 3
variant: B
replicate: r1
task: T2
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes make **reads** faster. They make **writes** slower. Both are true at the same time, and nobody usually mentions the second half.

Think of an index like the index at the back of a textbook. Looking something up is fast because you don't have to skim every page. But if you add a new page to the book, you now have two jobs: write the page, *and* go update the index to point at it. More indexes, more updating.

That's exactly what your database is doing. Every `INSERT` now has to write the row and then insert an entry into the index, in the right sorted position. Every `UPDATE` that touches an indexed column has to remove the old index entry and add a new one. Every `DELETE` has to clean up. That work is real, and it costs both CPU and extra disk writes.

A few things make it worse than you'd expect:

- **The cost is per index, and it stacks.** If the table already had four indexes and you added a fifth, every insert now does five index updates.
- **Random insert positions hurt.** An index on something sequential (a timestamp, an auto-increment ID) appends near the end and stays tidy. An index on something random — a UUID, an email address — scatters writes across the whole structure and causes page splits, which are expensive.
- **Wide indexes cost more.** A multi-column index, or one on a long text column, is simply more bytes to write every time.

So the real question isn't "are indexes good," it's whether this particular index is earning its keep. Check whether it's actually being used — in Postgres, `pg_stat_user_indexes` will show you scan counts per index. An index with zero scans is pure cost, and worth dropping.

If it *is* being used, you're making a trade, and that's fine. Just make it deliberately: how much faster did the read get, how much slower did the write get, and which one does this table do more of? A reporting table that's written once a day and queried constantly should be heavily indexed. A high-volume event log that's rarely queried should be indexed as little as you can get away with.

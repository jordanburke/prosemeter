---
kind: eval-artifact
run: 1
variant: C
replicate: r2
task: T2
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Both things are true. An index makes reads fast and writes slow, and you just bought the second half.

An index is a second copy of that column, held in sorted order. Reads win because the engine can jump straight to the rows it wants. But the DB has to keep that copy true on every single write.

So an INSERT now does two writes, not one: the row itself, plus a slot in the B-tree. The B-tree part costs more. It walks down to the right leaf page, and if that page is full, it splits the page. A split touches the parent too, and sometimes the parent's parent. Add a third index and you pay all of that three times.

UPDATEs bite harder than most people expect. Change an indexed column and the DB deletes the old key, then inserts a new one somewhere else. In Postgres, a plain update often rewrites *every* index on that row, not just the one you changed. HOT updates avoid this, but only when no indexed column moves and the page has room.

Random keys are the worst case. A UUID lands in a random leaf page each time, so the DB keeps dragging cold pages in from disk. A serial ID or a timestamp appends to the right edge, which stays hot in cache. Same index, wildly different cost.

**What to do:**

- Count what you have. In Postgres, check `pg_stat_user_indexes` and drop any index with `idx_scan = 0`. Dead indexes are pure tax.
- One well-ordered composite index often does the job of three single-column ones.
- For big loads, drop the index, load the rows, then build it back. Much faster than row-by-row upkeep.
- Think twice before you index a column that changes on most writes.

The trade is real and often worth it. Just make each index earn its keep.

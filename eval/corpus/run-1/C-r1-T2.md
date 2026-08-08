---
kind: eval-artifact
run: 1
variant: C
replicate: r1
task: T2
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
An index doesn't make everything faster. It buys read speed with write speed.

Look at what your INSERT does now. Before, the DB wrote one row and stopped. Now it writes the row, then walks the index tree, finds the right slot, and writes an entry there too. If that page is full, it splits the page and rewrites the parent. All of that hits the write-ahead log as well, so you push more bytes to disk.

Same cost on DELETE, and on any UPDATE that touches the indexed column. Ten indexes on a table means ten of these per write.

So reads on that column got much faster, and writes got slower by about one small sorted write per index. That's the trade you made.

What to do about it:

- Keep the index only if a real query filters, joins, or sorts on that column.
- See which ones earn their keep. `pg_stat_user_indexes` shows `idx_scan` per index. Zero scans, drop it.
- Kill redundant ones. An index on `(a, b)` already serves queries on `a` alone, so a lone `a` index is dead weight.
- For bulk loads, drop the index, load the rows, then build it again. One big sort beats a million tiny ones.

If writes matter more than reads on this table, the right answer may be no index at all.

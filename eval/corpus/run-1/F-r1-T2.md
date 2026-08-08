---
kind: eval-artifact
run: 1
variant: F
replicate: r1
task: T2
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. You just met the second half of that trade.

An index is a second copy of your data, sorted a different way. The table holds the rows. The index holds a sorted structure, usually a B-tree, pointing back at those rows. Reads get faster because the database walks the sorted structure instead of scanning every row.

But every write now has to update both. Insert a row, and the database writes the row and inserts a key into each index. Delete a row, and it removes the key too. Update an indexed column, and it deletes the old key and inserts the new one. Five indexes mean roughly six writes per insert instead of one.

The cost is worse than the count suggests. Index inserts land in sorted position, not at the end of a file. That means reading a page, splitting it when it fills, and writing pages scattered across disk. Sequential writes are cheap and random writes are not.

**Two things make it much worse:**

- **Indexing a random column**, like a UUID v4. Every insert hits a different page, so nothing stays cached and pages split constantly. An index on a timestamp or an auto-increment id appends to the same hot page and stays cheap.
- **Indexing a column you update often.** Each update is a delete plus an insert in the index. Index the columns you filter on, not the ones that churn.

So the rule is not "indexes are fast." The rule is that you buy read speed with write speed. That's a good trade on a table read a thousand times per write. It's a bad trade on a high-volume log table you query once a day.

Check whether the index is even earning its keep. Run `EXPLAIN` on the query you added it for. If the planner ignores it, you're paying the write cost for nothing, and you should drop it.

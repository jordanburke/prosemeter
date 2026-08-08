---
kind: eval-artifact
run: 2
variant: Ep
replicate: r2
task: T2
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Indexes speed up reads and slow down writes. That is the trade, and nobody tells you the second half.

An index is a second copy of your data, sorted differently. Every insert has to write the row and then write an entry into the index. Every delete has to remove both. Every update has to touch the index if it changed a column the index covers. So one logical write becomes two or more physical writes, and the extra ones land in a different part of the disk than the row itself.

It gets worse than a flat doubling. The index is a B-tree, so inserts have to find the right leaf page and put the entry there. When that page is full, the database splits it — allocates a new page, moves half the entries, updates the parent. A split is far more expensive than a normal insert, and a page that was dense is now half empty, which makes the index bigger and the cache less effective.

**How bad this is depends on what you indexed:**

- **Indexing a monotonic column** — an autoincrement id, a `created_at` — is cheap. Every insert goes to the rightmost leaf, so you get sequential appends and almost no splits.
- **Indexing a random column** — a UUIDv4, a hash — is expensive. Inserts scatter across the whole tree, so you dirty a different page every time and split constantly.
- **Indexing a wide column** or several columns together means fewer entries per page, a taller tree, and more I/O per write.

Two more things that bite. Your writes also compete for buffer pool space now, because index pages push data pages out of cache. And if you added the index while under write load, the build itself locks or churns, which can look like the steady-state cost but is not.

**What to do:** check whether you need the index. Run your slow query with `EXPLAIN` and confirm the planner actually uses it — an unused index is pure write cost. If several indexes overlap, drop the redundant ones; a composite index on `(a, b)` already serves queries on `a` alone. And if you are indexing a random UUID, switch to a time-ordered one (UUIDv7, ULID) and the insert cost mostly goes away.

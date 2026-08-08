---
kind: eval-artifact
run: sonnet
variant: E
replicate: r3
task: T8
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Here's how I'd sequence it, roughly in order:

**1. Confirm the read replica actually fixes the bottleneck.** Check `pg_stat_activity` and slow query logs first. If the primary is saturated because of a few unindexed or badly written queries, fix those before adding infrastructure — a replica won't save you from a query that's fundamentally doing too much work, it'll just spread the pain across two boxes.

**2. Provision the replica using native streaming replication.** Most managed Postgres (RDS, Cloud SQL, etc.) makes this a checkbox. Self-hosted, set up streaming replication with a dedicated replication user and WAL shipping. Size it the same as the primary to start — you can right-size after you see real load.

**3. Add a read/write split in the app, deliberately.** Don't route by "is this a GET request" — route by whether the query can tolerate replication lag. A classic mistake: a user writes their profile, then immediately reads it back from a replica that hasn't caught up yet, and sees stale data. Keep read-after-write paths (anything right after a mutation) on the primary. Route everything else — reports, listings, search, anything read-heavy and lag-tolerant — to the replica.

**4. Build a routing layer, not scattered `if` statements.** A thin data-access wrapper (or a library like Prisma's read replica extension, or your ORM's built-in support) that takes a `{ replica: true }` flag per query keeps this consistent and easy to audit later.

**5. Monitor replication lag from day one.** Alert on lag past a threshold (a few seconds, tuned to your tolerance). If lag grows under load, the replica isn't keeping up and you have a capacity problem, not a routing problem.

**6. Roll out gradually.** Move one or two clearly safe endpoints (an analytics dashboard, a search page) to the replica first. Watch lag and error rates for a few days before moving the rest.

**7. Plan for failover separately.** A read replica for load isn't automatically a failover target — decide now whether you also want it to double as a standby, because that changes how you configure it (synchronous vs. asynchronous replication).

Start with step 1. Teams often build the replica and skip the query audit, then wonder why the primary is still hot.

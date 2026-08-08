---
kind: eval-artifact
run: 4
variant: Et
replicate: r3
task: T8
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
A read replica is the right move, but the work is mostly in the application, not the database. Streaming replication takes an afternoon. Deciding which queries can tolerate stale data takes longer, and that is where this goes wrong.

**First, confirm reads are actually the problem.** Check `pg_stat_statements` for total time by query. If one unindexed query is eating 60% of the CPU, fix that first — it is a day of work instead of a month, and you may not need the replica at all. Also check the connection count and the buffer cache hit rate. Saturation from connection churn does not get better with a replica.

**Then, in order:**

**1. Stand up the replica.** Streaming replication, async, in the same region as the primary. Async is the right default — sync replication makes every primary write wait on the replica and will make your problem worse. Alert on `pg_stat_replication` lag from day one, before any traffic goes near it.

**2. Route traffic explicitly, not automatically.** Give the app two connection pools, `primary` and `replica`. Do not put a proxy in front that guesses by SQL verb — that will send a read inside a transaction to the wrong place eventually. Make the call site say which one it wants.

**3. Sort the reads.** Three buckets:

- **Safe on the replica**: dashboards, search, reports, listings, anything already minutes old.
- **Must hit the primary**: anything inside a write transaction, anything a user reads right after writing it.
- **Unclear**: the interesting ones. Default them to the primary and move them over deliberately.

**4. Handle read-after-write.** This is the failure that will actually reach customers. A user saves their profile, the app redirects, the read goes to a replica 200ms behind, and the old name comes back. It looks like the save failed. Options, roughly cheapest first: pin that session to the primary for a few seconds after a write; route the specific read-after-write paths to the primary permanently; or capture the write LSN and have the replica read wait for it. Pick one and apply it consistently.

**5. Move traffic gradually.** One low-risk read endpoint first. Watch replica lag, primary CPU, and error rate. Then the next. A flag per route so you can send anything back to the primary without a deploy.

**What I would watch out for.** Replica lag is not constant — it spikes during bulk writes, `VACUUM`, and migrations, exactly when the system is already under strain. Whatever staleness tolerance you assume, assume it gets violated during an incident. Also plan for the replica going away: if a replica outage takes down all reads, you have traded a slow system for a fragile one. Fall back to the primary on replica connection failure.

**The honest caveat.** A read replica buys headroom, not a fix. If reads are growing steadily you will saturate again, and the next steps — caching, sharding, moving analytics off OLTP entirely — are much larger projects. Worth knowing which one you are heading toward before you spend the headroom.

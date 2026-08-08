---
kind: eval-artifact
run: 4
variant: Et
replicate: r1
task: T8
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
A read replica is the right shape, but I would not add it first. Two cheaper things usually recover more headroom, and both inform how you size the replica.

**Step 1: find out what is actually saturating the primary**

```sql
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```

Sort by `total_exec_time`, not `mean_exec_time` — the query that hurts is usually a fast one called constantly, not a slow one called rarely. In my experience the top three queries are most of the load, and one of them is a missing index or an N+1 from an ORM.

Also check what "saturated" means here. CPU, disk I/O, and connection count are three different problems with three different fixes. `pg_stat_activity` grouped by `wait_event_type` tells you which.

**Step 2: fix what turns up**

An index or a query rewrite is a day of work and no new infrastructure. If it buys you 40% headroom, you have bought months to do the replica properly. Do this even if you are certain you need the replica — you do not want to copy a bad query pattern onto a second machine.

**Step 3: check your connection pooling**

If the API opens connections per request rather than through a pool, you are burning primary resources on connection setup. PgBouncer in transaction mode in front of Postgres is a small change with a large effect. You need this before the replica anyway, because now you have two upstreams to pool against.

**Step 4: then the replica**

Streaming replication, async. The work splits into three parts, and the third is the hard one.

*Provisioning* is straightforward — `pg_basebackup`, a replication slot, `primary_conninfo`. Managed Postgres does it from a console.

*Routing* is where the design decision lives. You need reads to go to the replica and writes to the primary. Options, in order of how much I like them:

- Two connection pools in the app, and an explicit choice at the call site. Verbose, obvious, debuggable. Start here.
- A wrapper that routes by statement type. Less code, but it guesses, and it guesses wrong on `SELECT ... FOR UPDATE` and on functions with side effects.
- A proxy that splits automatically. Least app change, most operational surface, and it hides the routing decision from the people who need to reason about it.

*Replication lag* is what will actually generate tickets. Async replication means the replica is behind — usually milliseconds, occasionally seconds under write bursts or a long-running query on the replica holding up apply. A user saves a form, the next page reads from the replica, and their change is not there.

Handle it per read path rather than globally:

- **Reads that must be current** — anything immediately after a write in the same user flow, anything driving an authorization check — go to the primary. Full stop.
- **Reads that tolerate seconds of staleness** — dashboards, search, listing pages, analytics — go to the replica. This is where your volume is.
- **The read-after-write case** specifically: either pin that user's session to the primary for a few seconds, or capture the write's LSN and wait for the replica to catch up before reading. The session pin is simpler and covers most of it.

Alert on `pg_stat_replication.replay_lag`. Page if it exceeds your staleness budget, because past that point the replica is serving wrong answers rather than slow ones.

**Step 5: decide the failure behavior before you ship**

If the replica goes down, does the app fail reads or fall back to the primary? Falling back is the humane choice and it means a replica outage becomes a primary overload. Pick deliberately, and make sure the fallback is rate-limited so it degrades instead of collapsing.

**Rollout**

Ship the routing behind a flag, default off. Move one low-risk read path — a listing page, a search — and watch lag and error rates for a few days. Then expand. Do not move every read at once; you will not know which path caused the staleness bug.

**Rough sequence**

Week 1: measure and fix the top queries. Week 2: pooling. Week 3: provision the replica, routing behind a flag. Week 4: migrate read paths one at a time.

If steps 1 and 2 recover enough headroom, tell me and we can push the replica to next quarter. It is real ongoing cost — a second machine, lag monitoring, a new failure mode, and a routing decision at every call site forever.

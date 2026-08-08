---
kind: eval-artifact
run: 4
variant: E
replicate: r1
task: T8
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
I'd do the cheap work first and add the replica second. Replicas bring replication lag, and lag brings a class of bug that's miserable to debug. Worth confirming we need one before we take that on.

**First, find out what's actually saturating the primary.** Turn on `pg_stat_statements` if it isn't already and sort by total execution time. In my experience a handful of queries account for most of the load, and one missing index or one N+1 in a hot endpoint explains the whole graph. Check `pg_stat_activity` during the business-hours peak too. If connections are piling up in `idle in transaction`, the problem is the app holding transactions open, and a replica won't touch that.

Also check which resource is pinned. CPU, disk I/O, and connection exhaustion each point somewhere different, and a replica only helps the first two.

**Second, do the fixes a replica can't do.** Add the indexes the slow-query list asks for. Put a connection pooler in front — PgBouncer in transaction mode — because Node apps tend to open far more connections than Postgres wants. Cache the read-heavy endpoints that return the same rows to everyone.

If those get us under the line, we're done, and we've kept a single source of truth.

**If we still need the replica**, here's how I'd stage it:

1. **Stand up streaming replication** and let it run with no traffic for a week. Watch `pg_stat_replication` for lag under load. Set up alerting on lag before anything reads from it.
2. **Split the connection at the app layer**, one pool for the primary and one for the replica. Make the primary the default. Reads opt in explicitly.
3. **Classify the read paths.** Anything tolerant of a few seconds of staleness goes to the replica: dashboards, search, reports, list views, analytics. Anything read-after-write stays on the primary — a user saving a form and immediately seeing the result is the classic breakage.
4. **Route by intent, not by SQL verb.** Don't sniff for `SELECT` in middleware, because that sends read-after-write reads to the replica and gives us intermittent "my change didn't save" tickets. Make it an explicit choice at the call site.
5. **Move endpoints over one at a time**, watching error rates between each.

Things I'd want decided up front: what happens when the replica falls behind or dies (fail back to the primary automatically, or shed load?), whether the replica is also our failover target or read-only, and who owns the lag alert.

I'd budget a day for the investigation. Happy to take that first pass and bring numbers back before we commit to the replica.

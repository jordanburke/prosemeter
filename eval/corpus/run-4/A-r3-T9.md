---
kind: eval-artifact
run: 4
variant: A
replicate: r3
task: T9
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
That error is Postgres refusing new connections because `max_connections` is exhausted. The 502s and the restart loop are downstream of it, and they're feeding it.

Here's the loop you're in: connections fill up → new connections rejected → the app throws on startup or on its healthcheck → Kubernetes marks the pod unhealthy and restarts it → the restarted pod opens a fresh pool → but the *old* pod's connections may not be released promptly, so the pool is now worse, not better → next pod fails faster. Restart count climbing is the signature. Restarts are making it worse, which is why "just restart it" doesn't help and is probably what someone already tried.

**"Nothing shipped today" is the interesting part.** It means the trigger is environmental, not a code change. Candidates, roughly in order of how often I've seen them:

- **A pod scaled up.** HPA added replicas an hour ago; each replica has its own pool with its own max size; replicas × pool size crossed `max_connections`. Check whether replica count changed.
- **Something else started using the same database.** A batch job, a migration runner, a new service, an analytics tool someone pointed at prod. `pg_stat_activity` will name it.
- **A connection leak that finally saturated.** Slow leak from code shipped days ago that took until now to fill the pool. Load pattern hits its daily peak in business hours, which is why "about an hour ago."
- **Long-running or idle-in-transaction sessions piling up.** A query got slow, transactions stopped closing, connections stopped returning.

**What I'd do first, in this order.**

1. **Look at who's connected.** This is one query and it usually answers everything:

```sql
SELECT state, application_name, client_addr, count(*)
FROM pg_stat_activity
GROUP BY 1,2,3
ORDER BY count DESC;
```

If one `application_name` dominates, you've found it. If most rows are `idle in transaction`, it's a leak or a stuck transaction, not volume.

2. **Buy breathing room.** Terminate the clearly-dead sessions — `idle in transaction` older than a few minutes is safe to kill and is almost never legitimate:

```sql
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND state_change < now() - interval '5 minutes';
```

Be careful with this — read the output of the `SELECT` before running the terminate. Don't blanket-kill `active` sessions.

3. **Stop the restart loop.** If the readiness probe is what's cycling pods, temporarily loosen it or scale the deployment *down*. Counterintuitive, but fewer replicas means fewer pools means connections available means the remaining pods actually serve traffic. Scaling down to recover from connection exhaustion is the right instinct here.

4. **Then, and only then, consider raising `max_connections`.** It requires a restart on Postgres, each connection costs real memory, and if the cause is a leak you'll just saturate the higher limit in another hour. It's a stopgap, not a fix.

**The actual fix** is almost certainly a connection pooler — PgBouncer in transaction mode in front of Postgres — so that N app replicas share a bounded set of backend connections instead of each holding their own. Application-side pools don't coordinate with each other; that's the structural problem, and it recurs every time you scale out until you put a pooler in. Also worth auditing that every code path releases its connection in a `finally`, since a leak will find you again regardless.

Send me the `pg_stat_activity` output and the replica count over the last two hours and I can probably tell you which of the four causes it is.

---
kind: eval-artifact
run: 4
variant: A
replicate: r3
task: T8
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
A read replica is very likely the right move, but I'd want to do a day of work before provisioning anything, because "the primary is saturated" has a few possible causes and only some of them are fixed by adding a replica.

**First: confirm it's read volume and not a few bad queries.**

```sql
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```

If `pg_stat_statements` isn't enabled, enable it — this is the single highest-value diagnostic you'll have. Very often the top two entries are 70% of total database time and are a missing index or an N+1 from one endpoint. If that's what you find, fixing those is hours of work and buys you a year of headroom, versus a replica which is weeks of work and adds permanent operational surface. I'd genuinely check this first and be willing to stop here.

Also check what's actually saturated: CPU, disk IO, or connections. Connection exhaustion looks like saturation and is fixed by a pooler, not a replica.

**Assuming it really is read volume, here's the shape of the work.**

*Provision and replicate.* Streaming replication, managed if you're on RDS/Cloud SQL/Aurora — don't hand-roll this. Set `hot_standby_feedback` deliberately: on, and long-running replica queries can bloat the primary; off, and those queries get cancelled by replication conflicts. Neither default is right for everyone, so pick knowing the tradeoff.

*Routing is the hard part, and it's an application problem, not an infrastructure one.* You need two connection pools and a deliberate decision at every call site about which one to use. I'd resist anything that tries to route automatically by parsing SQL — it guesses wrong on the cases that matter. Make it explicit in the data layer:

```ts
const db = { primary: pool(PRIMARY_URL), replica: pool(REPLICA_URL) }
```

*Then confront replication lag, because this is what actually breaks in production.* The replica is behind the primary — normally milliseconds, occasionally seconds under load, minutes if something goes wrong. Read-after-write is where it bites: user updates their profile, you write to primary, redirect, read from replica, and they see the old value and refresh angrily. Or worse, an idempotency check reads a stale replica and you double-process something.

The rules I'd write down and hold to:

- **Anything inside a transaction that also writes goes to the primary.** No exceptions.
- **Any read whose result gates a write goes to the primary.** Balance checks, uniqueness checks, state-machine transitions.
- **Reads immediately following a write in the same user flow go to the primary.** Simplest implementation is a short sticky window — after a write, pin that session to the primary for N seconds. Crude, effective, easy to reason about.
- **Everything else can go to the replica**, and by volume that's usually most of it: list views, search, dashboards, reports, anything already eventually-consistent.

*Monitor lag from day one.* Alert on it. `pg_stat_replication` on the primary, or `pg_last_xact_replay_timestamp()` on the replica. Also decide what the app does when lag exceeds threshold — falling back to the primary is the sane default, and it means a lagging replica degrades performance rather than correctness.

**Rollout.** Ship the dual-pool plumbing with everything still pointed at the primary — that's a no-op change you can merge safely. Then move read paths over a few at a time, starting with the most obviously stale-tolerant (reporting, admin dashboards). Keep an env-var kill switch that sends everything back to the primary. Measure primary load after each batch so you know which moves actually helped.

**One thing worth deciding up front:** if you're on Aurora or similar, the reader endpoint plus a proxy handles a lot of this for you and the effort drops considerably. If you're on self-managed Postgres, budget for PgBouncer in the picture too — you'll want pooling in front of both nodes, and its transaction-mode semantics interact with how you do the routing. Worth knowing which world we're in before I estimate.

Happy to pull the `pg_stat_statements` output tomorrow and we can decide from there whether this is a query-fixing problem or a replica problem.

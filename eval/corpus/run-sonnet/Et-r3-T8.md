---
kind: eval-artifact
run: sonnet
variant: Et
replicate: r3
task: T8
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Here's how I'd sequence it, in order of what has to happen before what.

**1. Provision the replica first, measure before you route anything.**
Stand up a streaming (physical) replica off the primary. Before touching the app, watch replication lag under real business-hour load for a few days. This number drives every decision after it — if lag regularly hits seconds, some reads can't safely move.

**2. Classify your reads, don't split blindly.**
Not every read can tolerate lag. Sort your query paths into two buckets:
- **Replica-safe**: dashboards, reports, search, anything where a few hundred ms to a few seconds of staleness is fine.
- **Primary-required**: read-after-write paths — a user submits a form and the next request must see it (e.g. "order confirmed" page right after checkout).

**3. Add read routing at the data-access layer, not scattered through the app.**
Put the primary/replica decision in one place — a connection pool wrapper, an ORM read-preference setting, or a proxy like PgBouncer/pgpool. Application code should call `db.read()` or `db.write()`, not know which host it's hitting. This also makes it a one-line change if you add more replicas later.

**4. Handle the read-after-write cases explicitly.**
Common patterns: route that specific request to the primary for N seconds after a write, use a session-consistency token, or just keep those specific queries on the primary permanently. Don't try to solve this generically up front — handle it case by case as you migrate traffic.

**5. Roll out gradually, with a kill switch.**
Move one low-risk read path first (e.g. a reporting endpoint), watch error rates and lag, then expand. Keep a feature flag or config toggle to send everything back to the primary instantly if something breaks.

**6. Monitor lag and primary load continuously after rollout.**
Alert on replication lag exceeding your tolerance, and watch primary CPU/connections to confirm you actually relieved the saturation — not just moved the bottleneck to the replica.

**7. Plan for replica failure separately from this project.**
A read replica doesn't give you failover by default. If you want the replica promotable to primary during an outage, that's a related but separate piece of work — worth flagging to the team now so it doesn't get assumed for free.

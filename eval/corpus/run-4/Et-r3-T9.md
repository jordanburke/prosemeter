---
kind: eval-artifact
run: 4
variant: Et
replicate: r3
task: T9
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
You are out of Postgres connections, and the pod restarts are making it worse, not better. Break that loop first.

**What the error means.** `FATAL: sorry, too many clients already` is Postgres refusing new connections because open connections hit `max_connections`. The API cannot get a connection, so it fails the request, so the health check fails, so Kubernetes kills the pod and starts a new one. The new pod immediately opens a full pool. Meanwhile the killed pod's connections have not been reaped yet — Postgres does not notice a dead client until the TCP session times out. So each restart adds connections instead of freeing them. That is why restarts are climbing and it is not recovering on its own.

**Nothing shipped, so the trigger is something else.** Most likely one of:

- **Traffic grew** past what pool size × replica count could ever fit.
- **Something scaled up.** An HPA added replicas, or a batch job started. Pool size is per pod, so replicas × pool is the real number, and an autoscaler multiplies it silently.
- **Connections are leaking.** A code path that checks out a connection and never returns it — usually an error path missing a release, or a transaction left open. Long-running, not new code, just newly hot.
- **Something else took the connections.** A migration tool, an analytics query, someone's psql session left `idle in transaction`.

**Do this first, in this order:**

1. **Look at who holds the connections.** `SELECT state, count(*) FROM pg_stat_activity GROUP BY state;` and then group by `application_name` and `client_addr`. This tells you leak versus load versus outsider in about thirty seconds.

2. **Kill anything `idle in transaction` older than a few minutes.** `pg_terminate_backend` on those. If that alone frees a large block, you have found your leak and bought room to think.

3. **Stop the restart loop.** Either raise the health check's failure threshold or scale the deployment down so fewer pods compete. Fewer pods with working connections beats many pods thrashing.

4. **Then** consider raising `max_connections` — as a temporary measure, knowing each connection costs memory on the primary and raising it too far trades one outage for an OOM.

**The real fix is a pooler.** Put PgBouncer in transaction mode between the API and Postgres. Hundreds of app connections multiplex onto a few dozen database ones, and a pod restart stops being a database event. Cap the app pool per pod too, and size it as `replicas × pool < max_connections` with headroom for migrations and humans.

**Afterward.** Find the leak even if the pooler hides it — a pooler makes a leak survivable, not absent. And add an alert on connection count as a fraction of `max_connections`, because this one was visible for a while before it became 502s.

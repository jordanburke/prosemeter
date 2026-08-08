---
kind: eval-artifact
run: sonnet
variant: E
replicate: r1
task: T9
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your Postgres primary is out of connection slots — that error is Postgres refusing new connections because it's already at `max_connections`. The climbing restart count is your pods crash-looping as each one tries to connect, fails, and dies.

**Do this first, in order:**

1. **Check what's holding connections open.** Run `SELECT count(*), state FROM pg_stat_activity GROUP BY state;` on the primary. If most connections sit in `idle` or `idle in transaction`, something is opening connections and not releasing them — a pool leak, a deploy that changed pool size, or a job that stopped closing connections cleanly.
2. **Kill the leak's source if you can identify one.** A recent config change, a new cron job, or a scaled-up deployment are the usual causes even when "nothing shipped today" — infra changes and scheduled jobs count too. Check for anything that changed pod replica counts or pool settings in the last few hours.
3. **If you need traffic flowing now, free up slots.** Terminate long-idle connections (`pg_terminate_backend`) or restart the worst offending service to force its pool to reconnect cleanly. Treat this as a stopgap, not a fix.
4. **Once stable, put a pooler in front of Postgres** (PgBouncer, RDS Proxy) if you don't have one. It caps how many real backend connections your fleet can open, so a leak in one service can't starve every other service of connections again.

The pods restarting are a symptom, not the cause — don't spend time tuning pod health checks or restart policy until the connection count itself is under control.

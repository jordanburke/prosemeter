---
kind: eval-artifact
run: 3
variant: B
replicate: r4
task: T3
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
The core problem: a failed request is not the same thing as a failed charge.

When your call times out or returns a 500, you don't actually know what happened on the other side. Three possibilities, and they look identical from your end:

1. The request never arrived — nothing was charged.
2. It arrived, the charge succeeded, but the response got lost coming back.
3. It arrived and genuinely failed.

Retrying is correct for case 1 and 3. In case 2 you charge the customer a second time. Timeouts are the usual culprit, because a slow payment processor is exactly the situation where the charge *did* go through and you just didn't hear about it in time.

**Idempotency** is the fix. An idempotent operation produces the same result whether you run it once or five times. Payments aren't naturally idempotent — each call creates a new charge — so you have to make them so with an idempotency key.

How it works in practice:

- Before the first attempt, generate a unique key for that *logical* payment. A UUID is fine. Store it with the order.
- Send it with the request, usually as an `Idempotency-Key` header. Every payment processor worth using supports this.
- On retry, send **the same key**. Not a new one.
- The processor recognizes the key, sees it already handled that charge, and returns the original result instead of charging again.

The part people get wrong: the key has to be generated once, before the first attempt, and persisted. If you generate it inside the retry loop, every attempt gets a fresh key and you're back where you started.

Two things to check in your current code:

- Where is the key created relative to the retry loop? It needs to be outside.
- Are you retrying non-idempotent operations blindly? A retry wrapper that retries every request is the usual way this bug gets introduced. Retries should be opt-in for writes.

Also worth fixing regardless: reconcile against the processor. Whatever your retry logic does, some charges will land in an ambiguous state, and you want a job that compares your records against theirs and flags mismatches.

---
kind: eval-artifact
run: 3
variant: B
replicate: r1
task: T3
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
The core problem: **a failed request and a request whose response you never saw look identical from your side.**

Your retry logic sent a charge, didn't get a response back — timeout, dropped connection, whatever — and assumed it failed. So it sent the charge again. But the first request had already reached the payment provider and succeeded; only the *response* got lost on the way back. Now there are two charges.

This isn't a bug in your retry code exactly. It's that retrying is only safe when the operation is **idempotent** — meaning doing it twice has the same effect as doing it once. "Set the user's email to X" is idempotent: run it five times, same result. "Charge $50" is not: run it five times, the customer is out $250.

The fix is to make the charge idempotent, which you do with an **idempotency key**. It works like this:

1. Before you send the charge, generate a unique ID for that *attempt* — a UUID, or something derived stably from the order (e.g. `order-8891-capture`).
2. Send it with the request. Stripe, Adyen, Braintree and friends all support this, usually via an `Idempotency-Key` header.
3. If you retry, send **the exact same key**. The provider recognizes it, skips doing the work again, and returns the original response.

The key detail people get wrong: the key must be generated **once, before the first attempt**, and reused for every retry of that same logical operation. If you generate a fresh key inside the retry loop, you've built exactly the bug you already have. Store it with the order record so it survives a process restart.

Two things to check while you're in there:

- **Don't retry blindly on every error.** A `4xx` means the request was understood and rejected — retrying won't help. Retry on timeouts, connection failures, and `5xx`. And use exponential backoff, so a struggling provider doesn't get hammered.
- **Reconcile.** Even with keys, you'll eventually have a charge you're unsure about. A job that pulls the provider's transaction list and compares against your own records will catch the stragglers. Idempotency keys prevent duplicates; reconciliation is how you find out when something slipped through anyway.

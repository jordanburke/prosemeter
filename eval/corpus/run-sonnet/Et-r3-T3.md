---
kind: eval-artifact
run: sonnet
variant: Et
replicate: r3
task: T3
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry logic re-sent a request that had already succeeded, and the payment processor had no way to know that. It just saw a new charge request and ran it.

This is what idempotency fixes. An idempotent operation gives the same result no matter how many times you run it. Charging a card is not idempotent by default — calling "charge $50" twice charges $50 twice, because each call looks like a brand-new instruction.

The fix is an **idempotency key**: a unique ID you generate once per logical operation (not per HTTP attempt) and send with every retry of that same operation. On the server side:

1. Client generates a key (e.g. a UUID) before the first attempt.
2. Every retry of that same logical charge reuses the same key.
3. The server checks: have I seen this key before? If yes, return the original result instead of charging again. If no, process it and store the result under that key.

Most payment processors (Stripe, for one) support this natively — you pass an `Idempotency-Key` header and they handle the dedup for you. If you're building this yourself, store keys with a unique constraint in your database so two concurrent retries can't both slip through.

The rule going forward: any retry logic that touches money, inventory, or anything else non-repeatable needs an idempotency key. Retries without one are safe only for operations that are naturally idempotent, like a plain read or a `PUT` that sets an absolute value.

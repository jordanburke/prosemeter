---
kind: eval-artifact
run: 5
variant: L
replicate: r4
task: T3
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry sent a second charge request after the first one already succeeded. The response got lost, not the charge. Fix it by giving each charge attempt an idempotency key.

Here is the failure. Your service posts a charge. The payment provider takes the money. The response times out on the way back, or the connection drops, or the load balancer kills it at 30 seconds. Your code sees a failure and retries. The provider sees a brand new charge request and takes the money again.

The core problem is that a timeout tells you nothing. It does not mean the request failed. It means you do not know. A retry after an unknown outcome is a gamble that the first attempt did nothing.

Idempotency removes the gamble. An idempotent operation gives the same result whether you run it once or five times. Reading a row is naturally idempotent. Charging a card is not — each call moves real money.

You make it idempotent with a key. Generate a unique id for the charge — a UUID is fine — before the first attempt. Send it on that attempt and on every retry of the same charge. Stripe takes it as the `Idempotency-Key` header; most providers have an equivalent.

The provider then stores the key with the result. A second request carrying a key it has seen does not charge again. It returns the stored response from the first one.

Three rules make this work in practice.

Generate the key once, outside the retry loop. A key generated inside the loop is a new key each time, which is exactly the bug you have.

Derive it from the thing being paid for, not from the clock. An order id or a payment-attempt id is stable across process restarts. A timestamp is not.

Do not reuse a key for a different amount. Providers reject that, and the rejection is the safety net catching a real bug.

Also retry only what is safe. A 500 or a timeout is worth retrying. A 400 means the request was wrong, and sending it again will not help.

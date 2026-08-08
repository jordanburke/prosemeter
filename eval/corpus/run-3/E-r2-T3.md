---
kind: eval-artifact
run: 3
variant: E
replicate: r2
task: T3
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry sent a second charge request because the first one succeeded but the response never got back to you. The payment provider saw two valid requests and did what you asked twice.

Here is the failure. Your service posts a charge. The provider takes the money and starts writing the response. The connection times out, or a load balancer drops it, or the provider is slow and your client gives up. Your code sees an error and retries. The provider has no way to tell that the second request is the same intent as the first, so it charges again.

The key point: **a timeout tells you nothing about whether the work happened.** You know your request left. You do not know if it arrived, if it was processed, or if only the reply was lost. Retrying an unknown outcome is retrying a possible success.

Idempotency fixes this. An idempotent operation gives the same result whether you run it once or ten times. Reads are naturally idempotent. Charging a card is not, so you have to make it so.

The mechanism is an idempotency key. You generate a unique key per logical charge — not per attempt — and send it with every retry of that charge:

```
POST /v1/charges
Idempotency-Key: 7f3c9e2a-4b1d-4e8f-9a2c-1e5b8d3f6a90
```

The provider stores the key with the result of the first request. When the same key arrives again, it skips the work and returns the stored response. Stripe, Adyen, and Square all support this. Your retries become safe because the second call returns the first call's outcome instead of creating a new one.

Three things to get right:

**Generate the key before the first attempt, and reuse it.** A key generated inside the retry loop is a new key each time, which is the bug you already have.

**Derive the key from the business intent, and persist it.** Store it with the order record before you call the provider. If your process crashes and restarts, it has to recover the same key, or the recovery path recharges the customer.

**Make your own endpoints idempotent too.** Whoever calls your service has the same problem you have. Accept an idempotency key, store request key plus result, and return the stored result on a repeat.

Then a cleanup pass. Reconcile against the provider daily and catch anything the key mechanism missed. Keys usually expire after 24 hours, so a retry days later will charge again.

Blunt version: retries and non-idempotent writes do not mix. Either make the write idempotent, or do not retry it.

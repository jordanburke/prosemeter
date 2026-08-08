---
kind: eval-artifact
run: 2
variant: E
replicate: r3
task: T3
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry sent a second charge request that the payment processor had no way to recognize as the same charge. So it charged twice. Idempotency is the mechanism that would have let it recognize the repeat and return the first result instead.

The failure looks like this. Your service sends the charge. The processor receives it, charges the card, and starts writing the response. The network drops, or your client hits its timeout, or the load balancer kills the connection. Your code sees an error and retries. The processor sees a brand new request that looks identical to a legitimate second purchase, and charges again.

The key point: **a failed response does not mean a failed operation.** You cannot tell "never arrived" apart from "arrived and succeeded but the reply was lost" from the client side. Both look like a timeout. Retrying is safe only for the first case, and you cannot distinguish them, so you must make retrying safe for both.

Idempotency does that. You generate a unique key for the *logical* operation, before the first attempt, and send the same key on every retry:

```
POST /v1/charges
Idempotency-Key: 7f3a9c21-order-88213
```

The processor stores that key with the result. A second request carrying the same key returns the stored result instead of charging again. Stripe, Adyen, and Square all support this; check which header yours wants.

Three rules make it actually work.

**Generate the key once, at the top.** Derive it from the thing being paid for — the order ID, the invoice ID — not from a fresh UUID inside the retry loop. A new key per attempt gives you no protection at all.

**Persist it before you send.** If your process crashes and restarts, it must recover the same key, not invent a new one.

**Do the same on your own write endpoints.** Anything a client can retry needs the same treatment. Store the key with a unique constraint, and let the database reject the duplicate.

For the charges that already went out, refund the duplicates and reconcile against the processor's records by order ID.

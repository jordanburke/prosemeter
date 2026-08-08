---
kind: eval-artifact
run: 3
variant: E
replicate: r4
task: T3
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry charged twice because the first request succeeded and you never learned it did. A timeout tells you nothing about what happened on the other side. The payment processor took the charge, the response got lost on the way back, and your client saw silence and sent the request again.

Retries are safe only when the operation is idempotent. Idempotent means running it twice leaves the same state as running it once. `DELETE /orders/42` is idempotent. `POST /charges` is not, because each call creates a new charge.

You make a charge idempotent by giving the server a way to recognize the repeat. The caller generates a key, sends it with the request, and reuses that same key on every retry:

```
POST /charges
Idempotency-Key: 7f3a91c2-...
```

The server then stores the key with the result of the first call. A second request carrying that key returns the stored result instead of charging again.

Three details decide whether this actually holds:

- **Generate the key before the first attempt**, and keep it fixed across all retries. A key generated inside the retry loop changes each time and buys you nothing.
- **Write the key and the charge in one transaction.** If they are separate, two concurrent retries can both check, both miss, and both charge.
- **Give keys a lifetime** that outlives your retry window. Stripe holds them 24 hours, which is a fine default.

Stripe, Adyen, and Square all support `Idempotency-Key` already. Check your processor's docs, because you likely get this for free.

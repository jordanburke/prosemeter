---
kind: eval-artifact
run: 5
variant: L
replicate: r1
task: T3
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry sent a second charge request, and the payment system had no way to tell it apart from a real second purchase. Give each charge attempt an idempotency key, and reuse that key on every retry.

Here is the failure. Your code sends a charge. The response never arrives — a timeout, a dropped connection, a 502 from a proxy. Your retry logic sees no success, so it sends again. But the first request may have already reached the payment provider and succeeded. The charge went through; only the answer got lost. Now you have two charges.

The key point: a timeout tells you nothing about whether the work happened. It tells you only that you did not hear back. Retrying on a timeout is retrying on ignorance.

Idempotency is the property that doing something twice has the same effect as doing it once. `DELETE /orders/5` is naturally idempotent — the order ends up gone either way. `POST /charges` is not, because each call creates a new charge. Payment APIs solve this by letting you make the call idempotent yourself.

You generate a unique key per logical operation and send it as a header:

```
Idempotency-Key: 7f3c9a2e-order-8812-attempt
```

The provider stores the key with the result of the first request. A later request with the same key does not charge again. It returns the stored result of the original. Stripe, Adyen, and Square all work this way.

Four rules make this actually work.

**Generate the key before the first attempt, not inside the retry.** The key identifies the *intent to charge*, not the HTTP call. If your retry generates a fresh key, you are back where you started.

**Derive it from something stable.** The order ID, or a UUID you write to your own database alongside the pending order, before you call the provider. If your process crashes and restarts, it must recover the same key.

**Never reuse a key for a different amount or customer.** Providers reject the mismatch, or worse, hand back the wrong result.

**Know the retention window.** Stripe keeps keys about 24 hours. A retry after the window expires charges again. Long-delayed retries need a reconciliation step instead, not a replay.

Retries also need care beyond the key. Cap the attempts, back off exponentially with jitter, and only retry on timeouts, connection failures, and 5xx. A 402 declined card is a final answer — retrying it just annoys the issuer.

Last, close the loop. Query the provider for existing charges on that order before creating a new one after a long outage, and reconcile daily against their settlement report. The key handles the common case. Reconciliation catches what the key cannot.

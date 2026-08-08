---
kind: eval-artifact
run: sonnet
variant: Et
replicate: r2
task: T3
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
The retry fired against a request that already succeeded — you just never found out.

Here's the sequence: your client sends a charge request, the payment provider processes it and charges the card, then the response gets lost — a timeout, a dropped connection, a proxy hiccup, doesn't matter which. Your client sees no response, assumes failure, and retries. The provider sees a brand-new request and charges the card again. From the provider's side, both requests were valid and distinct — it has no way to know they were meant to be the same purchase.

That's what idempotency fixes. You generate a unique key for the operation (not the request — the *intent*, e.g. "charge order #4521") and send it with every attempt, retries included. The provider stores the key alongside the result of the first successful charge. When a retry arrives with the same key, it returns the original result instead of charging again.

To fix your code:

1. Generate the idempotency key once, when the charge intent is created — not on each retry.
2. Pass it on every attempt for that same charge.
3. Check that your payment provider supports idempotency keys (Stripe, for one, does — it's a header on the request).
4. If you're calling an internal service instead of a third-party processor, you'll need to implement the same pattern server-side: store the key, and return the cached result on a repeat.

Retries are safe once the operation is idempotent. Without that, retries just mean "maybe do this twice."

---
kind: eval-artifact
run: sonnet
variant: E
replicate: r2
task: T3
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry logic resent a charge request that had already succeeded, and the payment system treated it as a new charge. That's the duplicate.

Here's the sequence: your client sends a charge request, the payment succeeds on the server, but the response gets lost — a timeout, a dropped connection, a network blip. Your client never sees success, so it retries. The payment system has no way to know "this is the same charge as before," so it processes it again. You now charged the customer twice for one purchase.

**Idempotency fixes this.** An idempotent operation gives the same result no matter how many times you run it. You get idempotency by attaching a unique key to each logical operation — an idempotency key — generated once per user action, not once per HTTP request.

**How to apply it:**

1. Generate one idempotency key per charge attempt (a UUID tied to the cart, order, or user action — not regenerated on retry).
2. Send that key with every retry of the same charge.
3. The payment provider (Stripe, for example, supports this natively) checks the key before processing. If it's seen that key before, it returns the original result instead of charging again.
4. If you're building this yourself instead of relying on the provider, store the key with the charge record, and check for an existing record with that key before processing a new one.

Retry logic without idempotency keys will always risk duplicate side effects. Add the key, and retries become safe.

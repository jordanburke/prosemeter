---
kind: eval-artifact
run: sonnet
variant: E
replicate: r1
task: T3
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Idempotency is the missing piece — without it, a retry looks like a brand-new charge to your payment provider.

Here's the failure path. Your client sends a charge request. The request reaches the server and the charge succeeds, but the response gets lost — a timeout, a dropped connection, a proxy hiccup. Your client never sees success, so your retry logic fires again. From the server's point of view, that's just a second, unrelated request for a charge. It processes it and charges the customer twice.

Idempotency fixes this by giving each *logical* attempt a stable identity, separate from how many times you retry it. The pattern:

1. **Generate one idempotency key per user action** (a UUID), not per HTTP request.
2. **Send that same key on every retry** of that action.
3. **The server stores the result keyed by that ID.** If it sees the same key again, it returns the stored result instead of charging again.

Most payment providers (Stripe, Braintree) support an `Idempotency-Key` header built for exactly this. Use it.

One more thing: only retry requests that failed to reach the server, or where the server confirms nothing happened. If you're unsure whether the charge went through, that's exactly the case idempotency keys solve — retry safely, because the key makes the retry a no-op instead of a duplicate.

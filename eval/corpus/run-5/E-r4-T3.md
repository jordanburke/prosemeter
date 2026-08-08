---
kind: eval-artifact
run: 5
variant: E
replicate: r4
task: T3
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry sent a second charge request for a payment that had already succeeded. The first request went through; the response back to you did not. Your code saw a failure, retried, and the payment provider treated the retry as a brand new charge.

This is the core problem with retries over a network. A failure tells you that you did not get an answer. It does not tell you that nothing happened. Those two cases look identical from the caller's side.

- Timeout: the charge may have completed after your clock ran out.
- Connection reset: the charge may have completed before the socket died.
- 502 or 503 from a proxy: the request may have reached the payment service anyway.

Retrying is still right. You cannot tell a lost request from a lost response, and giving up would drop real payments. The fix is to make the second attempt safe rather than to stop making it.

That is what idempotency gives you. An idempotent operation produces the same result whether you run it once or five times. Reading a balance is naturally idempotent. Charging a card is not — each call moves money.

You make charging idempotent by attaching a key.

1. Your code generates a unique key for the charge — a UUID, or something derived from the order. It generates the key **once**, before the first attempt, and stores it.
2. Every attempt, including retries, sends that same key.
3. The provider records the key with the result of the first request.
4. A later request with a key it already has does not charge again. It returns the stored result of the original.

The key must be stable across retries and different across charges. Generating it inside the retry loop defeats the whole thing — each attempt gets a fresh key and looks like a new charge. That is the bug people ship after they add idempotency keys.

Every major payment provider supports this. Stripe takes an `Idempotency-Key` header; Adyen, Square, and PayPal have their own version of the same idea. Keys usually expire after a day or so, so idempotency protects retries, not replays weeks later.

Three things to get right on your side.

**Persist the key before you call.** Write the order row with its key, then charge. If your process dies mid-call and restarts, it needs to find the same key.

**Do not vary the request body between retries.** Providers reject a reused key carrying different parameters, because that signals a bug rather than a retry.

**Add backoff and a cap.** Retry with exponential backoff and jitter, and stop after a few attempts. Then reconcile — query the provider for the charge by key or by order and record what actually happened.

Apply the same discipline inside your own service. If callers can retry your API, your API needs idempotency keys too, or you will push the duplicate one layer up.

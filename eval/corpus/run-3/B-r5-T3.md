---
kind: eval-artifact
run: 3
variant: B
replicate: r5
task: T3
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
The retry logic isn't broken. It's doing exactly what you told it to. The problem is that a failed request and a request whose *response* got lost look identical from the client side.

Walk through what happened:

1. You send "charge $50."
2. The payment provider receives it, charges the card, starts writing the response.
3. The connection times out — slow network, load balancer gave up, whatever.
4. Your client sees a timeout, concludes the request failed, retries.
5. The provider receives a second, completely separate "charge $50" and charges the card again.

From your side, step 3 and "the request never arrived" are indistinguishable. You cannot tell them apart by looking at the error. So a blind retry on a timeout is a coin flip on whether you double-charge.

**Idempotency is the fix.** An idempotent operation gives the same result whether you do it once or five times. "Set balance to $50" is idempotent. "Subtract $50" is not. Charging is inherently a "subtract" — so you make it idempotent artificially, with a key.

The pattern: before you send the charge, generate a unique ID for that *business intent* — one ID for "Jordan's order #1234", not one per HTTP attempt. Send it as an idempotency key. The provider stores it. If a request arrives with a key it has already seen, it doesn't charge again; it returns the result of the original charge. Now retrying is safe, because the second request is recognized as the same request, not a new one.

Every serious payment API supports this — Stripe uses an `Idempotency-Key` header, and most others have an equivalent.

Three things people get wrong:

- **Generating the key inside the retry loop.** Then every attempt has a different key and you're back where you started. Generate it once, outside, and reuse it across all attempts.
- **Not persisting the key.** If your process restarts mid-retry and regenerates the key, same problem. Write it to your DB alongside the order before you make the first call.
- **Assuming it only matters for timeouts.** 5xx responses, connection resets, and your own service crashing between "charged" and "recorded as charged" all produce the same ambiguity.

While you're in there: cap the retries, use exponential backoff with jitter, and only retry on transport errors and 5xx. Retrying a 400 will never succeed and just adds load.

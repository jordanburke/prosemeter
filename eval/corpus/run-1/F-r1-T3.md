---
kind: eval-artifact
run: 1
variant: F
replicate: r1
task: T3
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
reviewerFinding:
  severity: minor
  foundBy: "opus"
  error: "'Never retry a 4xx, because the request was wrong and the next one will be wrong the same way.' Overbroad for 429 and 408."
---
Your retry charged twice because the first request probably succeeded. You saw a failure, but the failure was in the response, not in the charge.

Here's the sequence. Your service sends the charge request. The payment provider receives it, moves the money, and starts sending back a success response. Then the connection drops, or your client hits its timeout, or a load balancer kills the socket. Your code sees an error and retries. The provider gets what looks like a brand new charge request and moves the money again.

The core problem is that a timeout tells you nothing. It does not mean "this did not happen." It means "I do not know whether this happened." Retrying an unknown is safe only when doing the thing twice equals doing it once.

**That property is idempotency.** An operation is idempotent when running it many times leaves the same state as running it once. Reads are naturally idempotent. `DELETE /orders/42` is idempotent, because the second delete finds nothing to do. "Charge this card $50" is not, because the second call moves another $50.

You make a charge idempotent by giving it a key. Your client generates a unique id per charge attempt, usually a UUID, and sends it with the request. The provider stores it. On the first request it does the work and records the result under that key. On any later request with the same key, it skips the work and replays the stored result.

**The rule that makes this work:** generate the key once, before the first attempt, and reuse it for every retry of that same charge. A key generated inside the retry loop is a fresh key each time, which is exactly the bug you have now. Tie it to the business action, like the order id or the cart checkout, not to the network call.

Stripe, Adyen, and most providers already support this through an `Idempotency-Key` header. Check your provider's docs, because you likely have the mechanism and are just not sending the header.

Two more things worth fixing while you're in there:

- **Add backoff and jitter** to your retries. Tight retry loops turn a slow provider into a stampede.
- **Only retry what's safe.** Retry on timeouts, connection errors, and 5xx. Never retry a 4xx, because the request was wrong and the next one will be wrong the same way.

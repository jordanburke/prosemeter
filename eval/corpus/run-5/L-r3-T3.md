---
kind: eval-artifact
run: 5
variant: L
replicate: r3
task: T3
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry re-sent a charge that had already succeeded, because a failed response does not mean a failed operation. Idempotency fixes this by giving each attempt a key the payment provider uses to recognize the retry and return the original result instead of charging again.

Here is the failure. Your service sends a charge request. The provider receives it, charges the card, and starts to reply. The reply is lost — a timeout, a dropped connection, a 502 from a proxy, a pod that got killed. Your code sees an error and retries. The provider receives what looks like a brand new charge and charges the card a second time.

The customer was charged twice. Your logs show one success. Nothing in that flow is a bug in the usual sense; the network simply cannot tell you which of two things happened.

That is the core point. A timeout is ambiguous. It means "I do not know", not "it did not happen". Retrying on an unknown outcome is safe only when repeating the operation has the same effect as doing it once. That property is idempotency.

Reads are naturally idempotent. `GET /charges/123` returns the same thing however many times you call it. So is a write that sets an absolute value: `balance = 100`. What is not idempotent is a write that changes state relative to what is there: `balance = balance - 50`, or "create a charge". Payments are the second kind, which is why they bite.

An idempotency key makes them behave like the first kind. You generate a unique key per logical operation — not per HTTP attempt — and send it as a header. Stripe uses `Idempotency-Key`. The provider stores the key with the result of the first request. A second request with the same key does not execute; it returns the stored response.

Four rules make this actually work.

**Generate the key once, before the first attempt, and reuse it across every retry.** A key generated inside the retry loop is a new key each time and buys you nothing. This is the most common way teams get it wrong.

**Tie the key to the business event, not the request.** A UUID stored on your order record works well. If the user clicks Pay twice, the same order means the same key, so the double click collapses too.

**Retry only what is safe, and back off.** Retry on timeouts, connection failures, 429, and 5xx. Do not retry a 400 — the request is wrong and will stay wrong. Use exponential backoff with jitter so your retries do not stampede a recovering service.

**Set a bound.** Providers expire keys, usually after 24 hours. Do not reuse a key for a genuinely new charge after that window.

Apply the same discipline to your own side. Your charge endpoint should accept an idempotency key from your clients, and your database should carry a unique constraint on it — `UNIQUE (idempotency_key)` on the payments table. The constraint is what actually prevents the duplicate under concurrency; a check-then-insert has a race between the check and the insert.

Finally, add reconciliation. Before creating a charge after an ambiguous failure, you can query the provider for a charge matching your reference. Idempotency keys are the first line, reconciliation is the safety net, and a daily job comparing your ledger against the provider's catches whatever slips through both.

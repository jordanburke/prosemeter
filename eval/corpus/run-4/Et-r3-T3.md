---
kind: eval-artifact
run: 4
variant: Et
replicate: r3
task: T3
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry could not tell "the charge failed" from "the charge worked and the response got lost." It assumed the first one and charged again.

**The failure shape.** Your service sends the charge. The processor takes the money. The response never comes back — timeout, dropped connection, a 502 from something in between. From your side those look identical to a real failure. You retry. The processor sees a brand-new request and charges again.

This is not a bug in your retry code. Any retry over a network has this hole. The network cannot tell you whether a request that timed out was applied.

**Idempotency closes it.** You send a key with the request — a UUID you generate once, before the first attempt, and reuse on every retry of that same charge. The processor stores the key with the result. Second time it sees the key, it does not charge; it replays the stored response.

That turns "at least once" delivery into "exactly once" effect. You still send the request more than once. It only takes effect once.

**Four things people get wrong:**

- **Generating the key inside the retry loop.** Then each attempt has a fresh key and nothing is deduplicated. Generate it before the first attempt and carry it through.
- **Deriving it from the wrong thing.** Hashing the amount plus user ID means a customer who legitimately buys the same coffee twice gets blocked on the second one. Tie the key to the business intent — the order, the invoice, the cart checkout.
- **Retrying non-idempotent responses.** A definite 400 or a card decline should not be retried at all. Only retry timeouts, 5xx, and connection errors.
- **Forgetting your own side.** If you write a payment row before calling the processor, that write needs the same protection. A unique constraint on the idempotency key is the simplest version.

**What to do now.** Check whether your processor supports idempotency keys — Stripe, Adyen, and Braintree all do, on a header. Add the key, generate it at the top of the operation, persist it with the payment record so a process restart mid-retry still reuses it. Then go find the existing duplicates and refund them before a customer does it for you.

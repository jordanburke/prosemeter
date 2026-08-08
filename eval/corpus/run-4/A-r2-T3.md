---
kind: eval-artifact
run: 4
variant: A
replicate: r2
task: T3
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
The thing that bit you: **a timeout is not a failure.** When your HTTP client gives up waiting, you learn that you didn't get a response. You learn nothing about whether the charge happened. The request may have arrived, been fully processed, money moved, and the response got lost on the way back. Your retry then submits a second, entirely legitimate-looking charge request, and the payment processor does exactly what you asked twice.

This is the classic distributed systems problem — you cannot distinguish "it didn't happen" from "it happened and I didn't hear about it" from the client side. Retrying blindly turns every ambiguous outcome into a duplicate.

**Idempotency** is the fix. An operation is idempotent if performing it twice has the same effect as performing it once. Charging a card is not naturally idempotent, so you make it idempotent by attaching a key:

```ts
await stripe.paymentIntents.create(
  { amount, currency: "usd", customer },
  { idempotencyKey: order.idempotencyKey }
)
```

The server records the key alongside the result. First request with that key does the work and stores the response. Any later request with the same key skips the work and replays the stored response. Now a retry is safe, because the second attempt is a lookup rather than a new charge.

Two details that people get wrong and that determine whether this actually works:

**Generate the key before the first attempt, and reuse it across all retries.** If you generate a fresh UUID inside the retry loop, every attempt gets a distinct key and you're back to duplicate charges with extra steps. The key belongs to the *business operation* — this order, this payment attempt — not to the HTTP call. Persist it with the order record so it survives a process restart mid-retry.

**Derive the key from something stable and unique.** Order ID is usually right. Don't hash the request body alone — a customer legitimately buying the same item twice would collide and the second purchase would silently vanish, which is a worse failure than a duplicate because nobody notices.

For the immediate cleanup: pull the duplicates for the affected window and refund them, and check whether your processor already exposes them. Stripe surfaces `idempotent_replayed` on responses, and if you were sending keys inconsistently the dashboard will show near-identical charges seconds apart on the same customer.

Worth also checking your retry policy while you're in there. Retrying on a 500 or a timeout is reasonable. Retrying on a 4xx is not — that's a request the server understood and rejected, and it will reject it again. And use exponential backoff with jitter, otherwise a processor blip turns into your entire fleet retrying in lockstep.

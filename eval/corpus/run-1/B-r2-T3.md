---
kind: eval-artifact
run: 1
variant: B
replicate: r2
task: T3
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry is doing exactly what you told it to. The problem is that a failed request isn't the same thing as a request that didn't happen.

Here's the sequence that bites you: you send the charge, the payment provider receives it and charges the card, and then the response gets lost — timeout, dropped connection, your service restarts mid-flight. From your side that looks identical to "the request never landed." You retry, the provider sees a brand new charge request, and charges again. Two charges, one intent.

You can't fix this by being smarter about *when* to retry, because you fundamentally cannot tell those two cases apart from the client. What you can do is make the retry harmless.

That's idempotency: an operation you can perform repeatedly and get the same result as performing it once. Reading a balance is naturally idempotent. Charging a card is not — unless you give the provider a way to recognize the repeat.

The standard mechanism is an **idempotency key**. You generate a unique ID for the *intent* to charge (not for each attempt), and send it with every try:

```
POST /charges
Idempotency-Key: order-8f2c1a-charge-1
{ "amount": 4200, "currency": "usd" }
```

The provider stores the key with the result. First time it sees the key, it charges and records the outcome. Any later request with the same key returns the stored result instead of charging again. Stripe, Adyen, and most others support this — check their docs for the exact header.

Two details people get wrong:

- **Generate the key before the first attempt, and reuse it across all retries.** If you generate a fresh key per attempt, you've built the bug back in. Persist it alongside the order so it survives a process restart.
- **The key must cover a single logical charge.** Two genuinely different charges for the same order need different keys, or the second one silently returns the first one's result.

Same idea applies to your own APIs when someone calls you with retries. If you accept a write, accept a key with it and dedupe on it.

For cleanup: you'll want to find any duplicates already issued and refund them. The provider's dashboard can usually filter charges by customer and time window.

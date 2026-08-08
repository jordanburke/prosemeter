---
kind: eval-artifact
run: 3
variant: E
replicate: r3
task: T3
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry sent a second charge request because the first one succeeded — the response just never made it back to you. The payment provider saw two independent requests and honored both.

The failure mode is a timeout, not an error. When you get a `500` or a connection reset, you don't know which side of the charge you're on. The provider may have already debited the card and died before responding. Your retry looks identical to a fresh purchase, so it charges again.

**Idempotency is the fix.** An idempotent operation gives the same result whether you run it once or ten times. Payment APIs make charges idempotent by taking a client-supplied key:

```
POST /v1/charges
Idempotency-Key: 7c9e6679-7425-40de-944b-e07fc1f90ae7
```

The provider stores that key with the result of the first request. Any later request with the same key returns the stored result instead of charging again. Your retry gets back the original charge, and the card is hit once.

**The rules that make this work:**

1. **Generate the key before the first attempt**, not inside the retry loop. A new key per attempt defeats the whole thing — that's the most common way people get this wrong.
2. **Derive the key from the business action**, not from a random call site. One key per checkout attempt, stored alongside your order record, so a retry after a process crash still finds it.
3. **Reuse the same key for every retry of that action**, including retries that happen minutes later from a background job.
4. **Keep the key stable but scoped.** Same cart, same key. New checkout, new key — otherwise a customer who genuinely wants to buy twice gets blocked.

Do the same on your own side. Store the key and the outcome, so your own service can answer a duplicate request without re-calling the provider.

One more thing worth checking now: audit every retried `POST` in the system, not just this one. Retries are safe on `GET`, `PUT`, and `DELETE` because those are already idempotent. `POST` is where money leaks.

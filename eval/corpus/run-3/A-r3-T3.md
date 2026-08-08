---
kind: eval-artifact
run: 3
variant: A
replicate: r3
task: T3
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry logic is correct. The problem is that a failed request and a request whose *response* failed look identical from the client side, and you're treating both as "didn't happen."

Here's the sequence that charged someone twice:

1. You POST `/charge` for $50.
2. The payment processor receives it, charges the card, commits it.
3. The response gets lost — timeout, connection reset, load balancer hiccup, your client's 10s deadline fires while the processor takes 11s.
4. Your retry sees a failure and POSTs `/charge` for $50 again.
5. The processor receives a brand new, perfectly valid charge request. Charges again.

Nothing malfunctioned. The processor had no way to know request #2 was the *same* charge as request #1 rather than the customer genuinely buying a second thing.

**Idempotency** is the property that doing an operation N times has the same effect as doing it once. `GET`, `PUT` (set balance to 50) and `DELETE` are naturally idempotent. `POST /charge` (add a $50 charge) is inherently *not* — it's "append," and appending twice appends twice. Retries are only safe on idempotent operations, so the fix is to make the charge idempotent artificially.

The mechanism is an **idempotency key**: the client generates a unique id for the *logical operation* and sends it with every attempt.

```
POST /charges
Idempotency-Key: 7f3a9c1e-...   # generated ONCE, reused on every retry
{ "amount": 5000, "currency": "usd" }
```

Server side, roughly:

- Look up the key. If a completed result exists, return the **stored original response** without doing anything. Same status, same charge id.
- If not, record the key and process the charge — ideally inserting the key with a `UNIQUE` constraint in the *same transaction* as the charge, so a concurrent duplicate loses on the constraint instead of racing you.
- If a request with the same key is currently in flight, return 409 and let the client back off.

Two details that people get wrong and then wonder why they still see doubles:

- **Generate the key before the first attempt, not per attempt.** If your retry loop generates a fresh UUID each time, you've built an expensive no-op. The key belongs to the intent ("checkout for cart #1234"), not to the HTTP call.
- **Scope the key to the request body.** Same key with different amounts should be an error, not a silent replay of the old result — otherwise a client bug turns into charging the wrong amount and returning a stale success.

Good news: every real payment processor already supports this. Stripe's `Idempotency-Key` header, Adyen's `reference`, PayPal's `PayPal-Request-Id`. If you're calling one of those, you probably just need to start sending the header. If it's an internal service, you get to build the key table.

Also worth reviewing: retry on 5xx and network errors, never on 4xx, and use exponential backoff with jitter. A tight retry loop against a slow-but-working processor is how you turn one duplicate into six.

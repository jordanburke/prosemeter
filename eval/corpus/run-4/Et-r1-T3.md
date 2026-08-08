---
kind: eval-artifact
run: 4
variant: Et
replicate: r1
task: T3
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry fired on a request that had already succeeded. The charge went through; the response did not come back. The client saw a timeout, could not tell the difference between "never happened" and "happened, reply lost", and tried again.

That gap is the whole problem. A network failure gives you no information about which side of the write you are on.

**The sequence**

1. Client sends `POST /charges`.
2. Gateway charges the card.
3. Response times out, or the connection drops, or the pod gets killed mid-flight.
4. Client retries.
5. Gateway charges the card again.

Nothing malfunctioned. Every component did what it was told.

**What idempotency does**

An idempotent operation gives the same result no matter how many times you run it. `DELETE /user/42` is naturally idempotent. `POST /charges` is not — each call creates a new charge.

You make it idempotent by having the client send a key that identifies the *intent*, not the attempt:

```
POST /charges
Idempotency-Key: 7f3a9c2e-...
{ "amount": 4500, "currency": "usd" }
```

The server stores the key with the result. On a second request with the same key, it returns the stored result instead of charging again. The retry becomes a read.

**Rules that make it actually work**

- **The client generates the key, once, before the first attempt.** All retries of that intent reuse it. If you generate a fresh key per attempt, you have built nothing. This is the mistake I see most.
- **Store the key and the charge in one transaction.** If you write the key after the charge succeeds, a crash between the two puts you right back where you started.
- **Scope the key to the intent, not the user.** One key per checkout, not one per session.
- **Set a retention window.** Stripe holds keys 24 hours. Long enough to cover any retry you would sanely make, short enough that the table does not grow forever.
- **Reject key reuse with a different body.** Same key, different amount means a client bug. Return a 4xx rather than silently serving the old result.

**Your immediate move**

Stripe, Adyen, and Braintree all support this header already. If you are on one of them, add the key and the duplicates stop. Then reconcile — pull charges from the last N days, group by customer and amount and a short time window, and refund what you double-charged. Do that before customers find them.

---
kind: eval-artifact
run: 3
variant: B
replicate: r3
task: T3
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
The core problem: **a failed request and a request whose response you didn't get look identical from your side.**

Here's the sequence that charged someone twice:

1. You send the charge request.
2. The payment provider receives it and charges the card. Successfully.
3. The response gets lost — timeout, dropped connection, a slow network, your service restarting, whatever.
4. Your code sees no response, concludes the charge failed, and retries.
5. The provider receives what looks like a brand new charge request and charges the card again.

Nothing malfunctioned. Your retry logic did exactly what you told it to. The bug is that you treated "I didn't hear back" as "it didn't happen," and those are not the same thing. You can never actually distinguish them from the client side — this isn't a gap you can close with better error handling or a longer timeout.

**Idempotency is the fix.** An operation is idempotent if doing it twice has the same effect as doing it once. Deleting a file is idempotent. Setting a balance to $50 is idempotent. *Charging* $50 is not — doing it twice moves twice the money.

So you make it idempotent artificially, with an **idempotency key**. Before you send the charge, you generate a unique ID for that specific business intent — this one customer paying for this one order — and send it along:

```
Idempotency-Key: order-8823-charge-01
```

The provider stores that key with the result. If a request comes in with a key it's already seen, it doesn't charge again — it returns the *original* result. Your retry gets back the success response from the first attempt, and the customer is charged once.

**The details that trip people up:**

- **Generate the key before the first attempt, not per attempt.** All retries of the same logical charge must send the same key. If you generate a fresh UUID inside the retry loop, you've built exactly the bug you're trying to fix.
- **Derive it from the business operation.** Something stable like the order ID plus a charge sequence number. Then even if your process crashes and restarts and a different worker picks the job up, it computes the same key.
- **Keys need a lifetime.** Providers typically keep them for around 24 hours. Retries days later won't be deduplicated.
- **Check whether your provider supports it.** Stripe, Adyen, and most major processors do. If yours doesn't, you need your own dedup layer — record the attempt in your database inside the same transaction that triggers it, and check before sending.

More generally: any retry against an operation with side effects needs this. Payments are where it hurts most visibly, but sending emails, creating records, and firing webhooks all have the same shape.

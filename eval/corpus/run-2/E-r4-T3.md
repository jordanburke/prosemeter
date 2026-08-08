---
kind: eval-artifact
run: 2
variant: E
replicate: r4
task: T3
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry charged the customer twice because the first request succeeded and you never found out. The payment processor took the charge, then the response got lost — a timeout, a dropped connection, a load balancer that gave up. Your code saw no response, assumed failure, and sent the same request again. The processor had no way to tell that the second request was the same charge, so it made a second one.

The trap is that a timeout does not mean the work did not happen. It means you do not know whether it happened. Retrying is safe only when doing the thing twice equals doing it once.

**Idempotency is what makes that true.** You attach a unique key to the request — one you generate before the first attempt and reuse on every retry:

```
POST /charges
Idempotency-Key: 7f3a91c4-2b8e-4d15-9a0c-1e6f8b2d4a73
{ "amount": 4999, "currency": "usd", "customer": "cus_123" }
```

The processor stores that key with the result. The first request creates the charge. Every retry with the same key returns the stored result instead of charging again. Stripe, Adyen, and most serious payment APIs support this — check the docs for the exact header.

**Three things people get wrong:**

**Generate the key once, at the top.** If you create the key inside your retry loop, every attempt gets a fresh one and you are back to duplicate charges. Generate it when the user clicks pay, then pass the same key through every attempt.

**Tie the key to the intent, not the attempt.** One checkout gets one key. If the user genuinely wants to buy the same thing again, that is a new intent and a new key.

**Persist the key before you send.** If your process dies mid-request and restarts, it needs to recover the key from storage to retry safely. A key held only in memory is gone exactly when you need it.

Then make retries safe on your side too. Store the charge attempt with its key in your own database before you call out, so a crash between "processor charged" and "we recorded it" is recoverable. Reconcile against the processor's records on a schedule to catch whatever still slips through.

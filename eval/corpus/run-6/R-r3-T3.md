---
kind: eval-artifact
run: 6
variant: R
replicate: r3
task: T3
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

Your retry could not tell two cases apart. One: the charge failed. Two: the charge worked and the response got lost. It picked the first, and charged the card again.

## How the duplicate happened

A network call has three outcomes, not two:

1. Success, and you hear about it.
2. Failure, and you hear about it.
3. **You hear nothing.** A timeout, a dropped connection, a load balancer reset, a process that restarted mid-call.

Case three is the one that bites. The request reached the payment provider. The provider charged the card. The response never made it back. From your side, case three and case two are identical — you have no response either way.

Your retry logic read silence as failure and sent the request again. The provider saw a request that looked new, and charged the card a second time.

This is not a bug in your retry code. The network works this way. Retrying more carefully cannot fix it, because no client can distinguish a lost request from a lost response.

## What idempotency does about it

An idempotent operation produces the same result whether you run it once or five times. Deleting a file is idempotent — after the first delete the file is gone, and further deletes change nothing. Charging a card is not, because each call moves money.

Idempotency **keys** make a non-idempotent operation behave like an idempotent one. You generate a unique key for the intent to charge, and you send it with every attempt, retries included:

```
POST /v1/charges
Idempotency-Key: 7f3c1a90-4d2e-4b8c-9a11-6e0f2b5d8c34

{ "amount": 4200, "currency": "usd", "source": "tok_..." }
```

The provider stores the key alongside the result. On the first request it charges the card and records the outcome under that key. On any later request carrying the same key, it skips the charge and replays the stored response.

Case three is now safe. Your retry sends the same key. The provider recognizes it and returns the original charge — the same charge id, the same amount, charged once.

## The rules that make it work

**Generate the key before the first attempt, and reuse it.** This is where implementations go wrong. Generate the key inside the retry loop, and every attempt gets a fresh key, which puts you back where you started. The key belongs to the business intent — this customer paying for this order — not to the HTTP request.

**Derive it from stable data, or persist it.** A random UUID works, but only if you write it down before you send. If your process dies mid-retry and comes back with a new random key, the guarantee is gone. Store it on the order row. Stronger still, derive it from data that already identifies the intent, like `order-{orderId}-payment`, so you can reproduce the key from scratch.

**Keep the request body identical.** Providers key on the idempotency key and reject or flag a reuse that carries a different payload. A changed payload means your two requests disagreed about what they were doing.

**Know the retention window.** Stripe keeps keys for 24 hours. Past that, a reused key counts as a new request. Retries stretching beyond the window lose their protection, so cap your backoff well inside it.

**Handle the in-flight case.** A retry can arrive while the first request is still processing. A good provider returns a conflict instead of a result. Treat that as "wait and check," not as failure.

## What you have to fix on your side

The provider's key protects the provider's ledger. It does not protect your database.

Say your handler charges the card and then writes a payment row. A retry that replays the charge will try to write the row again. You need the same discipline internally: put a unique constraint on the idempotency key in your payments table, so the second write fails loudly instead of duplicating.

The same holds for everything downstream — the confirmation email, the fulfillment event, the analytics call. Each is its own at-least-once delivery problem.

## Cleaning up the ones you already made

Reconcile before you ship the fix. Pull the provider's charge list for the affected window. Group by customer, amount, and a short time bucket. Compare against your own payment records, then refund the true duplicates. Work from the provider's data, not yours, because your records are the ones that lost track.

## The short version

Retries are mandatory, because networks fail and you have to try again. Idempotency keys make retries safe. Generate one key per business intent, persist it before the first attempt, send it on every attempt, and enforce uniqueness in your own database as well as leaning on the provider's.

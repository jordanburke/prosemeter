---
kind: eval-artifact
run: 6
variant: P
replicate: r3
task: T3
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

Your retry could not tell "the charge failed" apart from "the charge worked and the response got lost." It guessed failure, and charged again.

## How the duplicate happened

A network call has three outcomes, not two:

1. Success, and you hear about it.
2. Failure, and you hear about it.
3. **You hear nothing.** A timeout, a dropped connection, a load balancer reset, your process restarting mid-call.

Case three is the one that bites. The request reached the payment provider. The provider charged the card. The response never came back. From where you stand, case three looks exactly like case two — you have no response either way.

Your retry treated silence as failure and sent the request again. The provider saw what looked like a new request and charged the card a second time.

This is not a bug in your retry code. It is a property of the network. Retrying more carefully cannot fix it, because no client can tell a lost request from a lost response.

## What idempotency does about it

An idempotent operation gives the same result whether you run it once or five times. Deleting a file is idempotent — after the first delete it is gone, and further deletes change nothing. Charging a card is not, because each call moves money.

Idempotency **keys** make a non-idempotent operation behave like an idempotent one. You generate one key for the intent to charge, and send it with every attempt, retries included:

```
POST /v1/charges
Idempotency-Key: 7f3c1a90-4d2e-4b8c-9a11-6e0f2b5d8c34

{ "amount": 4200, "currency": "usd", "source": "tok_..." }
```

The provider stores the key next to the result. On the first request it charges the card and records the outcome under that key. On any later request carrying the same key, it skips the charge and replays the stored response.

Case three is now safe. Your retry sends the same key, the provider recognizes it, and you get back the original charge — same charge id, same amount, charged once.

## The rules that make it work

**Generate the key before the first attempt, and reuse it.** This is where implementations go wrong. Generate it inside the retry loop and every attempt gets a fresh key, which puts you right back where you started. The key belongs to the business intent — this customer paying for this order — not to the HTTP request.

**Derive it from something stable, or persist it.** A random UUID is fine, but only if you write it down before you send. If your process dies mid-retry and comes back with a new random key, the guarantee is gone. Store it on the order row. Better, derive it from data that already identifies the intent, like `order-{orderId}-payment`, so the key is reproducible from scratch.

**Keep the request body identical.** Providers key on the idempotency key and typically reject or flag a reuse carrying a different payload, because that means your two requests disagreed about what they were doing.

**Know the retention window.** Stripe keeps keys for 24 hours. Past that, a reused key is a new request. Retries stretching beyond the window are unprotected, so cap your backoff well inside it.

**Handle the in-flight case.** If a retry arrives while the first request is still running, a good provider returns a conflict rather than a result. Treat that as "wait and check," not as failure.

## What you have to fix on your side

The provider's key protects the provider's ledger. It does not protect your database.

If your handler charges the card and then writes a payment row, a retry that replays the charge will try to write that row again. You need the same discipline internally: a unique constraint on the idempotency key in your payments table, so the second write fails loudly instead of duplicating.

The same goes for everything downstream — the confirmation email, the fulfillment event, the analytics call. Each one is its own at-least-once delivery problem.

## Cleaning up the duplicates you already made

Reconcile before you ship the fix. Pull the provider's charge list for the affected window, group by customer, amount, and a short time bucket, then compare against your own payment records. Refund what is genuinely duplicated. Work from the provider's data, not yours, because your records are the ones that lost track.

## The short version

Retries are mandatory, because networks fail and you have to try again. Idempotency keys are what make retries safe. Generate one key per business intent, persist it before the first attempt, send it on every attempt, and enforce uniqueness in your own database instead of leaning only on the provider's.

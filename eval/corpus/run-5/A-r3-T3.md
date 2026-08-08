---
kind: eval-artifact
run: 5
variant: A
replicate: r3
task: T3
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry could not tell "the charge failed" apart from "the charge succeeded and the response got lost." It assumed the first, and charged again.

## How the duplicate happened

A network call has three outcomes, not two:

1. Success, and you hear about it.
2. Failure, and you hear about it.
3. **You hear nothing.** Timeout, dropped connection, load balancer reset, your process restarted mid-call.

Case three is the one that bites. The request reached the payment provider. The provider charged the card. The response never made it back to you. From your side, case three looks exactly like case two — you have no response either way.

Your retry logic treated silence as failure and sent the request again. The provider, seeing a request that looked new, charged the card a second time.

This is not a bug in your retry code. It is a property of the network. You cannot fix it by retrying more carefully, because no amount of care lets a client distinguish "lost request" from "lost response."

## What idempotency does about it

An idempotent operation produces the same result whether you run it once or five times. Deleting a file is idempotent — after the first delete it is gone, and further deletes change nothing. Charging a card is not: each call moves money.

Idempotency **keys** make a non-idempotent operation behave like an idempotent one. You generate a unique key for the intent to charge, and send it with every attempt, including retries:

```
POST /v1/charges
Idempotency-Key: 7f3c1a90-4d2e-4b8c-9a11-6e0f2b5d8c34

{ "amount": 4200, "currency": "usd", "source": "tok_..." }
```

The provider stores the key alongside the result. On the first request it charges the card and records the outcome under that key. On any later request carrying the same key, it skips the charge and replays the stored response.

Now case three is safe. Your retry sends the same key, the provider recognizes it, and you get back the original charge — the same charge id, the same amount, charged once.

## The rules that make it actually work

**Generate the key before the first attempt, and reuse it.** This is where implementations go wrong. If you generate the key inside the retry loop, every attempt gets a fresh key and you are back where you started. The key belongs to the business intent — this customer paying for this order — not to the HTTP request.

**Derive it from something stable, or persist it.** A random UUID is fine, but only if you write it down before you send. If your process dies mid-retry and comes back with a new random key, the guarantee is gone. Store it on the order row. Better still, derive it from data that already identifies the intent, like `order-{orderId}-payment`, so the same key is reproducible from scratch.

**Keep the request body identical.** Providers key on the idempotency key and typically reject or flag a reuse with a different payload, because that means your two requests disagreed about what they were doing.

**Know the retention window.** Stripe keeps keys for 24 hours. Beyond that a reused key is a new request. Retries that stretch past the window are not protected, so cap your backoff well inside it.

**Handle the in-flight case.** If a retry arrives while the first request is still processing, a good provider returns a conflict rather than a result. Treat that as "wait and check," not as failure.

## What you have to fix on your side too

The provider's key protects the provider's ledger. It does not protect your database.

If your handler charges the card and then writes a payment row, a retry that replays the charge will also try to write the row again. You need the same discipline internally: a unique constraint on the idempotency key in your payments table, so the second write fails loudly instead of duplicating.

The same applies to anything downstream — the confirmation email, the fulfillment event, the analytics call. Each is its own at-least-once delivery problem.

## Cleaning up the ones you already made

Before shipping the fix, reconcile. Pull the provider's charge list for the affected window, group by customer and amount and a short time bucket, and compare against your own payment records. Refund what is genuinely duplicated. Do this from the provider's data, not yours, because your records are the ones that lost track.

## The short version

Retries are mandatory — networks fail and you have to try again. Idempotency keys are what make retries safe. Generate one key per business intent, persist it before the first attempt, send it on every attempt, and enforce uniqueness in your own database as well as relying on the provider's.

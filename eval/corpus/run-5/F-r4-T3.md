---
kind: eval-artifact
run: 5
variant: F
replicate: r4
task: T3
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
## Why did retrying charge the customer twice?

Your retry fired on a request that had already succeeded. The first charge went through on the payment provider's side, but the response never reached you — a timeout, a dropped connection, a load balancer that gave up. Your code saw no answer, assumed failure, and sent the charge again. The provider saw two separate charge requests and honored both.

The key point is that a failed response is not a failed request. When a call times out, you know one thing only: you did not get an answer. The work may have finished, may have half-finished, or may never have started. Retrying blind treats all three as "never started."

## What does idempotency have to do with it?

An idempotent operation gives the same result whether you run it once or ten times. Deleting a file is idempotent — delete it twice and it is still just gone. Charging a card is not — charge it twice and the customer is out twice the money.

Retries are only safe on idempotent operations. That is the whole rule. So the fix is not to retry more carefully; the fix is to make the charge idempotent, then retry freely.

## How do I make a charge idempotent?

Attach a key that names the attempt, and let the provider deduplicate on it.

Generate a unique string — a UUID works — before the first attempt. Send it with the request and send the exact same string on every retry of that same attempt.

```
POST /v1/charges
Idempotency-Key: 8f14e45f-ea0b-4a1e-9b28-3d61bcb0a7c2

{ "amount": 4200, "currency": "usd", "source": "card_xyz" }
```

The provider stores the key with the result of the first request. When your retry arrives with the same key, the provider skips the work and replays the stored response. You get a success, the customer gets one charge.

Every major payment provider supports this. Stripe, Adyen, and Square all read an `Idempotency-Key` header; the name and lifetime vary, so check the docs for how long a key stays valid — a day is common.

## What do I have to get right on my side?

Three things decide whether this actually works.

**Generate the key before the first attempt, not inside the retry loop.** A key created fresh on each try is a new key, which means a new charge. This is the bug people ship after learning about idempotency keys.

**Derive the key from the thing being paid for, not from the moment.** Use the order id, the invoice id, or an id you created when the user pressed the button. Then a user who double-clicks, or a job that reruns after a crash, lands on the same key. A random key made in memory dies with the process, and the retry after a restart charges again.

**Store the key before you send the request.** Write it to your database in the same transaction that records the intent to charge. If your service dies mid-call, the key survives, and the recovery path reuses it.

## What about everything else that retries?

Apply the same test to every operation you retry. Ask: if this runs twice, is the outcome the same?

Reads are safe. `GET` changes nothing, so retry it freely.

Writes that set a value are usually safe. `PUT /users/42 {"name": "Ada"}` twice leaves the same name.

Writes that create or add are not safe. Creating an order, appending a ledger entry, sending an email, incrementing a counter — each of these needs a key, a uniqueness constraint on a business id, or a check before the write.

If you cannot make an operation idempotent, do not retry it. Fail, record what you know, and reconcile against the provider's records later.

---
kind: eval-artifact
run: 6
variant: R
replicate: r2
task: T3
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

The retry did not fail. The first request succeeded and the response got lost on the way back. Your client saw silence, treated it as failure, and charged the card again.

## The core problem

A network call has three outcomes, not two:

1. It succeeded, and you know it.
2. It failed, and you know it.
3. **You do not know.**

Timeouts, dropped connections, 502s from a load balancer, and a client crash mid-flight all land in bucket three. From the caller's side, two cases look identical: "the server never got my request" and "the server processed my request and the reply vanished." Retry logic that treats every unknown as a failure re-sends requests that already worked.

For a read, that is harmless. For `POST /charges`, each retry is another charge, and your customer is out three hundred dollars twice.

Attempts also get slower under load, which is when timeouts fire. So the failure mode is worst during your busiest hour. A retry storm turns one lost response into four or five duplicate charges.

## What idempotency means here

An operation is idempotent when doing it more than once has the same effect as doing it once. `DELETE /users/42` is idempotent by nature — the second call has nothing left to delete and the end state matches. Creating a charge is not: each call means another charge, by design.

You cannot make "create a charge" idempotent by changing what it does. You make it idempotent by giving the server a way to recognize a repeat.

## The idempotency key

The client generates a unique key per *logical operation* — not per HTTP attempt — and sends it with every attempt:

```
POST /v1/charges
Idempotency-Key: 7f3c1e9a-4b21-4d3e-9c0a-2f8e51d7b6aa

{ "amount": 30000, "currency": "usd", "source": "tok_..." }
```

The server:

1. Reads the key from a store, inside a transaction.
2. If the key is new, records it, performs the charge, and saves the response body and status against the key.
3. If the key exists and is complete, returns the **stored response** without charging again.
4. If the key exists and is still in flight, returns 409 so the client backs off instead of racing.

Now retrying is safe. The second attempt returns the charge id the first one created. The caller cannot tell which attempt did the work, and does not need to.

Stripe, Adyen, and the other major payment APIs work this way. If you are calling a provider, the header already exists. The bug is that the client generates a fresh key on each retry, which defeats the whole mechanism.

## Details that matter

**Generate the key at the top of the operation.** If your retry loop creates a new UUID per attempt, you have added a header and fixed nothing. The key belongs to "the user pressed Pay." Create it there and pass it down through every retry.

**Store the key atomically with the effect.** Record the key in Redis and write the charge to Postgres, and a crash between the two leaves you inconsistent. Put the key in the same database, in the same transaction as the charge. A unique constraint on the key column is the simplest correct implementation — let the database reject the duplicate.

**Bind the key to the request body.** If the same key arrives with a different amount, that is a client bug, not a retry. Return an error. Do not replay the old response in silence.

**Retry only what is safe.** Never retry on a timeout unless you have a key. Do retry on connection-refused and 503, where you know the server processed nothing. Never retry a 4xx — the request is wrong and will stay wrong.

**Back off with jitter.** Fixed-interval retries from a thousand clients synchronize into a thundering herd. That re-creates the overload that caused the timeouts.

**Set a retention window.** Keep keys for 24 hours or more, longer than any plausible client retry.

## The other half: reconciliation

Idempotency keys close the window; they do not shut it. A client that crashes before storing the charge id can still leave you with a charge nobody knows about. So can a key store that expires early. Run a periodic reconciliation against the provider's charge list, matched on your own order id, and alert on anything unexpected. A payments system needs both — the key for the fast path, reconciliation as the backstop.

## What to do now

Refund the duplicates first, and tell the affected customers before they find it themselves. Then check whether the key is generated per operation or per attempt. In my experience that is the bug about eighty percent of the time.

---
kind: eval-artifact
run: 6
variant: P
replicate: r2
task: T3
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

The retry did not fail. The first request succeeded and the response got lost coming back. Your client saw silence, assumed failure, and charged the card again.

## The core problem

A network call has three outcomes, not two:

1. It succeeded, and you know it.
2. It failed, and you know it.
3. **You do not know.**

Timeouts, dropped connections, a 502 from a load balancer, and a client crash mid-flight all land in bucket three. From the caller's side, "the server never got my request" and "the server processed it and the reply vanished" look identical. Retry logic that treats every unknown as a failure re-sends requests that already worked.

For a read, that is harmless. For `POST /charges`, each retry is another charge, and your customer is out three hundred dollars twice.

Requests also get slower under load, which is exactly when timeouts fire. So this fails worst during your busiest hour, and a retry storm turns one lost response into several duplicate charges.

## What idempotency means here

An operation is idempotent when doing it more than once has the same effect as doing it once. `DELETE /users/42` is naturally idempotent: the second call finds nothing to delete and the end state matches. Creating a charge is not, by design — each call means another charge.

You cannot make "create a charge" idempotent by changing what it does. You make it idempotent by giving the server a way to recognize a repeat.

## The idempotency key

The client generates one key per *logical operation*, not per HTTP attempt, and sends it with every attempt:

```
POST /v1/charges
Idempotency-Key: 7f3c1e9a-4b21-4d3e-9c0a-2f8e51d7b6aa

{ "amount": 30000, "currency": "usd", "source": "tok_..." }
```

The server then:

1. Looks the key up in a store, inside a transaction.
2. If the key is new, records it, performs the charge, and saves the response body and status against it.
3. If the key exists and is complete, returns the **stored response** without charging again.
4. If the key exists and is still in flight, returns 409 so the client backs off rather than racing.

Now retrying is safe. The second attempt returns the charge id the first one created, and the caller cannot tell which attempt did the work — and does not need to.

Stripe, Adyen, and most payment APIs work this way. If you call a provider, the header almost certainly exists already. The bug is usually that the client generates a fresh key on each retry, which defeats it entirely.

## Details that matter

**Generate the key at the top of the operation.** A retry loop that mints a new UUID per attempt has added a header and fixed nothing. The key belongs to "the user pressed Pay," so create it there and pass it down through every retry.

**Store the key atomically with the effect.** Recording the key in Redis while writing the charge to Postgres leaves you inconsistent if you crash between the two. Put the key in the same database, in the same transaction as the charge. A unique constraint on the key column is the simplest correct version: let the database reject the duplicate.

**Bind the key to the request body.** If the same key arrives with a different amount, that is a client bug rather than a retry. Return an error instead of silently replaying the old response.

**Retry only what is safe.** Never retry a timeout unless you have a key. Do retry connection-refused and 503, where you know the server processed nothing. Never retry a 4xx — the request is wrong and will stay wrong.

**Back off with jitter.** Fixed-interval retries from many clients synchronize into a thundering herd and re-create the overload that caused the timeouts.

**Set a retention window.** Keep keys for at least 24 hours, longer than any plausible client retry.

## The other half: reconciliation

Idempotency keys narrow the window; they do not close it. A client that crashes before storing the charge id, or a key store that expires early, still leaves a charge nobody knows about. Run a periodic reconciliation against the provider's charge list, matched on your own order id, and alert on anything unexpected. Payment systems generally need both: the key for the fast path, reconciliation as the backstop.

## What to do now

Refund the duplicates first, and tell the affected customers before they find it themselves. Then check whether the key is generated per operation or per attempt. That is the bug most of the time.

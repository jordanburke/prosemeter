---
kind: eval-artifact
run: 5
variant: A
replicate: r2
task: T3
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
The retry did not fail. The first request succeeded, and the response got lost on the way back. Your client saw silence, assumed failure, and charged the card again.

## The core problem

A network call has three possible outcomes, not two:

1. It succeeded, and you know it.
2. It failed, and you know it.
3. **You do not know.**

Timeouts, dropped connections, 502s from a load balancer, and a client crash mid-flight all land in bucket three. From the caller's side, "the server never got my request" and "the server processed my request and the reply vanished" are indistinguishable. Retry logic that treats every unknown as a failure will re-send requests that already worked.

For a read, that is harmless. For `POST /charges`, each retry is another charge, and your customer is now out three hundred dollars twice.

Attempts also get slower under load, which is exactly when timeouts fire. So the failure mode is worst during your busiest hour, and a retry storm can turn one lost response into several duplicate charges.

## What idempotency means here

An operation is idempotent if doing it more than once has the same effect as doing it once. `DELETE /users/42` is naturally idempotent — the second call finds nothing to delete and the end state is the same. Creating a charge is not: each call means another charge, by design.

You cannot make "create a charge" idempotent by changing what it does. You make it idempotent by giving the server a way to recognize a repeat.

## The idempotency key

The client generates a unique key per *logical operation* — not per HTTP attempt — and sends it with every attempt:

```
POST /v1/charges
Idempotency-Key: 7f3c1e9a-4b21-4d3e-9c0a-2f8e51d7b6aa

{ "amount": 30000, "currency": "usd", "source": "tok_..." }
```

The server:

1. Looks the key up in a store, inside a transaction.
2. If it is new, records it, performs the charge, and saves the response body and status against the key.
3. If it already exists and is complete, returns the **stored response** without charging again.
4. If it exists and is still in flight, returns 409 (or the equivalent) so the client backs off rather than racing.

Now retrying is safe. The second attempt returns the same charge id the first one created, and the caller cannot tell — nor need to care — which attempt did the work.

This is how Stripe, Adyen, and most payment APIs work. If you are calling a provider, the header almost certainly already exists; the bug is usually that the client generates a fresh key on each retry, which defeats it entirely.

## Details that matter

**Generate the key at the top of the operation.** If your retry loop creates a new UUID per attempt, you have added a header and fixed nothing. The key belongs to "the user pressed Pay", so create it there and pass it down through every retry.

**Store the key atomically with the effect.** If you record the key in Redis and write the charge to Postgres, a crash between the two leaves you inconsistent. Put the key in the same database, in the same transaction as the charge. A unique constraint on the key column is the simplest correct implementation — let the database reject the duplicate.

**Bind the key to the request body.** If the same key arrives with a different amount, that is a client bug, not a retry. Return an error rather than silently replaying the old response.

**Retry only what is safe.** Never retry on a timeout unless you have a key. Do retry on connection-refused and 503, where you know the server never processed anything. Never retry a 4xx — the request is wrong and will stay wrong.

**Back off with jitter.** Fixed-interval retries from many clients synchronize into a thundering herd and re-create the overload that caused the timeouts.

**Set a retention window.** Keep keys for at least 24 hours, longer than any plausible client retry.

## The other half: reconciliation

Idempotency keys close the window; they do not eliminate it. A client that crashes before storing the charge id, or a key store that expires early, can still leave you with a charge nobody knows about. Run a periodic reconciliation against the provider's charge list, matched on your own order id, and alert on anything you did not expect. Payments systems generally need both — the key for the fast path, reconciliation as the backstop.

## What to do now

Refund the duplicates first, and tell the affected customers before they find it themselves. Then check whether the key is being generated per operation or per attempt — in my experience that is the bug about eighty percent of the time.

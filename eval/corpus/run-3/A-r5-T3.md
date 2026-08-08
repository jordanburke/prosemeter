---
kind: eval-artifact
run: 3
variant: A
replicate: r5
task: T3
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
The core problem: **a failed request is not the same thing as a request that didn't happen.**

Your retry logic treats a timeout or a 5xx as "that didn't work, try again." But from the client's side those responses are ambiguous. What actually happened could be any of:

1. Request never reached the payment provider — safe to retry.
2. Request arrived, provider charged the card, **response got lost on the way back** — retrying charges again.
3. Request arrived, provider is still processing it — retrying races the original.

Cases 2 and 3 are where the duplicate charges come from. The client can't distinguish them from case 1. You cannot fix this with better error handling on your side, because the information you'd need isn't in the response — that's the whole problem, the response never arrived.

### What idempotency does about it

An idempotent operation produces the same result whether it's applied once or many times. `DELETE /orders/123` is naturally idempotent. `POST /charges` is not — each call is a new charge, which is exactly what you want normally and exactly what kills you on retry.

The fix is to make the operation idempotent *by key*. The client generates a unique **idempotency key** for the logical operation — one key per "customer clicks Pay," not one per HTTP attempt — and sends it with every attempt:

```http
POST /v1/charges
Idempotency-Key: 9f2c1a4e-... 
```

Server side, the contract is:

- First time it sees a key: process the charge, **store the key alongside the response** before returning.
- Any later request with the same key: don't process anything, replay the stored response.

Now retry #2 in case 2 above returns the *original* charge's response. The customer is charged once and your client code gets a success it can act on. Stripe, Adyen, and Square all implement this; you're most likely already able to use it by just setting the header.

The critical detail people get wrong: **generate the key before the first attempt and reuse it across all retries.** If you generate a fresh UUID inside the retry loop, you've built exactly the same bug with extra steps. The key belongs to the intent, not the attempt.

### On your own side too

If you have your own service in front of the provider, it needs the same treatment, or you've just moved the problem. Store the key in a table with a unique constraint, and do the insert in the same transaction as the state change:

```sql
CREATE UNIQUE INDEX ON payment_attempts (idempotency_key);
```

Let the database's unique constraint be the arbiter rather than a check-then-act in application code — check-then-act has a race window, and concurrent retries land in that window specifically.

Two more things worth knowing:

- **Store the response, not just the key.** A key with no stored response means a concurrent duplicate can't be answered correctly — it has to either block until the first finishes or return a "in progress, retry later" status. Both are fine; silently returning success without knowing the outcome is not.
- **Only retry on ambiguous or transient failures.** A 400 or a card decline is deterministic — retrying wastes calls and can trip fraud heuristics. Retry 5xx, timeouts, and connection errors, with exponential backoff and jitter.

Short version: retries are safe only when the operation is idempotent, and payments aren't idempotent by default. You have to make them so, with a key that's stable across attempts.

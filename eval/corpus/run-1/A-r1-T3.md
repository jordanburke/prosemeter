---
kind: eval-artifact
run: 1
variant: A
replicate: r1
task: T3
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
reviewerFinding:
  severity: minor
  foundBy: "opus,sonnet"
  error: "Lists 429 as retryable, then says never retry a 4xx. 429 is a 4xx."
---
The retry didn't cause a duplicate charge — the retry *revealed* that your charge endpoint doesn't know the difference between "the same request twice" and "two different requests."

**What happened**

Your client sent a charge request. Something went wrong on the way back: a timeout, a dropped connection, a 502 from a proxy, a load balancer killing an idle socket. Your retry logic saw a failure and sent the request again.

The key insight: **a failed response does not mean a failed operation.** There are two very different worlds that look identical to the caller:

1. Request never reached the payment processor → nothing charged → retry is correct
2. Request reached the processor, the card was charged, the response got lost on the way back → already charged → retry double-charges

From the client's side these are indistinguishable. You got a timeout in both cases. So a naive retry is a coin flip on whether you're fixing a failure or creating a duplicate. Under network trouble — exactly when retries fire most — case 2 is common, because slow/timed-out requests are frequently ones the server *did* process, just slowly.

**Where idempotency comes in**

An operation is idempotent if doing it N times has the same effect as doing it once. `GET` is naturally idempotent. `DELETE user 5` is idempotent. `charge $50` is emphatically not — each call moves money.

You can't make "charge $50" naturally idempotent, so you make it idempotent *by identity*: the client generates a unique key per logical operation and sends it with the request. The server records that key with the result. If it ever sees the same key again, it returns the stored result instead of performing the operation again.

Now retrying is safe, because the second request isn't "charge $50 again," it's "charge $50, and here's the same key as before" — which the server recognizes as a replay.

**Concretely**

Client side:

```
POST /charges
Idempotency-Key: 7f3a9c2e-...   # generated ONCE, before the first attempt
{ "amount": 5000, "currency": "usd", "customer": "cus_123" }
```

The key must be generated **before the first attempt and reused across all retries of that same logical charge**. This is the part people get wrong — if you generate a fresh UUID inside the retry loop, you've built nothing. The key identifies the *intent*, not the *attempt*.

Server side, roughly:

1. Insert the key into a table with a **unique constraint** on the key, in the same transaction as the charge, with state `in_progress`.
2. If the insert violates the unique constraint, this is a replay:
   - If the stored record is `completed`, return the stored response, same status code, same body.
   - If it's still `in_progress`, the original is running concurrently — return `409` and let the client back off and re-poll. Do *not* proceed.
3. On completion, store the response body and mark `completed`, atomically with the charge.

The unique constraint is doing the real work. Don't implement this as "SELECT to check if key exists, then INSERT" — that's a race, and two concurrent retries will both pass the SELECT. Let the database enforce it.

Two more details worth getting right:

- **Scope the key to the request payload.** Store a hash of the body alongside the key. If the same key arrives with a *different* body, that's a client bug — reject with `422` rather than returning the wrong cached result.
- **Expire keys**, typically 24h. Long enough to outlive any retry storm, short enough that the table doesn't grow forever.

**Also fix the retry policy itself**

Even with idempotency, retry hygiene matters:

- Only retry on things that are plausibly transient: timeouts, connection errors, 5xx, 429. Never retry a 4xx — the request was rejected on its merits and will be rejected again.
- Exponential backoff **with jitter**. Without jitter, every client that failed at the same moment retries at the same moment and you re-DDoS yourself on recovery.
- Cap total attempts and total elapsed time. After that, surface it to a human or a reconciliation job rather than retrying forever.

**Right now**, before the architecture work: pull the duplicate charges from the last N days by grouping on (customer, amount, short time window), refund the dupes, and get ahead of the chargebacks. Then ship the idempotency key. Most payment processors — Stripe, Adyen, Braintree — already support an idempotency key header on their side, so if you're calling one, you may be able to pass a key through immediately and get most of the protection today while you build your own layer.
